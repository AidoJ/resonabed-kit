import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import outsideArt from "@/assets/resonabed-brochure-v2-outside.jpg.asset.json";
import insideArt from "@/assets/resonabed-brochure-v2-inside.jpg.asset.json";
import outsideProtect from "@/assets/resonabed-brochure-v2-protect-outside.png.asset.json";
import insideProtect from "@/assets/resonabed-brochure-v2-protect-inside.png.asset.json";
import whiteLogoUrl from "@/assets/resonabed-logo-white.png";
import purpleLogo from "@/assets/resonabed-logo.png.asset.json";
import { ARTWORK_BASES, hexRgb, PANEL_IDS, type FlyerDesign, type PanelColours, type PanelId } from "./flyer-design";

const colour = (hex: string) => { const [r = 0, g = 0, b = 0] = hexRgb(hex); return rgb(r, g, b); };

async function logoBytes(url: string) {
  const res = await fetch(url); if (!res.ok) throw new Error("Logo could not be loaded");
  const blob = await res.blob(); const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image(); await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = reject; image.src = objectUrl; });
    const canvas = document.createElement("canvas"); const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Logo could not be prepared"); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return new Uint8Array(await (await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Logo conversion failed")), "image/png"))).arrayBuffer());
  } finally { URL.revokeObjectURL(objectUrl); }
}

// Supplied artwork is flattened. Each panel is recoloured by tinting its paper
// (keeps leaves and texture) and pulling dark ink toward the chosen text colour.
// The protect masks keep photographs and the eucalyptus untouched.
const PANEL_EDGES = [0, 1034, 2008, 3043];
const loaded = new Map<string, Promise<ImageData>>();
function pixels(url: string) {
  let p = loaded.get(url);
  if (!p) { p = (async () => { const img = new Image(); img.crossOrigin = "anonymous"; await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("Flyer artwork unavailable")); img.src = url; }); const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; const ctx = c.getContext("2d", { willReadFrequently: true }); if (!ctx) throw new Error("Preview unavailable"); ctx.drawImage(img, 0, 0); return ctx.getImageData(0, 0, c.width, c.height); })(); loaded.set(url, p); p.catch(() => loaded.delete(url)); }
  return p;
}
async function recolourSheet(artUrl: string, maskUrl: string, panels: PanelColours[], bases: string[]) {
  const [art, mask] = await Promise.all([pixels(artUrl), pixels(maskUrl)]);
  const { width: w, height: h } = art; const src = art.data, m = mask.data; const out = new ImageData(w, h); const d = out.data;
  const cfg = panels.map((p, k) => { const B = hexRgb(bases[k] ?? "#ffffff").map((v) => v * 255); const T = hexRgb(p.background).map((v) => v * 255); const X = hexRgb(p.text).map((v) => v * 255); const Lb = 0.2126 * (B[0] ?? 0) + 0.7152 * (B[1] ?? 0) + 0.0722 * (B[2] ?? 0); return { f: T.map((t, i) => t / Math.max(1, B[i] ?? 1)), X, hi: 0.72 * Lb }; });
  for (let y = 0; y < h; y++) for (let k = 0; k < 3; k++) {
    const c = cfg[k]; if (!c) continue; const [f0 = 1, f1 = 1, f2 = 1] = c.f; const [x0 = 0, x1v = 0, x2 = 0] = c.X; const span = c.hi - 24;
    for (let x = PANEL_EDGES[k] ?? 0, end = Math.min(w, PANEL_EDGES[k + 1] ?? w); x < end; x++) {
      const i = (y * w + x) * 4; const r = src[i] ?? 0, g = src[i + 1] ?? 0, b = src[i + 2] ?? 0;
      const L = 0.2126 * r + 0.7152 * g + 0.0722 * b; const ch = Math.max(r, g, b) - Math.min(r, g, b);
      const ink = Math.min(1, Math.max(0, (c.hi - L) / span)) * Math.min(1, Math.max(0, (60 - ch) / 20));
      const keep = (m[i] ?? 0) / 255, mix = 1 - keep;
      d[i] = (Math.min(255, r * f0) * (1 - ink) + x0 * ink) * mix + r * keep;
      d[i + 1] = (Math.min(255, g * f1) * (1 - ink) + x1v * ink) * mix + g * keep;
      d[i + 2] = (Math.min(255, b * f2) * (1 - ink) + x2 * ink) * mix + b * keep; d[i + 3] = 255;
    }
  }
  const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d")?.putImageData(out, 0, 0);
  return new Uint8Array(await (await new Promise<Blob>((res, rej) => c.toBlob((b) => b ? res(b) : rej(new Error("Preview unavailable")), "image/jpeg", 0.92))).arrayBuffer());
}
const brandLogo = new Map<string, Promise<ArrayBuffer>>();
const fetchLogo = (url: string) => { let p = brandLogo.get(url); if (!p) { p = fetch(url).then((r) => { if (!r.ok) throw new Error("Logo unavailable"); return r.arrayBuffer(); }); brandLogo.set(url, p); p.catch(() => brandLogo.delete(url)); } return p; };

