import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import outsideArt from "@/assets/resonabed-brochure-outside.jpg.asset.json";
import insideArt from "@/assets/resonabed-brochure-inside.jpg.asset.json";
import { hexRgb, type FlyerDesign } from "./flyer-design";

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

export interface FlyerIdentity { name: string; email: string; website: string; bookingUrl: string; logoUrl: string; }
export async function buildPanelFlyer(design: FlyerDesign, identity: FlyerIdentity, print = false): Promise<Blob> {
  // Supplied brochure artwork (flattened). Each sheet includes bleed and crop
  // marks; the middle outside panel is a cleared area for clinic details.
  const SW = 876.24, SH = 629.52, M = (SW - 841.92) / 2, P = 841.92 / 3;
  const out = await PDFDocument.create();
  const sheets = await Promise.all([outsideArt.url, insideArt.url].map(async (u) => { const r = await fetch(u); if (!r.ok) throw new Error("Flyer artwork unavailable"); return out.embedJpg(await r.arrayBuffer()); }));
  const pages = sheets.map((img) => { const pg = out.addPage([SW, SH]); pg.drawImage(img, { x: 0, y: 0, width: SW, height: SH }); pg.setTrimBox(M, M, SW - 2 * M, SH - 2 * M); pg.setBleedBox(0, 0, SW, SH); if (!print) pg.setCropBox(M, M, SW - 2 * M, SH - 2 * M); return pg; });
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
    const w = img.width * scale, h = img.height * scale; page.drawImage(img, { x: cx - w / 2, y: top(40) - 140 + (140 - h) / 2, width: w, height: h });
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
