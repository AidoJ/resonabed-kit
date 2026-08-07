import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';

const MM_TO_PT = 72 / 25.4;
const BLEED_MM = 3;
const BLEED_PT = BLEED_MM * MM_TO_PT;
const TRIM_W = 841.92;
const TRIM_H = 595.92;
const SHEET_W = TRIM_W + BLEED_PT * 2;
const SHEET_H = TRIM_H + BLEED_PT * 2;
const CROP_MARK_LEN = 5 * MM_TO_PT;

async function main() {
  const source = await PDFDocument.load(fs.readFileSync('/tmp/flyer.pdf'));
  const sourceBytes = await source.save();
  const out = await PDFDocument.create();
  const embedded = await out.embedPdf(sourceBytes, source.getPageIndices());
  console.log('embedded pages', embedded.length);
  for (const ep of embedded) {
    const page = out.addPage([SHEET_W, SHEET_H]);
    page.drawPage(ep, { x: 0, y: 0, width: SHEET_W, height: SHEET_H });
    page.drawPage(ep, { x: BLEED_PT, y: BLEED_PT, width: TRIM_W, height: TRIM_H });
    page.setTrimBox(BLEED_PT, BLEED_PT, TRIM_W, TRIM_H);
    page.setBleedBox(0, 0, SHEET_W, SHEET_H);
    const corners = [
      { x: BLEED_PT, y: BLEED_PT + TRIM_H },
      { x: BLEED_PT + TRIM_W, y: BLEED_PT + TRIM_H },
      { x: BLEED_PT, y: BLEED_PT },
      { x: BLEED_PT + TRIM_W, y: BLEED_PT },
    ];
    for (const c of corners) {
      const dx = c.x === BLEED_PT ? -1 : 1;
      const dy = c.y === BLEED_PT ? -1 : 1;
      page.drawLine({ start: { x: c.x, y: c.y }, end: { x: c.x + dx * CROP_MARK_LEN, y: c.y }, thickness: 0.5, color: rgb(0,0,0) });
      page.drawLine({ start: { x: c.x, y: c.y }, end: { x: c.x, y: c.y + dy * CROP_MARK_LEN }, thickness: 0.5, color: rgb(0,0,0) });
    }
  }
  fs.writeFileSync('/tmp/flyer_with_bleed.pdf', await out.save());
  console.log('saved', '/tmp/flyer_with_bleed.pdf');
}
main();