export interface FlyerIdentity { name: string; email: string; website: string; bookingUrl: string; logoUrl: string; }
export async function buildPanelFlyer(design: FlyerDesign, identity: FlyerIdentity, print = false): Promise<Blob> {
  // Supplied brochure artwork (flattened). Each sheet includes bleed and crop
  // marks; the middle outside panel is a cleared area for clinic details.
  const SW = 876.24, SH = 629.52, M = (SW - 841.92) / 2, P = 841.92 / 3;
  const PX = SW / 3043;
  const out = await PDFDocument.create();
  const ids = (side: number) => PANEL_IDS.slice(side * 3, side * 3 + 3) as PanelId[];
  const sheetBytes = await Promise.all([[outsideArt.url, outsideProtect.url], [insideArt.url, insideProtect.url]].map(([a, m], side) => recolourSheet(a ?? "", m ?? "", ids(side).map((id) => design.panels[id]), ids(side).map((id) => ARTWORK_BASES[id]))));
  const sheets = await Promise.all(sheetBytes.map((b) => out.embedJpg(b)));
  const pages = sheets.map((img) => { const pg = out.addPage([SW, SH]); pg.drawImage(img, { x: 0, y: 0, width: SW, height: SH }); pg.setTrimBox(M, M, SW - 2 * M, SH - 2 * M); pg.setBleedBox(0, 0, SW, SH); if (!print) pg.setCropBox(M, M, SW - 2 * M, SH - 2 * M); return pg; });
  // Resonabed logos at their true proportions, in the boxes the artwork used.
  const [whiteImg, purpleImg] = await Promise.all([fetchLogo(whiteLogoUrl).then((b) => out.embedPng(b)), fetchLogo(purpleLogo.url).then((b) => out.embedPng(b))]);
  const placeLogo = (pg: typeof pages[number] | undefined, img: typeof whiteImg, box: [number, number, number, number], panel: PanelColours) => {
    if (!pg) return; const [px0, py0, px1, py1] = box; const bw = (px1 - px0) * PX, bh = (py1 - py0) * PX;
    const s = Math.min(bw / img.width, bh / img.height); const w = img.width * s, hh = img.height * s;
    const cx = (px0 + px1) / 2 * PX, cy = SH - (py0 + py1) / 2 * PX;
    if (panel.logoBacking) { const pad = Math.max(w, hh) * 0.16; pg.drawRectangle({ x: cx - w / 2 - pad, y: cy - hh / 2 - pad, width: w + pad * 2, height: hh + pad * 2, color: colour(panel.box) }); }
    pg.drawImage(img, { x: cx - w / 2, y: cy - hh / 2, width: w, height: hh });
  };
  placeLogo(pages[0], whiteImg, [2293, 141, 2750, 504], design.panels.F3);
  placeLogo(pages[1], purpleImg, [415, 1812, 637, 2001], design.panels.B1);
  const page = pages[0]; if (!page) throw new Error("Missing outside page");
  const c = design.panels.F2;
  out.registerFontkit(fontkit);
  const fonts = await Promise.all([fetch("/fonts/LiberationSans-Bold.ttf").then((r) => r.arrayBuffer()), fetch("/fonts/LiberationSans-Regular.ttf").then((r) => r.arrayBuffer())]);
  const bold = await out.embedFont(fonts[0] ?? new ArrayBuffer(0), { subset: true }); const regular = await out.embedFont(fonts[1] ?? new ArrayBuffer(0), { subset: true });
  const cx = M + P * 1.5, maxW = P - 50;
  const top = (y: number) => SH - y;
  const centred = (text: string, y: number, size: number, font: typeof bold, hex: string) => { const s = Math.min(size, maxW / Math.max(1, font.widthOfTextAtSize(text, 1))); page.drawText(text, { x: cx - font.widthOfTextAtSize(text, s) / 2, y, size: s, font, color: colour(hex) }); };
  if (identity.logoUrl) {
    const img = await out.embedPng(await logoBytes(identity.logoUrl)); const scale = Math.min(150 / img.width, 140 / img.height);
    const w = img.width * scale, h = img.height * scale;
    if (c.logoBacking) { const pad = 10; page.drawRectangle({ x: cx - w / 2 - pad, y: top(40) - 140 + (140 - h) / 2 - pad, width: w + pad * 2, height: h + pad * 2, color: colour(c.box) }); }
    page.drawImage(img, { x: cx - w / 2, y: top(40) - 140 + (140 - h) / 2, width: w, height: h });
  }
  page.drawLine({ start: { x: cx - 50, y: top(222) }, end: { x: cx + 50, y: top(222) }, thickness: 0.6, color: colour(c.accent) });
  const words = identity.name.trim().split(/\s+/).filter(Boolean); const lines: string[] = []; let line = "";
  for (const word of words) { const cand = line ? `${line} ${word}` : word; if (bold.widthOfTextAtSize(cand, 12) > maxW && line) { lines.push(line); line = word; } else line = cand; } if (line) lines.push(line);
  let y = top(252);
  for (const t of lines.slice(0, 2)) { centred(t, y, 12, bold, c.text); y -= 15; }
  y -= 10;
  for (const t of [design.phone, identity.email, identity.website].filter(Boolean)) { centred(t, y, 11, regular, c.text); y -= 26; }
  page.drawLine({ start: { x: cx - 50, y: top(352) }, end: { x: cx + 50, y: top(352) }, thickness: 0.6, color: colour(c.accent) });
  if (identity.bookingUrl) {
    const url = await QRCode.toDataURL(identity.bookingUrl, { margin: 2, scale: 8 });
    const encoded = url.split(",")[1]; if (!encoded) throw new Error("Booking code unavailable");
    const qr = await out.embedPng(Uint8Array.from(atob(encoded), (s) => s.charCodeAt(0)));
    page.drawImage(qr, { x: cx - 38, y: top(470), width: 76, height: 76 });
    centred("Book Now", top(492), 14, bold, c.accent);
  }
  return new Blob([await out.save() as BlobPart], { type: "application/pdf" });
}
