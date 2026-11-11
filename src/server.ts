import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { detectLoggedBot } from "./lib/crawler-log";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Long-lived caching ("Expires headers") for fixed-URL static files in /public.
// Build-fingerprinted assets and CDN assets already carry immutable caching; these
// few files sit at stable paths and ship without any cache-control today.
const STATIC_CACHE_RULES: Array<{ test: RegExp; value: string }> = [
  // Fonts never change content at these paths.
  { test: /^\/fonts\/[^/]+\.(?:ttf|otf|woff2?)$/i, value: "public, max-age=31536000, immutable" },
  // Icons / manifest may be swapped occasionally: cache a week, revalidate after.
  {
    test: /^\/(?:favicon\.png|icon-192\.png|icon-512\.png|apple-touch-icon\.png|manifest\.json)$/i,
    value: "public, max-age=604800, stale-while-revalidate=86400",
  },
  { test: /^\/robots\.txt$/i, value: "public, max-age=86400" },
];

function withStaticCacheHeaders(request: Request, response: Response): Response {
  if (request.method !== "GET" && request.method !== "HEAD") return response;
  if (!response.ok) return response;

  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return response;
  }

  const rule = STATIC_CACHE_RULES.find((r) => r.test.test(pathname));
  if (!rule) return response;

  const existing = response.headers.get("cache-control");
  if (existing && !/no-cache|no-store|max-age=0/i.test(existing)) return response;

  const headers = new Headers(response.headers);
  headers.set("cache-control", rule.value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// AI crawler log: runs after the response is ready and never delays it.
// The worker keeps the insert alive via waitUntil; elsewhere it is fire-and-forget.
function logCrawlerVisitInBackground(request: Request, status: number, ctx: unknown) {
  const ua = request.headers.get("user-agent");
  if (!ua || !detectLoggedBot(ua)) return; // cheap check: humans pay nothing
  const task = import("./lib/crawler-log.server")
    .then((m) => m.recordCrawlerVisit(request, status))
    .catch((error) => console.error("[crawler-log]", error));
  const waitUntil = (ctx as { waitUntil?: (p: Promise<unknown>) => void } | null)?.waitUntil;
  if (typeof waitUntil === "function") waitUntil.call(ctx, task);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const finalResponse = withStaticCacheHeaders(
        request,
        await normalizeCatastrophicSsrResponse(response),
      );
      logCrawlerVisitInBackground(request, finalResponse.status, ctx);
      return finalResponse;
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

