import { z } from "zod";

export const PANEL_IDS = ["F1", "F2", "F3", "B1", "B2", "B3"] as const;
export type PanelId = (typeof PANEL_IDS)[number];
export const PANEL_NAMES: Record<PanelId, string> = { F1: "What to expect & questions", F2: "Clinic details", F3: "Front cover", B1: "What it is", B2: "The experience", B3: "Why people come back" };
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const panelColoursSchema = z.object({ background: hex, accent: hex, text: hex, box: hex, boxText: hex }).strict();
export type PanelColours = z.infer<typeof panelColoursSchema>;
export const flyerDesignSchema = z.object({
  version: z.literal(1),
  phone: z.string().trim().max(60),
  logoPath: z.string().max(400).nullable(),
  panels: z.object({ F1: panelColoursSchema, F2: panelColoursSchema, F3: panelColoursSchema, B1: panelColoursSchema, B2: panelColoursSchema, B3: panelColoursSchema }).strict(),
}).strict();
export type FlyerDesign = z.infer<typeof flyerDesignSchema>;

// Artwork values, not application theme colours.
export const ARTWORK_COLOURS = { red: "#d64354", white: "#ffffff", black: "#000000" };
export function defaultFlyerDesign(phone = "", logoPath: string | null = null): FlyerDesign {
  const panels = Object.fromEntries(PANEL_IDS.map((id) => [id, { background: id === "F3" ? ARTWORK_COLOURS.red : ARTWORK_COLOURS.white, accent: ARTWORK_COLOURS.red, text: id === "F3" ? ARTWORK_COLOURS.white : ARTWORK_COLOURS.black, box: ARTWORK_COLOURS.black, boxText: ARTWORK_COLOURS.white }])) as Record<PanelId, PanelColours>;
  return { version: 1, phone, logoPath, panels };
}
export function readFlyerDesign(value: unknown, phone = "", logoPath: string | null = null) {
  const result = flyerDesignSchema.safeParse(value);
  return result.success ? result.data : defaultFlyerDesign(phone, logoPath);
}
export function rgbHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0")).join("")}`;
}
export function hexRgb(value: string) { return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255); }
export function contrast(a: string, b: string) {
  const lum = (hex: string) => hexRgb(hex).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4).reduce((v, n, i) => v + n * ([0.2126, 0.7152, 0.0722][i] ?? 0), 0);
  return (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
}
export function readableInk(background: string) { return contrast(background, ARTWORK_COLOURS.white) > contrast(background, ARTWORK_COLOURS.black) ? ARTWORK_COLOURS.white : ARTWORK_COLOURS.black; }
export function paletteVariants(base: string) {
  const parts = hexRgb(base).map((n) => n * 255);
  const mix = (amount: number, target: number) => rgbHex(...parts.map((n) => n * (1 - amount) + target * amount) as [number, number, number]);
  return [mix(0.65, 0), base, mix(0.88, 255)];
}
export function applyPalette(design: FlyerDesign, base: string): FlyerDesign {
  const [dark = base, main = base, light = base] = paletteVariants(base);
  return { ...design, panels: Object.fromEntries(PANEL_IDS.map((id) => {
    const background = id === "F3" ? main : light;
    return [id, { background, accent: id === "F3" ? readableInk(background) : dark, text: readableInk(background), box: dark, boxText: readableInk(dark) }];
  })) as Record<PanelId, PanelColours> };
}