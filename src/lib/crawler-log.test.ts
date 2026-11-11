import { describe, expect, it } from "vitest";
import { crawlerVisitFor, detectLoggedBot, isPublicPagePath } from "./crawler-log";

const req = (path: string, ua: string, method = "GET") =>
  new Request(`https://resonabed.com${path}`, { method, headers: { "user-agent": ua } });

describe("AI crawler detection", () => {
  it("logs each of the eight named AI bots", () => {
    const cases: Array<[string, string]> = [
      ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)", "GPTBot"],
      ["Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)", "OAI-SearchBot"],
      ["Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)", "ChatGPT-User"],
      ["Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)", "ClaudeBot"],
      ["Mozilla/5.0 (compatible; Claude-SearchBot/1.0)", "Claude-SearchBot"],
      ["Mozilla/5.0 (compatible; Claude-User/1.0)", "Claude-User"],
      ["Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)", "PerplexityBot"],
      ["Mozilla/5.0 (compatible; Perplexity-User/1.0)", "Perplexity-User"],
    ];
    for (const [ua, bot] of cases) expect(detectLoggedBot(ua)).toBe(bot);
  });

  it("never logs Google, Bing or people", () => {
    expect(detectLoggedBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBeNull();
    expect(detectLoggedBot("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)")).toBeNull();
    expect(detectLoggedBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1")).toBeNull();
    expect(detectLoggedBot(null)).toBeNull();
  });
});

describe("public pages only", () => {
  it("logs public pages and the sitemap", () => {
    for (const p of ["/", "/research", "/practitioners", "/o/cellularwellbeing", "/sitemap.xml"]) {
      expect(isPublicPagePath(p)).toBe(true);
    }
  });

  it("skips private areas, app internals and files", () => {
    for (const p of ["/admin/metrics", "/home", "/home/login", "/auth", "/dashboard", "/_serverFn/abc", "/api/public/x", "/robots.txt", "/logo.png"]) {
      expect(isPublicPagePath(p)).toBe(false);
    }
  });

  it("stores the bot, path without query string and status code", () => {
    expect(crawlerVisitFor(req("/research?utm=x", "GPTBot/1.2"), 200)).toEqual({
      bot_name: "GPTBot",
      path: "/research",
      status_code: 200,
    });
    expect(crawlerVisitFor(req("/research", "GPTBot/1.2", "POST"), 200)).toBeNull();
  });
});
