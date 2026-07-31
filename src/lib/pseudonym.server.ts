/**
 * THE single chokepoint between client identity and health data.
 *
 * Health-bearing rows (client_screenings, client_clearance_letters and their
 * revocations, client_notes, sessions) key on an opaque `pseudonym_id` — a
 * random uuid with no relationship to the person's name or any personal
 * detail. `public.clients` (identity) references that token; the health store
 * never has to name the identity table.
 *
 * Every rejoin — token -> person, person -> token — goes through this module,
 * so re-identification has one auditable place to sit when the isolation
 * mechanism (separate schema / role / database, pending legal input) is
 * decided. Do not add ad-hoc `clients` joins to health queries elsewhere.
 *
 * NOTE: `client_id` is still written on health rows during the dual-write
 * soak period. It is deliberate and reversible — reverting is dropping a
 * column, not reconstructing links. Do not rely on it in new code.
 */
type AnyClient = { from: (table: string) => any };

/** Person -> token. Throws rather than writing an orphan health row. */
export async function pseudonymForClient(client: AnyClient, clientId: string): Promise<string> {
  const { data, error } = await client
    .from("clients")
    .select("pseudonym_id")
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.pseudonym_id) {
    throw new Error("This client has no pseudonym token — the record was not written.");
  }
  return data.pseudonym_id as string;
}

/** Mints a fresh opaque token for a new client. Random only — never derived. */
export async function createPseudonym(client: AnyClient, orgId: string): Promise<string> {
  const { data, error } = await client
    .from("client_pseudonyms")
    .insert({ org_id: orgId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Token -> person. The only sanctioned re-identification path. */
export async function clientForPseudonym(
  client: AnyClient,
  pseudonymId: string,
): Promise<{ id: string; first_name: string; last_name: string } | null> {
  const { data } = await client
    .from("clients")
    .select("id, first_name, last_name")
    .eq("pseudonym_id", pseudonymId)
    .maybeSingle();
  return (data as { id: string; first_name: string; last_name: string } | null) ?? null;
}
