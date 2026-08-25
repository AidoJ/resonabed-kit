import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFPage,
  PDFRawStream,
  clip,
  closePath,
  decodePDFRawStream,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";

/** Print artwork, served from /public so wording fixes ship with the app. */
const FLYER_PDF_URL = "/resonabed-flyer.pdf";
/** All-white Resonabed mark, used when the flyer is re-skinned to clinic colours. */
const WHITE_LOGO_URL = "/resonabed-logo-flyer-white.png";

/** Clinic brand colours used to re-skin the flyer artwork. */
export interface FlyerBrand {
  /** Main brand colour, e.g. the clinic's primary. */
  primary: string;
  /** Deep colour used for dark panels. */
  sidebar: string;
}

/**
 * Details the clinic can stamp into the blank "Clinic details" panel on the
 * outside (page 1) of the printed Resonabed flyer.
 */
export interface FlyerClinicDetails {
  name?: string;
  phone?: string;
  email?: string;
  website?: string;
  /** Object URL / http URL for the clinic logo. Any raster or SVG source. */
  logoUrl?: string;
  /** Booking page URL encoded into the QR code printed beside the details. */
  bookingUrl?: string;
  /** When set, the flyer's purple palette is re-skinned to these colours. */
  brand?: FlyerBrand | null;
}

/** Blank panel on page 1, measured from the artwork (PDF points). */
const PANEL = { x: 24, y: 32, width: 236, height: 108 };
/** Matches the flyer's paper tint so the placeholder box is covered cleanly. */
const PAPER_HEX = "#f7f1fd";
const INK_HEX = "#26106c";
const MUTED_HEX = "#52477b";
const WHITE = rgb(1, 1, 1);
/** Size of the printed QR square, plus its white surround. */
const QR = { size: 62, pad: 4, gap: 10 };


const MM_TO_PT = 72 / 25.4;
const BLEED_MM = 3;
const BLEED_PT = BLEED_MM * MM_TO_PT;
const TRIM_W = 841.92;
const TRIM_H = 595.92;
const SHEET_W = TRIM_W + BLEED_PT * 2;
const SHEET_H = TRIM_H + BLEED_PT * 2;
const CROP_MARK_LEN = 5 * MM_TO_PT; // 5mm registration marks
const BLACK = rgb(0, 0, 0);

/** Wraps each source page in a 3mm bleed and draws crop marks. */
async function addPrintBleed(source: PDFDocument): Promise<PDFDocument> {
  const sourceBytes = await source.save();
  const out = await PDFDocument.create();
  const embeddedPages = await out.embedPdf(sourceBytes, source.getPageIndices());

  for (const embeddedPage of embeddedPages) {
    const page = out.addPage([SHEET_W, SHEET_H]);

    // Fill the whole sheet with a scaled copy of the page so the artwork
    // extends 3mm past the trim. The original-size copy on top covers the
    // centre, leaving only the bleed edge visible around it.
    page.drawPage(embeddedPage, {
      x: 0,
      y: 0,
      width: SHEET_W,
      height: SHEET_H,
    });
    page.drawPage(embeddedPage, {
      x: BLEED_PT,
      y: BLEED_PT,
      width: TRIM_W,
      height: TRIM_H,
    });

    // Declare the bleed/trim boxes so professional print workflows see them.
    page.setTrimBox(BLEED_PT, BLEED_PT, TRIM_W, TRIM_H);
    page.setBleedBox(0, 0, SHEET_W, SHEET_H);

    drawCropMarks(page, BLEED_PT, BLEED_PT, TRIM_W, TRIM_H);
  }

  return out;
}

function drawCropMarks(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const corners = [
    { x, y: y + height }, // bottom-left (in PDF coords: top-left visually)
    { x: x + width, y: y + height }, // bottom-right
    { x, y }, // top-left
    { x: x + width, y }, // top-right
  ];

  for (const c of corners) {
    const dx = c.x === x ? -1 : 1;
    const dy = c.y === y ? -1 : 1;

    page.drawLine({
      start: { x: c.x, y: c.y },
      end: { x: c.x + dx * CROP_MARK_LEN, y: c.y },
      thickness: 0.5,
      color: BLACK,
    });
    page.drawLine({
      start: { x: c.x, y: c.y },
      end: { x: c.x, y: c.y + dy * CROP_MARK_LEN },
      thickness: 0.5,
      color: BLACK,
    });
  }
}

