import { PDFDocument, rgb } from "pdf-lib";
import fs from "node:fs";

const MM_TO_PT = 72 / 25.4;
const BLEED_MM = 3;
const BLEED_PT = BLEED_MM * MM_TO_PT;
const CROP_MARK_LEN = 5 * MM_TO_PT;
const BLACK = rgb(0, 0, 0);

function drawCropMarks(
  page: any,
  trimX: number,
  trimY: number,
  trimW: number,
  trimH: number,
) {
  const inset = CROP_MARK_LEN * 0.5;
  const lines = [
    // top-left
    { x1: trimX - inset, y1: trimY + trimH, x2: trimX - inset - CROP_MARK_LEN, y2: trimY + trimH },
    { x1: trimX, y1: trimY + trimH + inset, x2: trimX, y2: trimY + trimH + inset + CROP_MARK_LEN },
    // top-right
    { x1: trimX + trimW + inset, y1: trimY + trimH, x2: trimX + trimW + inset + CROP_MARK_LEN, y2: trimY + trimH },
    { x1: trimX + trimW, y1: trimY + trimH + inset, x2: trimX + trimW, y2: trimY + trimH + inset + CROP_MARK_LEN },
    // bottom-left
    { x1: trimX - inset, y1: trimY, x2: trimX - inset - CROP_MARK_LEN, y2: trimY },
    { x1: trimX, y1: trimY - inset, x2: trimX, y2: trimY - inset - CROP_MARK_LEN },
    // bottom-right
    { x1: trimX + trimW + inset, y1: trimY, x2: trimX + trimW + inset + CROP_MARK_LEN, y2: trimY },
    { x1: trimX + trimW, y1: trimY - inset, x2: trimX + trimW, y2: trimY - inset - CROP_MARK_LEN },
  ];
  for (const { x1, y1, x2, y2 } of lines) {
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color: BLACK, thickness: 0.5 });
  }
}

async function addPrintBleed(sourcePath: string, outPath: string) {
  const source = await PDFDocument.load(fs.readFileSync(sourcePath));
  const sourceBytes = await source.save();
  const out = await PDFDocument.create();
  const embeddedPages = await out.embedPdf(sourceBytes, source.getPageIndices());

  for (const embeddedPage of embeddedPages) {
    const trimW = embeddedPage.width;
    const trimH = embeddedPage.height;
    const sheetW = trimW + BLEED_PT * 2;
    const sheetH = trimH + BLEED_PT * 2;

    const page = out.addPage([sheetW, sheetH]);

    page.drawPage(embeddedPage, {
      x: 0,
      y: 0,
      width: sheetW,
      height: sheetH,
    });
    page.drawPage(embeddedPage, {
      x: BLEED_PT,
      y: BLEED_PT,
      width: trimW,
      height: trimH,
    });

    page.setTrimBox(BLEED_PT, BLEED_PT, trimW, trimH);
    page.setBleedBox(0, 0, sheetW, sheetH);

    drawCropMarks(page, BLEED_PT, BLEED_PT, trimW, trimH);
  }

  fs.writeFileSync(outPath, await out.save());
}

async function main() {
  await addPrintBleed(
    "/mnt/documents/resonabed-trifold-flyer.pdf",
    "/mnt/documents/resonabed-trifold-flyer_print-ready.pdf",
  );
  console.log("added print bleed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
