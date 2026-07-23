import { createServerFn } from "@tanstack/react-start";

export const getGoogleMapsBrowserConfig = createServerFn({ method: "GET" }).handler(async () => {
  const apiKey = process.env.GOOGLE_MAPS_BROWSER_KEY;
  return {
    configured: Boolean(apiKey),
    apiKey: apiKey ?? null,
  };
});