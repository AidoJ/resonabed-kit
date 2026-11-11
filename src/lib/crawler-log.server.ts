import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { crawlerVisitFor } from "./crawler-log";

/** Records an AI crawler visit. Never throws: logging must not affect the page. */
export async function recordCrawlerVisit(request: Request, status: number): Promise<void> {
  try {
    const row = crawlerVisitFor(request, status);
    if (!row) return;
    const { error } = await supabaseAdmin.from("crawler_visits").insert(row);
    if (error) console.error("[crawler-log] insert failed", error.message);
  } catch (error) {
    console.error("[crawler-log] failed", error);
  }
}
