// AI crawler visit detection. Pure helpers, shared by the server entry and tests.

/** AI bots the owner wants logged. More specific names come first. */
export const LOGGED_BOTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "Perplexity-User",
  "PerplexityBot",
] as const;

export type LoggedBot = (typeof LOGGED_BOTS)[number];

const NEVER_LOGGED = /googlebot|bingbot|google-|adsbot|mediapartners|bingpreview/i;

/** Returns the AI bot named in a user-agent, or null for humans, Google, Bing and others. */
export function detectLoggedBot(userAgent: string | null | undefined): LoggedBot | null {
  if (!userAgent) return null;
  if (NEVER_LOGGED.test(userAgent)) return null;
  const ua = userAgent.toLowerCase();
  for (const bot of LOGGED_BOTS) {
    if (ua.includes(bot.toLowerCase())) return bot;
  }
  return null;
}

/** Private areas (same list robots.txt disallows). Visits here are never logged. */
const PRIVATE_PREFIXES = [
  "/auth",
  "/reset-password",
  "/forgot-password",
  "/offer",
  "/order",
  "/api",
  "/lovable",
  "/dashboard",
  "/admin",
  "/audio",
  "/availability",
  "/bookings",
  "/change-password",
  "/clients",
  "/crm",
  "/frequencies",
  "/help",
  "/profile",
  "/services",
  "/sessions",
  "/table-setup",
  "/home",
];

/** True for public page paths (plus the sitemap); false for private areas, app internals and files. */
export function isPublicPagePath(pathname: string): boolean {
  if (!pathname.startsWith("/")) return false;
  if (pathname === "/sitemap.xml") return true;
  if (pathname.startsWith("/_") || pathname.startsWith("/@") || pathname.startsWith("/assets/")) {
    return false;
  }
  if (pathname.startsWith("/src/") || pathname.startsWith("/node_modules/")) return false;
  // Files (images, scripts, fonts, robots.txt…) are not pages.
  const last = pathname.split("/").pop() ?? "";
  if (last.includes(".")) return false;
  const lower = pathname.toLowerCase();
  return !PRIVATE_PREFIXES.some((p) => lower === p || lower.startsWith(`${p}/`));
}

/** Decides whether a request should be logged; returns the row to insert or null. */
export function crawlerVisitFor(
  request: Request,
  status: number,
): { bot_name: LoggedBot; path: string; status_code: number } | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const bot = detectLoggedBot(request.headers.get("user-agent"));
  if (!bot) return null;
  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return null;
  }
  if (!isPublicPagePath(pathname)) return null;
  // Only the path is stored, never the query string.
  return { bot_name: bot, path: pathname.slice(0, 300), status_code: status };
}
