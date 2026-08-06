import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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
 * Returns the flyer PDF with the supplied clinic details printed into the
 * reserved panel. Empty fields are simply left out.
 */
export async function buildPersonalisedFlyer(details: FlyerClinicDetails): Promise<Blob> {
  const src = await fetch(flyerPdf.url).then((r) => r.arrayBuffer());
  const pdf = await PDFDocument.load(src);
  const page = pdf.getPages()[0]!;

  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  // Cover the printed placeholder ("Clinic details:" + dashed box).
  page.drawRectangle({ ...PANEL, color: PAPER });

  let logoImage = null as Awaited<ReturnType<typeof pdf.embedPng>> | null;
  if (details.logoUrl) {
    const bytes = await toPngBytes(details.logoUrl);
    if (bytes) logoImage = await pdf.embedPng(bytes);
  }

  const left = PANEL.x + 6;
  const maxWidth = PANEL.width - 12;
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

  const bytes = await pdf.save();
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}