/**
 * The source artwork's outside page was imposed for the wrong fold: its panels
 * read [questions + clinic details, cover, what to expect] left to right.
 * Correct trifold imposition is [what to expect, questions + details, cover],
 * so the panels are rotated one slot: new panel i shows source panel (i + 2) % 3.
 * Stamping happens in source coordinates BEFORE this runs, so the clinic
 * details (source-left panel) end up in the middle and the cover moves right.
 */
export async function reimposeOutsidePage(doc: PDFDocument): Promise<PDFDocument> {
  const PANEL_W = TRIM_W / 3;
  const bytes = await doc.save();
  const out = await PDFDocument.create();
  const [outside, inside] = await out.embedPdf(bytes, [0, 1]);

  const reimposed = out.addPage([TRIM_W, TRIM_H]);
  for (let i = 0; i < 3; i++) {
    const src = (i + 2) % 3;
    reimposed.pushOperators(
      pushGraphicsState(),
      moveTo(i * PANEL_W, 0),
      lineTo((i + 1) * PANEL_W, 0),
      lineTo((i + 1) * PANEL_W, TRIM_H),
      lineTo(i * PANEL_W, TRIM_H),
      closePath(),
      clip(),
      endPath(),
    );
    reimposed.drawPage(outside!, { x: (i - src) * PANEL_W, y: 0, width: TRIM_W, height: TRIM_H });
    reimposed.pushOperators(popGraphicsState());
  }

  const insidePage = out.addPage([TRIM_W, TRIM_H]);
  insidePage.drawPage(inside!, { x: 0, y: 0, width: TRIM_W, height: TRIM_H });

  return out;
}

/**
 * The unpersonalised flyer with its panels reimposed into the correct fold
 * order. Used for the "blank flyer" download; the clinic-details placeholder
 * box is intentionally left visible for hand-written details.
 */
export async function buildBlankFlyer(): Promise<Blob> {
  const src = await fetch(FLYER_PDF_URL).then((r) => r.arrayBuffer());
  const pdf = await PDFDocument.load(src);
  const imposed = await reimposeOutsidePage(pdf);
  const bytes = await imposed.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}

/** Rasterises any image (incl. SVG) to PNG bytes via a same-origin blob. */
async function toPngBytes(url: string, maxPx = 320): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("image_load_failed"));
        el.src = objectUrl;
      });
      const w = img.naturalWidth || 300;
      const h = img.naturalHeight || 100;
      const scale = Math.min(1, maxPx / Math.max(w, h)) * 3;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!out) return null;
      return new Uint8Array(await out.arrayBuffer());
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

/** Trims a string to fit a width, adding an ellipsis when needed. */
function fit(
  text: string,
  size: number,
  maxWidth: number,
  measure: (t: string, s: number) => number,
): string {
  if (measure(text, size) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && measure(out + "…", size) > maxWidth) out = out.slice(0, -1);
  return out + "…";
}

/**
 * The source artwork stamps its intro block and clinic-details placeholder with
 * a non-embedded base font (Helvetica). Printers reject that at pre-flight, so
 * we delete those operators and the font resource, then redraw the same text
 * with a properly embedded font.
 */
function stripBaseFontText(pdf: PDFDocument, page: PDFPage) {
  const ctx = pdf.context;
  const contents: unknown = page.node.Contents();
  const refs =
    contents instanceof PDFArray ? contents.asArray() : [page.node.get(PDFName.of("Contents"))];

  const startMarker = "BT\n/F1 12 Tf";
  const endMarker = "26 35.91998 229 86 re\nS";

  for (const ref of refs) {
    if (!ref) continue;
    const stream = ctx.lookup(ref);
    if (!(stream instanceof PDFRawStream)) continue;
    const bytes = decodePDFRawStream(stream).decode();
    let text = new TextDecoder("latin1").decode(bytes);
    const start = text.indexOf(startMarker);
    const end = text.indexOf(endMarker);
    if (start < 0 || end <= start) continue;
    text = text.slice(0, start) + text.slice(end + endMarker.length);
    ctx.assign(
      ref as never,
      ctx.flateStream(Uint8Array.from(text, (c) => c.charCodeAt(0))),
    );
  }

  const fonts = page.node.Resources()?.lookup(PDFName.of("Font")) as PDFDict | undefined;
  fonts?.delete(PDFName.of("F1"));
}

