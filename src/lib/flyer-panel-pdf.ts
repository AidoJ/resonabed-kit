import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, clip, closePath, decodePDFRawStream, endPath, lineTo, moveTo, popGraphicsState, pushGraphicsState, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import template from "@/assets/resonabed-flyer-editor-template.pdf.asset.json";
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
    let text = new TextDecoder("latin1").decode(decodePDFRawStream(raw).decode());
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
  const bytes = await source(); const out = await PDFDocument.create();
  const pages = [out.addPage([W, H]), out.addPage([W, H])];
  // Source outside panels were already rotated by the old export. Our cleaned
  // source retains pre-rotation coordinates: expected, questions, cover = 2,0,1.
  for (let i = 0; i < PANEL_IDS.length; i++) {
    const id = PANEL_IDS[i]; if (!id) continue;
    const side = i < 3 ? 0 : 1, slot = i % 3, srcSlot = side === 0 ? [2, 0, 1][slot] ?? 0 : slot;
    const doc = await PDFDocument.load(bytes.slice(0)); recolour(doc, side, design.panels[id], id === "F3");
    const [embedded] = await out.embedPdf(await doc.save(), [side]); const page = pages[side]; if (!embedded || !page) throw new Error("Missing flyer panel");
    page.drawRectangle({ x: slot * PW, y: 0, width: PW, height: H, color: colour(design.panels[id].background) });
    page.pushOperators(pushGraphicsState(), moveTo(slot * PW, 0), lineTo((slot + 1) * PW, 0), lineTo((slot + 1) * PW, H), lineTo(slot * PW, H), closePath(), clip(), endPath());
    page.drawPage(embedded, { x: (slot - srcSlot) * PW, y: 0, width: W, height: H }); page.pushOperators(popGraphicsState());
  }
  const page = pages[0]; if (!page) throw new Error("Missing outside page");
  const c = design.panels.F2;
  // Personal details occupy the supplied reserved area. Everything else stays
  // in the original artwork, and never becomes user-editable text.
  page.drawRectangle({ x: PW, y: 17.9, width: PW, height: 211, color: colour(c.background) });
  out.registerFontkit(fontkit);
  const fonts = await Promise.all([fetch("/fonts/LiberationSans-Bold.ttf").then((r) => r.arrayBuffer()), fetch("/fonts/LiberationSans-Regular.ttf").then((r) => r.arrayBuffer())]);
  const bold = await out.embedFont(fonts[0] ?? new ArrayBuffer(0), { subset: true }); const regular = await out.embedFont(fonts[1] ?? new ArrayBuffer(0), { subset: true });
  const left = PW + 43.27; let cursor = 225.03937;
  if (identity.logoUrl) {
    const img = await out.embedPng(await logoBytes(identity.logoUrl)); const scale = Math.min(110 / img.width, 60 / img.height);
    page.drawImage(img, { x: left, y: cursor - 60, width: img.width * scale, height: img.height * scale });
  }
  cursor = 146.03937;
  const words = identity.name.trim().split(/\s+/); const lines: string[] = []; let line = "";
  for (const word of words) { const candidate = line ? `${line} ${word}` : word; if (bold.widthOfTextAtSize(candidate, 11) > 132 && line) { lines.push(line); line = word; } else line = candidate; } if (line) lines.push(line);
  for (const text of lines.slice(0, 2)) {
    const size = Math.min(11, 132 / Math.max(1, bold.widthOfTextAtSize(text, 1)));
    page.drawText(text, { x: left, y: cursor, size, font: bold, color: colour(c.text) }); cursor -= 13;
  }
  cursor -= 1;
  for (const text of [design.phone, identity.email, identity.website].filter(Boolean)) {
    const size = Math.min(8.5, 132 / Math.max(1, regular.widthOfTextAtSize(text, 1)));
    page.drawText(text, { x: left, y: cursor, size, font: regular, color: colour(c.text) }); cursor -= 12;
  }
  if (identity.bookingUrl) {
    const url = await QRCode.toDataURL(identity.bookingUrl, { margin: 4, scale: 8 });
    const encoded = url.split(",")[1]; if (!encoded) throw new Error("Booking code unavailable");
    const qr = await out.embedPng(Uint8Array.from(atob(encoded), (s) => s.charCodeAt(0)));
    page.drawImage(qr, { x: PW + 181, y: 150.03937, width: 70, height: 70 });
    page.drawText("Book Now", { x: PW + 199.445, y: 140.03937, size: 8, font: bold, color: colour(c.text) });
  }
  if (!print) return new Blob([await out.save() as BlobPart], { type: "application/pdf" });
  const ready = await PDFDocument.create(); const sheets = await ready.embedPdf(await out.save(), [0, 1]);
  for (const sheet of sheets) {
    const p = ready.addPage([W + BLEED * 2, H + BLEED * 2]); p.drawPage(sheet, { x: 0, y: 0, width: W + BLEED * 2, height: H + BLEED * 2 }); p.drawPage(sheet, { x: BLEED, y: BLEED, width: W, height: H }); p.setTrimBox(BLEED, BLEED, W, H); p.setBleedBox(0, 0, W + BLEED * 2, H + BLEED * 2);
    for (const x of [BLEED, W + BLEED]) for (const y of [BLEED, H + BLEED]) { p.drawLine({ start: { x, y }, end: { x: x + (x === BLEED ? -BLEED : BLEED), y }, thickness: 0.5, color: rgb(0, 0, 0) }); p.drawLine({ start: { x, y }, end: { x, y: y + (y === BLEED ? -BLEED : BLEED) }, thickness: 0.5, color: rgb(0, 0, 0) }); }
  }
  return new Blob([await ready.save() as BlobPart], { type: "application/pdf" });
}