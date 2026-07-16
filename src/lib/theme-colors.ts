// Client-side utilities for org branding: hex validation, contrast checks,
// palette extraction from an uploaded logo image.

export const DEFAULT_THEME = {
  primary: "#884bc7",
  sidebar: "#26106c",
  accent: "#ede4f6",
} as const;

export function isHex6(v: string | null | undefined): v is string {
  return !!v && /^#[0-9a-fA-F]{6}$/.test(v);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

// Relative luminance per WCAG.
export function relLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// Best readable text (white or near-black) on a given background.
export function textOn(bg: string): "#ffffff" | "#100a2e" {
  return contrastRatio(bg, "#ffffff") >= contrastRatio(bg, "#100a2e") ? "#ffffff" : "#100a2e";
}

// RGB -> HSL for saturation / lightness filtering.
function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}

/**
 * Extract up to `count` candidate palette colours from an image URL.
 * Picks the most frequent non-neutral, non-transparent colours after
 * quantising to a coarse RGB grid.
 */
export async function extractPalette(imageUrl: string, count = 6): Promise<string[]> {
  const img = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  const maxSide = 96;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const buckets = new Map<string, { r: number; g: number; b: number; n: number; sat: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 200) continue;
    const { s, l } = rgbToHsl(r, g, b);
    // Skip near-neutrals and near-black/white.
    if (s < 0.2) continue;
    if (l < 0.08 || l > 0.92) continue;
    // Quantise to a coarse grid to group similar colours.
    const qr = Math.round(r / 24) * 24;
    const qg = Math.round(g / 24) * 24;
    const qb = Math.round(b / 24) * 24;
    const key = `${qr},${qg},${qb}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.r += r; existing.g += g; existing.b += b; existing.n += 1;
    } else {
      buckets.set(key, { r, g, b, n: 1, sat: s });
    }
  }

  const ranked = [...buckets.values()]
    .map((v) => ({
      hex: rgbToHex(v.r / v.n, v.g / v.n, v.b / v.n),
      score: v.n * (0.5 + v.sat),
    }))
    .sort((a, b) => b.score - a.score);

  // De-duplicate very similar hexes.
  const chosen: string[] = [];
  for (const c of ranked) {
    if (chosen.every((h) => colorDist(h, c.hex) > 40)) chosen.push(c.hex);
    if (chosen.length >= count) break;
  }
  return chosen;
}

function colorDist(a: string, b: string) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return Math.sqrt((A.r - B.r) ** 2 + (A.g - B.g) ** 2 + (A.b - B.b) ** 2);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