/* ---------------------------------------------------------------- colours */

function hexToRgb01(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function rgbToHsl(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  if (s === 0) return { r: l, g: l, b: l };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return { r: hue(h + 1 / 3), g: hue(h), b: hue(h - 1 / 3) };
}

/** Resonabed's own deep purple, the reference hue for the artwork. */
const BASE_DEEP = "#26106c";

/**
 * Builds a mapper that shifts the flyer's purple family onto the clinic's
 * brand hue while keeping every tint, shade and neutral exactly as designed.
 */
function makeRecolour(brand: FlyerBrand | null | undefined) {
  if (!brand) return (r: number, g: number, b: number) => ({ r, g, b });
  const base = hexToRgb01(BASE_DEEP);
  const target = hexToRgb01(brand.sidebar || brand.primary);
  const baseHsl = rgbToHsl(base.r, base.g, base.b);
  const targetHsl = rgbToHsl(target.r, target.g, target.b);
  const dh = targetHsl.h - baseHsl.h;
  const satScale =
    baseHsl.s > 0.05 ? Math.max(0.5, Math.min(1.6, targetHsl.s / baseHsl.s)) : 1;

  return (r: number, g: number, b: number) => {
    const { h, s, l } = rgbToHsl(r, g, b);
    // Leave neutrals (white card fills, blacks, greys) untouched.
    if (s < 0.05) return { r, g, b };
    const out = hslToRgb((h + dh + 1) % 1, Math.max(0, Math.min(1, s * satScale)), l);
    return out;
  };
}

/** Applies the recolour to a hex string, for text we draw ourselves. */
function shiftHex(hex: string, map: ReturnType<typeof makeRecolour>) {
  const { r, g, b } = hexToRgb01(hex);
  return map(r, g, b);
}

const num = (n: number) => Math.max(0, Math.min(1, n)).toFixed(4);

/**
 * Rewrites every fill/stroke colour operator in a page's content streams and
 * turns the white logo card into a brand-coloured panel, so the artwork sits
 * in the clinic's palette rather than Resonabed purple.
 */
function recolourPage(pdf: PDFDocument, page: PDFPage, map: ReturnType<typeof makeRecolour>) {
  const ctx = pdf.context;
  const contents: unknown = page.node.Contents();
  const refs =
    contents instanceof PDFArray ? contents.asArray() : [page.node.get(PDFName.of("Contents"))];

  for (const ref of refs) {
    if (!ref) continue;
    const stream = ctx.lookup(ref);
    if (!(stream instanceof PDFRawStream)) continue;
    const bytes = decodePDFRawStream(stream).decode();
    let text = new TextDecoder("latin1").decode(bytes);

    text = text.replace(
      /(\d*\.\d+|\d+) (\d*\.\d+|\d+) (\d*\.\d+|\d+) (rg|RG)\b/g,
      (_m, r: string, g: string, b: string, op: string) => {
        const c = map(parseFloat(r), parseFloat(g), parseFloat(b));
        return `${num(c.r)} ${num(c.g)} ${num(c.b)} ${op}`;
      },
    );

    ctx.assign(
      ref as never,
      ctx.flateStream(Uint8Array.from(text, (c) => c.charCodeAt(0))),
    );
  }

  recolourPatternImages(pdf, page, map);
}

/**
 * The deep purple panels are painted with tiling patterns that wrap a raw RGB
 * gradient image, so their colour lives in pixel data rather than in operators.
 * This walks those images and shifts every pixel onto the brand hue.
 */
function recolourPatternImages(
  pdf: PDFDocument,
  page: PDFPage,
  map: ReturnType<typeof makeRecolour>,
) {
  const ctx = pdf.context;
  const patterns = page.node.Resources()?.lookup(PDFName.of("Pattern")) as PDFDict | undefined;
  if (!patterns) return;

  for (const [, patternRef] of patterns.entries()) {
    const pattern = ctx.lookup(patternRef);
    if (!(pattern instanceof PDFRawStream)) continue;
    const xobjects = pattern.dict
      .lookup(PDFName.of("Resources"), PDFDict)
      ?.lookup(PDFName.of("XObject")) as PDFDict | undefined;
    if (!xobjects) continue;

    for (const [, imageRef] of xobjects.entries()) {
      const image = ctx.lookup(imageRef);
      if (!(image instanceof PDFRawStream)) continue;
      const cs = image.dict.get(PDFName.of("ColorSpace"));
      if (!cs || cs.toString() !== "/DeviceRGB") continue;

      const pixels = decodePDFRawStream(image).decode();
      for (let i = 0; i + 2 < pixels.length; i += 3) {
        const c = map(pixels[i]! / 255, pixels[i + 1]! / 255, pixels[i + 2]! / 255);
        pixels[i] = Math.round(Math.max(0, Math.min(1, c.r)) * 255);
        pixels[i + 1] = Math.round(Math.max(0, Math.min(1, c.g)) * 255);
        pixels[i + 2] = Math.round(Math.max(0, Math.min(1, c.b)) * 255);
      }

      const next = ctx.flateStream(pixels);
      for (const key of image.dict.keys()) {
        if (key === PDFName.of("Length") || key === PDFName.of("Filter")) continue;
        next.dict.set(key, image.dict.get(key)!);
      }
      ctx.assign(imageRef as never, next);
    }
  }
}

/**
 * Prints the all-white Resonabed mark on a deep brand-coloured card, replacing
 * the white card and purple mark in the original artwork.
 */
async function drawWhiteLogoCard(
  pdf: PDFDocument,
  page: PDFPage,
  deep: { r: number; g: number; b: number },
) {
  const bytes = await fetch(WHITE_LOGO_URL).then((r) => (r.ok ? r.arrayBuffer() : null));
  if (!bytes) return;
  const image = await pdf.embedPng(bytes);

  const card = { x: 325, y: 387, width: 189, height: 166 };
  const r = 16;
  const { x, width: w, height: h } = card;
  // drawSvgPath works top-down, so convert the card's PDF y to a top offset.
  const t = page.getHeight() - (card.y + h);
  page.drawSvgPath(
    `M ${x + r} ${t} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${t + r} V ${t + h - r} ` +
      `A ${r} ${r} 0 0 1 ${x + w - r} ${t + h} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${t + h - r} ` +
      `V ${t + r} A ${r} ${r} 0 0 1 ${x + r} ${t} Z`,
    { x: 0, y: page.getHeight(), color: rgb(deep.r, deep.g, deep.b), borderWidth: 0 },
  );

  const maxW = w - 44;
  const maxH = h - 56;
  const scale = Math.min(maxW / image.width, maxH / image.height);
  const iw = image.width * scale;
  const ih = image.height * scale;
  page.drawImage(image, {
    x: x + (w - iw) / 2,
    y: card.y + (h - ih) / 2,
    width: iw,
    height: ih,
  });
}


/**
 * Returns the flyer PDF with the supplied clinic details printed into the
 * reserved panel. Empty fields are simply left out.
 */
export async function buildPersonalisedFlyer(details: FlyerClinicDetails): Promise<Blob> {
  const src = await fetch(FLYER_PDF_URL).then((r) => r.arrayBuffer());
  const pdf = await PDFDocument.load(src);
  const page = pdf.getPages()[0]!;

  const map = makeRecolour(details.brand);
  const deepC = shiftHex(BASE_DEEP, map);
  const paperC = shiftHex(PAPER_HEX, map);
  const inkC = shiftHex(INK_HEX, map);
  const mutedC = shiftHex(MUTED_HEX, map);
  const PAPER = rgb(paperC.r, paperC.g, paperC.b);
  const INK = rgb(inkC.r, inkC.g, inkC.b);
  const MUTED = rgb(mutedC.r, mutedC.g, mutedC.b);
  const qrDark = `#${[deepC.r, deepC.g, deepC.b]
    .map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0"))
    .join("")}ff`;

  // Embed real font files (subset) so the output has no unembedded fonts,
  // which commercial printers reject.
  pdf.registerFontkit(fontkit);
  const [boldBytes, regularBytes] = await Promise.all([
    fetch("/fonts/LiberationSans-Bold.ttf").then((r) => r.arrayBuffer()),
    fetch("/fonts/LiberationSans-Regular.ttf").then((r) => r.arrayBuffer()),
  ]);
  const bold = await pdf.embedFont(boldBytes, { subset: true });
  const regular = await pdf.embedFont(regularBytes, { subset: true });

  stripBaseFontText(pdf, page);

  if (details.brand) {
    for (const p of pdf.getPages()) {
      recolourPage(pdf, p, map);
    }
    await drawWhiteLogoCard(pdf, page, deepC);
  }

  // Redraw the intro block with the embedded font.
  page.drawRectangle({ x: 0, y: 17.9, width: 280, height: 187, color: PAPER });
  page.drawText("Resonabed", {
    x: 26,
    y: 191.92,
    size: 13,
    font: regular,
    color: INK,
  });

  page.drawText("Ask your practitioner about adding a", {
    x: 26,
    y: 169.92,
    size: 8.6,
    font: regular,
    color: MUTED,
  });
  page.drawText("vibroacoustic session to your visit.", {
    x: 26,
    y: 156.92,
    size: 8.6,
    font: regular,
    color: MUTED,
  });

  // Cover the printed placeholder ("Clinic details:" + dashed box).
  page.drawRectangle({ ...PANEL, color: PAPER });

  let logoImage = null as Awaited<ReturnType<typeof pdf.embedPng>> | null;
  if (details.logoUrl) {
    const bytes = await toPngBytes(details.logoUrl);
    if (bytes) logoImage = await pdf.embedPng(bytes);
  }

  // QR code block, printed on white at the right of the panel.
  let qrBlockWidth = 0;
  if (details.bookingUrl) {
    const dataUrl = await QRCode.toDataURL(details.bookingUrl, {
      margin: 0,
      scale: 8,
      color: { dark: qrDark, light: "#ffffffff" },
    });
    const qrBytes = Uint8Array.from(atob(dataUrl.split(",")[1]!), (c) => c.charCodeAt(0));
    const qrImage = await pdf.embedPng(qrBytes);

    const box = QR.size + QR.pad * 2;
    const labelSize = 8;
    const boxX = PANEL.x + PANEL.width - 6 - box;
    const boxY = PANEL.y + PANEL.height - 6 - box;
    page.drawRectangle({
      x: boxX,
      y: boxY - (labelSize + 5),
      width: box,
      height: box + labelSize + 5,
      color: WHITE,
    });
    page.drawImage(qrImage, {
      x: boxX + QR.pad,
      y: boxY + QR.pad,
      width: QR.size,
      height: QR.size,
    });
    const label = "Book Now";
    const labelWidth = bold.widthOfTextAtSize(label, labelSize);
    page.drawText(label, {
      x: boxX + (box - labelWidth) / 2,
      y: boxY - labelSize - 1,
      size: labelSize,
      font: bold,
      color: INK,
    });
    qrBlockWidth = box + QR.gap;
  }

  const left = PANEL.x + 6;
  const maxWidth = PANEL.width - 12 - qrBlockWidth;
  let cursor = PANEL.y + PANEL.height;

  if (logoImage) {
    const maxH = 30;
    const maxW = Math.min(maxWidth, 110);
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height);
    const w = logoImage.width * scale;
    const h = logoImage.height * scale;
    cursor -= h;
    page.drawImage(logoImage, { x: left, y: cursor, width: w, height: h });
    cursor -= 8;
  }

  if (details.name) {
    cursor -= 11;
    page.drawText(fit(details.name, 11, maxWidth, (t, s) => bold.widthOfTextAtSize(t, s)), {
      x: left,
      y: cursor,
      size: 11,
      font: bold,
      color: INK,
    });
    cursor -= 5;
  }

  const lines = [details.phone, details.email, details.website].filter(Boolean) as string[];
  for (const line of lines) {
    cursor -= 9;
    page.drawText(fit(line, 8.5, maxWidth, (t, s) => regular.widthOfTextAtSize(t, s)), {
      x: left,
      y: cursor,
      size: 8.5,
      font: regular,
      color: MUTED,
    });
    cursor -= 3;
  }


  // Rotate the outside page's panels into the correct trifold fold order
  // AFTER all stamping, which uses the source artwork's coordinates.
  const imposed = await reimposeOutsidePage(pdf);
  const bleedPdf = await addPrintBleed(imposed);
  const bytes = await bleedPdf.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}
