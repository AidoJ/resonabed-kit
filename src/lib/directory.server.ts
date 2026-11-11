/**
 * Server-only reads for the public clinic directory. Uses a session-free
 * publishable-key client and the get_public_directory database function, which
 * only returns published, active clinics that switched on "List my clinic in
 * the directory".
 */
export type DirectoryClinic = {
  slug: string;
  name: string;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  telephone: string | null;
  updated_at: string;
};

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        // Opaque sb_ keys are not JWTs; send apikey without the default bearer.
        if (key.startsWith("sb_") && headers.get("Authorization") === "Bearer " + key) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** Every listed clinic, paginated to the end. Throws on any query error. */
export async function fetchDirectoryClinics(): Promise<DirectoryClinic[]> {
  const supabase = await publicClient();
  const pageSize = 1000;
  const out: DirectoryClinic[] = [];
  for (let offset = 0; ; ) {
    const { data, error } = await supabase
      .rpc("get_public_directory", {})
      .order("slug")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Directory query failed: ${error.message}`);
    const rows = (data ?? []) as DirectoryClinic[];
    if (rows.length === 0) break;
    out.push(...rows);
    offset += rows.length;
    if (rows.length < pageSize) break;
  }
  return out;
}

/** One listed clinic, or null when the clinic is not in the directory. */
export async function fetchDirectoryClinic(slug: string): Promise<DirectoryClinic | null> {
  const supabase = await publicClient();
  const { data, error } = await supabase.rpc("get_public_directory", { p_slug: slug });
  if (error) throw new Error(`Directory query failed: ${error.message}`);
  return ((data ?? []) as DirectoryClinic[])[0] ?? null;
}
