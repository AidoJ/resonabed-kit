import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  SCREENING_CHECKLIST,
  SCREENING_CHECKLIST_VERSION,
  SCREENING_ATTESTATION_TEXT,
  isClearableItem,
} from "@/lib/screening-checklist";

const uuid = z.string().uuid();

async function callerOrgId(context: {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}) {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("org_id")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.org_id) throw new Error("No organisation assigned to your profile");
  return data.org_id as string;
}

// ---------- Context for the screening step ----------

export const getScreeningContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { client_id: string }) => z.object({ client_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const orgId = await callerOrgId(context);

    const [orgRes, letterRes, revRes, priorRes] = await Promise.all([
      context.supabase
        .from("organisations")
        .select("id, name, consent_text, health_policy_text, privacy_policy_text, consent_version")
        .eq("id", orgId)
        .maybeSingle(),
      context.supabase
        .from("client_clearance_letters")
        .select("id, item_key, issuer_name, issued_on, file_path, notes, created_at")
        .eq("client_id", data.client_id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("client_clearance_letter_revocations")
        .select("id, letter_id, reason, created_at"),
      context.supabase
        .from("client_screenings")
        .select("id, created_at, response, flagged_items, outcome")
        .eq("client_id", data.client_id)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    if (orgRes.error) throw new Error(orgRes.error.message);
    if (letterRes.error) throw new Error(letterRes.error.message);
    if (revRes.error) throw new Error(revRes.error.message);
    if (priorRes.error) throw new Error(priorRes.error.message);

    const revocations = new Map(
      (revRes.data ?? []).map((r) => [r.letter_id as string, r]),
    );
    const letters = (letterRes.data ?? []).map((l) => {
      const rev = revocations.get(l.id as string);
      return {
        ...l,
        revoked_at: (rev?.created_at as string | undefined) ?? null,
        revoked_reason: (rev?.reason as string | undefined) ?? null,
      };
    });

    // Effective clearances: an active (non-revoked) letter for a clearable item.
    const cleared_items = Array.from(
      new Set(
        letters
          .filter((l) => !l.revoked_at && isClearableItem(l.item_key as string))
          .map((l) => l.item_key as string),
      ),
    );

    return {
      org: orgRes.data,
      checklist: SCREENING_CHECKLIST,
      checklist_version: SCREENING_CHECKLIST_VERSION,
      attestation_text: SCREENING_ATTESTATION_TEXT,
      letters,
      cleared_items,
      prior_screening: priorRes.data?.[0] ?? null,
    };
  });

// ---------- Submit a signed screening (append-only) ----------

const submitInput = z.object({
  client_id: uuid,
  booking_id: uuid.nullable().optional(),
  none_apply: z.boolean(),
  flagged_items: z.array(z.string().max(60)).max(20),
  practitioner_notes: z.string().max(4000).optional(),
  client_signature: z.string().min(20).max(2_000_000),
  practitioner_signature: z.string().min(20).max(2_000_000),
  is_reattestation: z.boolean().optional(),
  prior_screening_id: uuid.nullable().optional(),
});

export const submitScreening = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => submitInput.parse(d))
  .handler(async ({ data, context }) => {
    const orgId = await callerOrgId(context);

    // "None of these apply" is a stored affirmative attestation and must be
    // mutually exclusive with flagged items. Absence of a row is a different
    // state entirely (nobody answered) and never looks the same.
    const flagged = Array.from(new Set(data.flagged_items));
    if (data.none_apply && flagged.length > 0) {
      throw new Error("Untick 'None of these apply' before flagging an item.");
    }
    if (!data.none_apply && flagged.length === 0) {
      throw new Error(
        "The screening must be answered — either tick the items that apply or confirm 'None of these apply'.",
      );
    }
    const unknown = flagged.filter((f) => !SCREENING_CHECKLIST.some((i) => i.key === f));
    if (unknown.length) throw new Error(`Unknown screening item: ${unknown.join(", ")}`);

    // Recompute clearances server-side — never trust the client.
    const cleared: Record<string, string> = {};
    const blocking: string[] = [];
    for (const item of flagged) {
      if (!isClearableItem(item)) {
        blocking.push(item); // e.g. pregnancy — never clearable by any path
        continue;
      }
      const { data: letters, error } = await context.supabase
        .from("client_clearance_letters")
        .select("id, created_at")
        .eq("client_id", data.client_id)
        .eq("item_key", item)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      let clearedBy: string | null = null;
      for (const l of letters ?? []) {
        const { data: rev, error: rErr } = await context.supabase
          .from("client_clearance_letter_revocations")
          .select("id")
          .eq("letter_id", l.id)
          .maybeSingle();
        if (rErr) throw new Error(rErr.message);
        if (!rev) {
          clearedBy = l.id as string;
          break;
        }
      }
      if (clearedBy) cleared[item] = clearedBy;
      else blocking.push(item);
    }

    const { data: org, error: oErr } = await context.supabase
      .from("organisations")
      .select("name, consent_text, health_policy_text, privacy_policy_text, consent_version")
      .eq("id", orgId)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);

    const { pseudonymForClient } = await import("@/lib/pseudonym.server");
    const outcome = blocking.length > 0 ? "blocked" : "cleared";
    const now = new Date().toISOString();

    const { data: row, error } = await context.supabase
      .from("client_screenings")
      .insert({
        org_id: orgId,
        client_id: data.client_id,
        pseudonym_id: await pseudonymForClient(context.supabase, data.client_id),
        practitioner_id: context.userId,
        booking_id: data.booking_id ?? null,
        checklist_version: SCREENING_CHECKLIST_VERSION,
        // Self-contained snapshot: survives org text edits and org deletion.
        checklist_snapshot: {
          version: SCREENING_CHECKLIST_VERSION,
          items: SCREENING_CHECKLIST.map((i) => ({ ...i })),
          attestation_text: SCREENING_ATTESTATION_TEXT,
        },
        org_name_snapshot: org?.name ?? null,
        consent_text_snapshot: org?.consent_text ?? "",
        health_text_snapshot: org?.health_policy_text ?? null,
        privacy_text_snapshot: org?.privacy_policy_text ?? null,
        consent_version: org?.consent_version ?? null,
        response: data.none_apply ? "none_apply" : "items_flagged",
        none_apply: data.none_apply,
        flagged_items: flagged,
        blocking_items: blocking,
        cleared_items: cleared,
        outcome,
        practitioner_notes: data.practitioner_notes ?? null,
        client_signature: data.client_signature,
        client_signed_at: now,
        practitioner_signature: data.practitioner_signature,
        practitioner_signed_at: now,
        is_reattestation: data.is_reattestation ?? false,
        prior_screening_id: data.prior_screening_id ?? null,
      })
      .select("id, outcome, blocking_items, cleared_items")
      .single();
    if (error) throw new Error(error.message);
    return row as {
      id: string;
      outcome: "cleared" | "blocked";
      blocking_items: string[];
      cleared_items: Record<string, string>;
    };
  });

// ---------- Auditable refusal ----------

/**
 * A blocked screening is not a therapist quietly backing out of the wizard —
 * it writes a cancelled session carrying the screening id and a decline
 * reason, so the refusal is a recorded clinical event.
 */
export const declineSessionForScreening = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        screening_id: uuid,
        service_id: uuid.nullable().optional(),
        booking_id: uuid.nullable().optional(),
        notes: z.string().max(4000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: screening, error: sErr } = await context.supabase
      .from("client_screenings")
      .select("id, org_id, client_id, pseudonym_id, outcome, blocking_items, practitioner_notes")
      .eq("id", data.screening_id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!screening) throw new Error("Screening not found");

    const { data: session, error } = await context.supabase
      .from("sessions")
      .insert({
        org_id: screening.org_id,
        client_id: screening.client_id,
        pseudonym_id: screening.pseudonym_id,
        practitioner_id: context.userId,
        service_id: data.service_id ?? null,
        screening_id: screening.id,
        decline_reason: "contraindication_flagged",
        status: "cancelled",
        consent_given: true,
        body_areas: [],
        primary_goals: [],
        health_concerns: [],
        contraindications: screening.blocking_items ?? [],
        practitioner_notes: data.notes ?? null,
        recommended_frequency_id: null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (data.booking_id) {
      await context.supabase
        .from("bookings")
        .update({ status: "cancelled", session_id: session.id })
        .eq("id", data.booking_id);
    }
    return { session_id: session.id };
  });

// ---------- Clearance letters ----------

export const recordClearanceLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        client_id: uuid,
        item_key: z.string().min(1).max(60),
        issuer_name: z.string().min(2).max(160),
        issued_on: z.string().max(20).nullable().optional(),
        file_path: z.string().max(500).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const orgId = await callerOrgId(context);
    if (!isClearableItem(data.item_key)) {
      throw new Error(
        "This item can never be cleared by a doctor's letter — it must be re-screened each session.",
      );
    }
    const { pseudonymForClient } = await import("@/lib/pseudonym.server");
    const { data: row, error } = await context.supabase
      .from("client_clearance_letters")
      .insert({
        org_id: orgId,
        client_id: data.client_id,
        pseudonym_id: await pseudonymForClient(context.supabase, data.client_id),
        item_key: data.item_key,
        issuer_name: data.issuer_name,
        issued_on: data.issued_on || null,
        file_path: data.file_path || null,
        notes: data.notes || null,
        recorded_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Append-only neutralisation. A reason is mandatory; nothing is deleted. */
export const revokeClearanceLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ letter_id: uuid, reason: z.string().min(5).max(1000) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const orgId = await callerOrgId(context);
    const { data: letter } = await context.supabase
      .from("client_clearance_letters")
      .select("pseudonym_id")
      .eq("id", data.letter_id)
      .maybeSingle();
    if (!letter?.pseudonym_id) throw new Error("That clearance letter could not be found.");
    const letterPseudonym = letter.pseudonym_id;
    const { error } = await context.supabase
      .from("client_clearance_letter_revocations")
      .insert({
        letter_id: data.letter_id,
        org_id: orgId,
        pseudonym_id: letterPseudonym,
        reason: data.reason.trim(),
        revoked_by: context.userId,
      });
    if (error) {
      if (error.code === "23505") throw new Error("This letter has already been revoked.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const getClearanceLetterUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { letter_id: string }) => z.object({ letter_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("client_clearance_letters")
      .select("file_path")
      .eq("id", data.letter_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.file_path) throw new Error("No file attached to this letter");
    const { data: signed, error: sErr } = await context.supabase.storage
      .from("clearance-letters")
      .createSignedUrl(row.file_path, 600);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl };
  });

// ---------- Reading the record ----------

export const listClientScreenings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { client_id: string }) => z.object({ client_id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("client_screenings")
      .select(
        "id, created_at, response, none_apply, flagged_items, blocking_items, cleared_items, outcome, checklist_version, is_reattestation",
      )
      .eq("client_id", data.client_id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getScreeningRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("client_screenings")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Screening not found");
    return row;
  });
