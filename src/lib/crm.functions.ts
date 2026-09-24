import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const LEAD_STAGES = ["new", "contacted", "demo_booked", "won", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  demo_booked: "Demo booked",
  won: "Won",
  lost: "Lost",
};

export interface LeadRow {
  id: string;
  reference: string;
  name: string;
  email: string;
  practice: string;
  suburb: string;
  phone: string | null;
  stage: LeadStage;
  ownerId: string | null;
  ownerName: string | null;
  nextFollowUpOn: string | null;
  lostReason: string | null;
  utm: string | null;
  createdAt: string;
}

export interface LeadEvent {
  id: string;
  type: "note" | "stage_change" | "assignment";
  body: string | null;
  fromStage: LeadStage | null;
  toStage: LeadStage | null;
  actorName: string | null;
  createdAt: string;
}

export interface LeadOwner {
  id: string;
  name: string;
}

async function assertSuperAdmin(supabase: any, userId: string) {
  const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (!isSuper) throw new Error("Forbidden");
}

function mapRow(r: any, ownerNames: Map<string, string>): LeadRow {
  const attribution = [r.utm_source, r.utm_medium, r.utm_campaign, r.utm_content]
    .filter(Boolean)
    .join(" / ");
  return {
    id: r.id,
    reference: r.reference,
    name: r.name,
    email: r.email,
    practice: r.practice,
    suburb: r.suburb,
    phone: r.phone,
    stage: (r.stage ?? "new") as LeadStage,
    ownerId: r.owner_id,
    ownerName: r.owner_id ? (ownerNames.get(r.owner_id) ?? null) : null,
    nextFollowUpOn: r.next_follow_up_on,
    lostReason: r.lost_reason,
    utm: attribution || null,
    createdAt: r.created_at,
  };
}

async function listOwners(supabase: any): Promise<LeadOwner[]> {
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin");
  const ids = (roleRows ?? []).map((r: any) => r.user_id as string);
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids);
  return (profiles ?? [])
    .map((p: any) => ({ id: p.id as string, name: (p.display_name as string) || "Platform admin" }))
    .sort((a: LeadOwner, b: LeadOwner) => a.name.localeCompare(b.name));
}

export const listDemoLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const [{ data: rows, error }, owners] = await Promise.all([
      supabase
        .from("demo_enquiries")
        .select(
          "id, reference, name, email, practice, suburb, phone, stage, owner_id, next_follow_up_on, lost_reason, utm_source, utm_medium, utm_campaign, utm_content, created_at",
        )
        .order("created_at", { ascending: false }),
      listOwners(supabase),
    ]);
    if (error) throw new Error(error.message);

    const ownerNames = new Map(owners.map((o) => [o.id, o.name]));
    return {
      rows: (rows ?? []).map((r: any) => mapRow(r, ownerNames)),
      owners,
      today: new Date().toISOString().slice(0, 10),
    };
  });

export const getDemoLead = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const { data: row, error } = await supabase
      .from("demo_enquiries")
      .select(
        "id, reference, name, email, practice, suburb, phone, stage, owner_id, next_follow_up_on, lost_reason, utm_source, utm_medium, utm_campaign, utm_content, created_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Enquiry not found");

    const owners = await listOwners(supabase);
    const ownerNames = new Map(owners.map((o) => [o.id, o.name]));

    const { data: events } = await supabase
      .from("demo_enquiry_events")
      .select("id, type, body, from_stage, to_stage, actor_name, created_at")
      .eq("enquiry_id", data.id)
      .order("created_at", { ascending: false });

    return {
      lead: mapRow(row, ownerNames),
      owners,
      events: (events ?? []).map(
        (e: any): LeadEvent => ({
          id: e.id,
          type: e.type,
          body: e.body,
          fromStage: e.from_stage,
          toStage: e.to_stage,
          actorName: e.actor_name,
          createdAt: e.created_at,
        }),
      ),
    };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  stage: z.enum(LEAD_STAGES),
  ownerId: z.string().uuid().nullable(),
  nextFollowUpOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  lostReason: z.string().trim().max(500).nullable(),
});

export const updateDemoLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const { data: current, error: readError } = await supabase
      .from("demo_enquiries")
      .select("stage, owner_id")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!current) throw new Error("Enquiry not found");

    if (data.stage === "lost" && !data.lostReason?.trim()) {
      throw new Error("Please add a short reason when marking an enquiry lost.");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    const actorName = (profile?.display_name as string) || "Platform admin";

    const { error: updateError } = await supabase
      .from("demo_enquiries")
      .update({
        stage: data.stage,
        owner_id: data.ownerId,
        next_follow_up_on: data.nextFollowUpOn,
        lost_reason: data.stage === "lost" ? data.lostReason?.trim() || null : null,
      })
      .eq("id", data.id);
    if (updateError) throw new Error(updateError.message);

    type EventInsert = {
      enquiry_id: string;
      type: string;
      from_stage?: string | null;
      to_stage?: string | null;
      body?: string | null;
      actor_id: string;
      actor_name: string;
    };
    const events: EventInsert[] = [];
    if (current.stage !== data.stage) {
      events.push({
        enquiry_id: data.id,
        type: "stage_change",
        from_stage: current.stage,
        to_stage: data.stage,
        body: data.stage === "lost" ? data.lostReason?.trim() || null : null,
        actor_id: userId,
        actor_name: actorName,
      });
    }
    if (current.owner_id !== data.ownerId) {
      events.push({
        enquiry_id: data.id,
        type: "assignment",
        actor_id: userId,
        actor_name: actorName,
      });
    }
    if (events.length > 0) {
      await supabase.from("demo_enquiry_events").insert(events);
    }

    return { saved: true as const };
  });

export const addDemoLeadNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; body: string }) =>
    z
      .object({
        id: z.string().uuid(),
        body: z.string().trim().min(1, "Write a note first.").max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();

    const { error } = await supabase.from("demo_enquiry_events").insert({
      enquiry_id: data.id,
      type: "note",
      body: data.body,
      actor_id: userId,
      actor_name: (profile?.display_name as string) || "Platform admin",
    });
    if (error) throw new Error(error.message);

    return { saved: true as const };
  });

export const deleteDemoLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const { data: deleted, error } = await supabase
      .from("demo_enquiries")
      .delete()
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deleted) throw new Error("Enquiry not found or could not be deleted");

    return { deleted: true as const };
  });

export const getDemoLeadSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);

    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [newThisWeek, due, overdue] = await Promise.all([
      supabase
        .from("demo_enquiries")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo),
      supabase
        .from("demo_enquiries")
        .select("id", { count: "exact", head: true })
        .eq("next_follow_up_on", today)
        .not("stage", "in", '("won","lost")'),
      supabase
        .from("demo_enquiries")
        .select("id", { count: "exact", head: true })
        .lt("next_follow_up_on", today)
        .not("stage", "in", '("won","lost")'),
    ]);

    return {
      newThisWeek: newThisWeek.count ?? 0,
      dueToday: due.count ?? 0,
      overdue: overdue.count ?? 0,
    };
  });
