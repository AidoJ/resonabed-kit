import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, clip, closePath, decodePDFRawStream, endPath, lineTo, moveTo, popGraphicsState, pushGraphicsState, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import outsideArt from "@/assets/resonabed-brochure-outside.jpg.asset.json";
import insideArt from "@/assets/resonabed-brochure-inside.jpg.asset.json";
import { hexRgb, type FlyerDesign, type PanelColours, PANEL_IDS } from "./flyer-design";

const W = 841.92, H = 595.92, PW = W / 3, BLEED = 72 * 3 / 25.4;
let sourcePromise: Promise<ArrayBuffer> | undefined;
function source() { sourcePromise ??= fetch(template.url).then((r) => { if (!r.ok) throw new Error("Flyer artwork unavailable"); return r.arrayBuffer(); }).catch((e) => { sourcePromise = undefined; throw e; }); return sourcePromise; }
const colour = (hex: string) => { const [r = 0, g = 0, b = 0] = hexRgb(hex); return rgb(r, g, b); };
const operator = (hex: string, op: string) => `${hexRgb(hex).map((n) => n.toFixed(4)).join(" ")} ${op}`;

function recolour(doc: PDFDocument, pageIndex: number, c: PanelColours, cover: boolean) {
  const page = doc.getPages()[pageIndex]; if (!page) throw new Error("Missing flyer page");
  const ctx = doc.context;
  const contents = page.node.Contents();
  const refs = contents instanceof PDFArray ? contents.asArray() : [page.node.get(PDFName.of("Contents"))];
  for (const ref of refs) {
    if (!ref) continue;
    const raw = ctx.lookup(ref); if (!(raw instanceof PDFRawStream)) continue;
    const decoded = decodePDFRawStream(raw).decode();
    let text = "";
    for (let i = 0; i < decoded.length; i += 8192) text += String.fromCharCode(...decoded.subarray(i, i + 8192));
    // Assign semantic roles to the supplied vector artwork. Text colours are
    // set before BT in the source; look ahead to distinguish text from paths.
    text = text.replace(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(rg|RG)\b/g, (match, rs: string, gs: string, bs: string, op: string, offset: number, full: string) => {
      const [r, g, b] = [rs, gs, bs].map(Number);
      const next = full.slice(offset + match.length).match(/\b(BT|ET|f\*?|S|Do)\b/);
      const isText = next?.[1] === "BT";
      if ((r ?? 0) > 0.95 && (g ?? 0) > 0.95 && (b ?? 0) > 0.95) return operator(isText ? (cover ? c.text : c.boxText) : c.background, op);
      if (Math.max(r ?? 0, g ?? 0, b ?? 0) < 0.06) return operator(isText ? c.text : c.box, op);
      return operator(c.accent, op);
    });
    ctx.assign(ref as never, ctx.flateStream(Uint8Array.from(text, (s) => s.charCodeAt(0))));
  }
  const patterns = page.node.Resources()?.lookup(PDFName.of("Pattern"));
  if (!(patterns instanceof PDFDict)) return;
  for (const [, ref] of patterns.entries()) {
    const pattern = ctx.lookup(ref); if (!(pattern instanceof PDFRawStream)) continue;
    const resources = pattern.dict.lookup(PDFName.of("Resources")); if (!(resources instanceof PDFDict)) continue;
    const images = resources.lookup(PDFName.of("XObject")); if (!(images instanceof PDFDict)) continue;
    for (const [, imageRef] of images.entries()) {
      const image = ctx.lookup(imageRef); if (!(image instanceof PDFRawStream) || image.dict.get(PDFName.of("ColorSpace"))?.toString() !== "/DeviceRGB") continue;
      const width = Number(image.dict.get(PDFName.of("Width")));
      const height = Number(image.dict.get(PDFName.of("Height")));
      const isCover = width > W - 2 && height > H - 2;
      const pixels = decodePDFRawStream(image).decode();
      const channels = hexRgb(isCover ? c.background : c.box).map((n) => Math.round(n * 255));
      for (let i = 0; i + 2 < pixels.length; i += 3) { pixels[i] = channels[0] ?? 0; pixels[i + 1] = channels[1] ?? 0; pixels[i + 2] = channels[2] ?? 0; }
      const replacement = ctx.flateStream(pixels);
      for (const key of image.dict.keys()) { const v = image.dict.get(key); if (v && !["/Length", "/Filter", "/DecodeParms"].includes(key.toString())) replacement.dict.set(key, v); }
      ctx.assign(imageRef as never, replacement);
    }
  }
}

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
  if (print) for (const pg of pages) void pg;
  return new Blob([await out.save() as BlobPart], { type: "application/pdf" });
}
