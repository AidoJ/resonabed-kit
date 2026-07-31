# Pseudonymisation layer — proposal and migration risk assessment

No schema changes made. This is a written proposal only.

## Read-back

A random, opaque token per client. Health-bearing rows point at the token's row, never at a name. The name/contact/DOB mapping lives in one isolated, separately access-controlled place. Therapists still see "Aidan Leonard — pacemaker flagged" in normal use, so the two remain rejoinable for authorised users of that clinic; this is blast-radius reduction, not anonymisation, and does not reduce custody obligations under the Privacy Act / APPs and state health records law.

## Current state (verified against the live database)

Live health volume today: 0 screenings, 0 clearance letters, 1 client note, 4 sessions, 4 clients, 1 organisation. This is the cheapest moment this change will ever be.

What the health tables look like now:
- `client_screenings`, `client_clearance_letters`, `client_clearance_letter_revocations`, `client_notes`, `sessions` all carry `client_id` (a direct FK to `clients`, which holds first/last name, email, phone, DOB) plus `org_id`.
- RLS on all of them is `org_id = current_org_id() OR is_super_admin(auth.uid())`.
- So the health store is not self-identifying only if `clients` is out of reach — today it is one join away in the same schema, same database, same connection.

### Cross-clinic exposure (the bigger lever)

Two real cross-clinic reach paths exist today:

1. **`is_super_admin()` in the SELECT policy of every health table.** A platform super admin can read every clinic's screenings, letters, notes and sessions, at any time, without a support grant and without an entry in `support_sessions`. The consent/audit machinery you built (`support_access_grants`, `support_sessions`, `resolveEffectiveOrgId`) is enforced in application code, not in these policies.
2. **Service role.** `supabaseAdmin` bypasses RLS entirely. Any server function that reaches for it can traverse all clinics' health data.

Recommendation, independent of and higher-value than tokenisation:
- Drop `is_super_admin()` from the SELECT policies on the four health tables and replace it with a grant-and-session-scoped predicate: super admin sees a clinic's health rows only where `org_id` matches an *open* `support_sessions` row for that admin backed by a live `support_access_grant`. Platform metrics keep working because they already use aggregates, and aggregates can be served by a `SECURITY DEFINER` function that returns counts only.
- Keep the admin client out of health tables by policy: no `*.functions.ts` health path may import `client.server.ts`. Worth a lint rule, not just a convention.

Result: no single credential short of database-level access can enumerate identifiable health data across clinics. That shrinks the central pool far more than a token does.

### `get_public_*` functions

`get_public_org`, `get_public_services`, `get_public_availability` touch organisations, services, availability and profiles only. None touch a health table or `clients`. This work must not add anything to them, and the build should end with a check asserting that.

## Proposed design

### 1. The token

New table, one row per client:

```
client_pseudonyms
  id            uuid  pk  default gen_random_uuid()   -- the token itself
  org_id        uuid  not null
  created_at    timestamptz
```

The token is `gen_random_uuid()` — CSPRNG, no name input, no sequence, no year, nothing derivable. A short human-readable label for the operator UI (e.g. `RB-7K4Q2M`) can be generated from random bytes, never from the name.

`clients` keeps identity (name, email, phone, DOB) and gains `pseudonym_id uuid unique` pointing at the token. The mapping direction matters: the identity table references the token, so the health store never needs to name the identity table.

### 2. Health rows re-key onto the token

`client_screenings`, `client_clearance_letters`, `client_clearance_letter_revocations` (via letter), `client_notes`, and `sessions` gain `pseudonym_id`, and after cut-over `client_id` is dropped from them. They then contain: a meaningless uuid, an org id, clinical content. Breached alone, they say "someone at clinic X has a pacemaker flag" — a real reduction, and honestly a partial one, because free-text practitioner notes and clearance-letter issuer names can self-identify. Note snapshots also embed `org_name_snapshot`; that stays (it is the clinic, not the client).

### 3. Isolating the mapping

Three options, in increasing separation and cost. Design stays flexible on which, given your legal advice is pending.

- **A. Separate schema, same database** (`identity.clients`), Data API not exposed, reachable only through `SECURITY DEFINER` resolver functions that take a token and return identity for the caller's own org. Cheap, works today, defeats "read the public schema" but not "read the whole database".
- **B. Separate Postgres role and grants** on top of A: the app's normal role can read health but only call the resolver for identity; resolution becomes individually auditable (every re-identification is a function call you can log).
- **C. Separate database or per-clinic custody**, identity held by the clinic, platform holds only tokens. Strongest, and the only one that meaningfully changes who the custodian is — this is exactly the question your advisers are considering. The token design is compatible with C without rework, which is the point of choosing an opaque uuid now.

