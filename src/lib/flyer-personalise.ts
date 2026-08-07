import { PDFDocument, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import flyerPdf from "@/assets/resonabed-flyer.pdf.asset.json";

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
}

/** Blank panel on page 1, measured from the artwork (PDF points). */
const PANEL = { x: 24, y: 32, width: 236, height: 108 };
/** Matches the flyer's paper tint so the placeholder box is covered cleanly. */
const PAPER = rgb(247 / 255, 241 / 255, 253 / 255);
const WHITE = rgb(1, 1, 1);
const INK = rgb(0.15, 0.06, 0.42);
const MUTED = rgb(0.32, 0.28, 0.42);
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
  const contents = page.node.Contents();
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

/**
 * Returns the flyer PDF with the supplied clinic details printed into the
 * reserved panel. Empty fields are simply left out.
 */
export async function buildPersonalisedFlyer(details: FlyerClinicDetails): Promise<Blob> {
  const src = await fetch(flyerPdf.url).then((r) => r.arrayBuffer());
  const pdf = await PDFDocument.load(src);
  const page = pdf.getPages()[0]!;

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

  // Redraw the intro block with the embedded font.
  page.drawRectangle({ x: 0, y: 17.9, width: 280, height: 187, color: PAPER });
  page.drawText("Resonabed", {
    x: 26,
    y: 191.92,
    size: 13,
    font: regular,
    color: rgb(0.149, 0.0627, 0.4235),
  });
  page.drawText("Ask your practitioner about adding a", {
    x: 26,
    y: 169.92,
    size: 8.6,
    font: regular,
    color: rgb(0.4196, 0.3961, 0.502),
  });
  page.drawText("vibroacoustic session to your visit.", {
    x: 26,
    y: 156.92,
    size: 8.6,
    font: regular,
    color: rgb(0.4196, 0.3961, 0.502),
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
      color: { dark: "#26106cff", light: "#ffffffff" },
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


  const bleedPdf = await addPrintBleed(pdf);
  const bytes = await bleedPdf.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}
