# Phase 2 — Session Engine

Tablet-first practitioner flow: intake → frequency match → play → complete.

## 1. Database (single migration)

- **Integrity trigger** on `public.sessions`, BEFORE INSERT OR UPDATE:
  - Raise if `NEW.client_id`'s `org_id != NEW.org_id`.
  - Raise if `NEW.service_id IS NOT NULL` and its `org_id != NEW.org_id`.
  - `SECURITY DEFINER`, `search_path = public`, same pattern as `prevent_org_id_change`.
- **Frequencies seed** — idempotent `INSERT ... ON CONFLICT (hz) DO UPDATE`. Requires a unique index on `frequencies.hz` (add if missing). Wellbeing language only, no medical claims:

| Hz  | Name              | Color   | Theme                                          |
| --- | ----------------- | ------- | ---------------------------------------------- |
| 174 | Grounding         | #3B4A6B | gentle grounding, sense of safety, rest        |
| 285 | Renewal           | #4A6B8A | soft reset, restoration, calm                  |
| 396 | Release           | #5B7BA8 | letting go of tension, ease                    |
| 417 | Change            | #6B8FC7 | fresh start, mental clarity, calm              |
| 528 | Harmony           | #7BB0A8 | balance, deep relaxation, wellbeing            |
| 639 | Connection        | #9BC48A | warmth, connection, comfort                    |
| 741 | Clarity           | #C7B87B | focus, gentle clarity, refreshed feeling       |
| 852 | Stillness         | #B08AC7 | inner quiet, meditative calm                   |
| 963 | Serenity          | #8A6BC7 | serenity, rest, peaceful stillness             |

## 2. Frequency matching (pure TS)

`src/lib/frequency-match.ts` — deterministic scoring, no DB call:

```text
score(freq, intake) =
  goal_weights[freq.hz][goal] summed over intake.goals
  + area_weights[freq.hz][area] summed over intake.body_areas
  + slider_weights[freq.hz](pain, stress, sleep)
```

Weights curated so e.g. high stress + "stress relief" → 396 or 417 top; poor sleep + "better sleep" → 963/852; "energy" + "recovery" → 528/741. Returns `{ frequency, score }[]` sorted desc. Unit-testable, no side effects.

## 3. Routes

Filesystem (all under `_authenticated`):

```text
src/routes/_authenticated/
  sessions.tsx              (layout: <Outlet />, replaces stub)
  sessions.index.tsx        (list — /sessions)
  sessions.new.tsx          (intake wizard — /sessions/new)
  sessions.$id.play.tsx     (player — /sessions/$id/play)
  sessions.$id.tsx          (read-only summary for completed/cancelled)
```

Existing `_authenticated/sessions.tsx` stub replaced (kept as list before, now split into layout + index).

## 4. Server functions

`src/lib/sessions.functions.ts` (all `.middleware([requireSupabaseAuth])`, RLS enforces org scope):

- `listMyOrgClients({ search? })` — for step 1 search.
- `createClient({ first_name, last_name, email?, phone? })` — inserts into current org via `current_org_id()` server-side lookup.
- `listMyOrgServices()` — active services for step 2.
- `listFrequencies()` — all 9 (public-ish but signed-in only).
- `createDraftSession({ client_id, service_id, pain_level, stress_level, sleep_quality, body_areas, primary_goals, contraindications, practitioner_notes, consent_given, recommended_frequency_id })` — sets `status='draft'`, `practitioner_id=userId`, `org_id=current_org_id()`.
- `getSession({ id })` — full row + joined client, service, frequency.
- `updateSessionFrequency({ id, recommended_frequency_id })`.
- `completeSession({ id, payment_method, payment_amount, practitioner_notes })` — status='completed'.
- `cancelSession({ id })` — status='cancelled'.
- `listMyOrgSessions()` — newest first, joined for list rendering.
- `getAudioForFrequency({ frequency_id })` — returns active `audio_files` row for org+frequency.
- `getSignedAudioUrl({ audio_file_id })` — server-side `storage.from('audio-files').createSignedUrl(path, 3600)`; caller org gated by RLS.

Zod validation on every input. All writes rely on `current_org_id()` server-side, never trust client `org_id`.

## 5. UI components

- `src/components/session-wizard/` — step container with progress dots, Back/Next, tablet-friendly spacing.
  - `step-client.tsx` — Command search combobox + inline "Create new client" dialog.
  - `step-service.tsx` — radio-card list.
  - `step-symptoms.tsx` — 3 sliders (0–10, big handles, value display), body-area chips (toggle buttons), goal chips.
  - `step-safety.tsx` — contraindication checkboxes with "none of these" that clears others; free-text notes; consent checkbox gating Next; amber `<Alert>` if any contraindication ticked.
  - `step-frequency.tsx` — top recommendation card (large hz, name, color band, description) + collapsible ranked alternatives (selectable). Confirm → create draft session → navigate to `/sessions/$id/play`.
- `src/components/session-player/`
  - `countdown-timer.tsx` — `requestAnimationFrame` loop computing `remaining = endTs - performance.now()` (drift-free). End chime = WebAudio short sine fade. mm:ss text ~text-8xl.
  - `audio-player.tsx` — native `<audio>` ref, play/pause/stop, seek `<Slider>`, volume `<Slider>`. All controls min 48px. Loads via `getSignedAudioUrl`.
  - `complete-panel.tsx` — payment method select, amount input (prefilled from service.price), notes textarea, Complete + Cancel buttons.
  - Empty state when no audio for frequency: neutral card with `<Link to="/audio">Add one under Audio</Link>`.
- `src/components/sessions-list.tsx` — table on desktop, stacked cards on tablet portrait. Row click: draft → `/sessions/$id/play`, completed/cancelled → `/sessions/$id`.

## 6. Tablet ergonomics

- Wizard container `max-w-3xl mx-auto p-6`, buttons `h-12 text-base`, sliders with 28px thumb (`[&_[role=slider]]:h-7 [&_[role=slider]]:w-7`).
- Player: two-column landscape (frequency card | timer + audio), stacks under `md:`. All buttons `size="lg"` + `min-h-12`.
- Body-area / goal chips: `Toggle` variant, `h-11 px-4`.

## 7. Out of scope this phase

- No RLS / role changes (integrity trigger only).
- No audio upload UI (still stub under `/audio`).
- No client edit page.
- No reporting.

## Verification

- Playwright: sign in → new session → walk 4 steps → land on player → confirm timer counts + "No audio" empty state → complete session → appears in list as completed.
- Integrity trigger: attempt to insert a session with mismatched client org via SQL — expect exception.
- Frequency seed: `select count(*) from frequencies` = 9; re-run migration is a no-op.
