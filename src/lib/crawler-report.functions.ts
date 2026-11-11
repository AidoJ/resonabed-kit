import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface CrawlerReport {
  weekly: Array<{ week_start: string; bot_name: string; visits: number }>;
  topPaths: Array<{ bot_name: string; path: string; visits: number; last_status: number; rank: number }>;
}

/** Platform-admin only: AI crawler visits per bot per week and top 20 paths per bot. */
export const getCrawlerReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CrawlerReport> => {
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Forbidden");
    const [weekly, top] = await Promise.all([
      context.supabase.rpc("crawler_visits_weekly"),
      context.supabase.rpc("crawler_top_paths"),
    ]);
    if (weekly.error) throw new Error(weekly.error.message);
    if (top.error) throw new Error(top.error.message);
    return {
      weekly: (weekly.data ?? []).map((r) => ({ ...r, visits: Number(r.visits) })),
      topPaths: (top.data ?? []).map((r) => ({ ...r, visits: Number(r.visits) })),
    };
  });