Recommendation: build A+B now, keep C open.

### 4. Encryption

What Supabase gives by default: AES-256 encryption at rest for the database volume, backups and Storage objects, and TLS in transit. That protects against a stolen disk. It does not protect against a compromised application credential, a leaked service key, or an over-broad query — the data is transparently decrypted for anyone who can connect.

What to add, in priority order:
1. **Clearance-letter files** (`clearance-letters` bucket — doctors' letters, the most sensitive artefact). Encrypt client-side/server-side with a key held outside the database (Supabase Vault or an env-held KEK, per-org DEK) before upload, so a Storage breach yields ciphertext. Signed URLs already gate access; this covers key/credential compromise too.
2. **Screening detail** — `checklist_snapshot`, `flagged_items`, `blocking_items`, `practitioner_notes`, `decline_reason`, and `client_notes.body`. Encrypt with `pgsodium`/Vault-managed keys or application-layer envelope encryption. Cost: these columns become unsearchable and unfilterable in SQL. Check first whether anything filters on them — `client_item_cleared` filters on `item_key`, which must stay plaintext.
3. Signatures (`client_signature`, `practitioner_signature`) are images of a person's handwriting — identifying. Treat them like letters, not like screening detail.

## Migration risk assessment

The failure mode you named — a health row whose token resolves to nobody — is the one to engineer against.

**Risk today: low, because volume is near zero.** 1 note and 4 sessions carry a `client_id`. Zero screenings and zero letters. If this is going to happen, now is materially safer than in six months.

Method — one migration, idempotent, verified, reversible:

1. Create `client_pseudonyms` and backfill exactly one row per existing client, inside a single transaction. Idempotency comes from `insert ... select ... where not exists`, plus a unique constraint on `clients.pseudonym_id` — a re-run inserts zero rows rather than duplicating.
2. Add `pseudonym_id` to health tables as **nullable**, backfill from the existing `client_id` join, all in the same transaction.
3. **Verify before committing**, in-migration, with hard assertions that abort the transaction: (a) every client has exactly one pseudonym; (b) for each health table, `count(*) where pseudonym_id is null` = 0; (c) for each health table, the count of rows whose `pseudonym_id` resolves through `clients` back to the same `client_id` equals the total row count; (d) row counts before and after are identical. If any assertion fails, the whole thing rolls back and nothing has changed.
4. **Only then** set `pseudonym_id` NOT NULL and add the FK.
5. **Keep `client_id` in place, dual-written, for a defined soak period** (suggest two weeks of live use). This is what makes it reversible: reverting is dropping the new column, not reconstructing lost links. Drop `client_id` in a second, separate migration after the soak, and only after a re-run of the same verification queries.

## What breaks, and how it is handled

- **RLS policies** — health-table policies key on `org_id`, not `client_id`, so they survive re-keying untouched. The separate super-admin tightening above is where the policy work actually is.
- **Screening gate triggers** — `sessions_require_signed_screening` and `sessions_screening_immutable` both compare `s.client_id` to `NEW.client_id`; `bookings_require_signed_screening` joins `sessions.client_id`. All three must be rewritten to compare `pseudonym_id`, in the same migration that adds the column, and re-tested against the ratification steps you already ran (walk-in gate, direct status update rejected, screening reuse rejected). These are the highest-risk objects in the change: if a trigger silently stops matching, the gate opens.
- **`client_item_cleared(_client_id, _item)`** — becomes token-keyed; call sites in the screening flow update with it.
- **Joins in application code** — every `.eq("client_id", ...)` against a health table, the client history dialog, screening history, and the vetting/notes panel. All go through a single resolver so re-identification has one chokepoint.
- **Audit trail** — `booking_events` carries `client_id` plus `requester_name`/`requester_email`/`requester_phone` in the clear, and it is append-only, so it cannot be rewritten in place. It is a booking audit, not a health store, and it should stay identity-bearing — but it is then a second place identity lives, and the proposal should not pretend otherwise. Recommend leaving it as-is and documenting it as identity-bearing by design.
- **`get_public_*`** — untouched, with an explicit post-build assertion that none of them reference a health table or the identity mapping.

## What this protects against, and what it does not

Protects against: a breach or exfiltration limited to the health tables; an over-broad query by an authenticated app credential; a leaked read replica or dump of the public schema (under option A/B); a Storage bucket breach (with encryption item 1).

Does not protect against: full database compromise (both halves are reachable); a compromised authorised clinic account (they are entitled to rejoin); an insider with resolver access; free-text notes that self-identify; and it does not reduce your obligations as custodian — the data remains re-identifiable personal health information in your hands.

Honest ranking of value: cross-clinic scoping tightening > clearance-letter encryption > pseudonymisation > screening-detail column encryption.
