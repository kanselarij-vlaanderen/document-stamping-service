import fs, { promises as fsp } from 'fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { uuid as generateUuid } from 'mu';
import { STORAGE_PATH } from '../config';
import { createFile } from '../queries/file';

async function stampMuFile (fileName, sourceFile, stamp) {
  const srcPath = sourceFile.replace(/^share:\/\//, '/share/');
  const fileUuid = generateUuid();
  const physicalFilename = `${fileUuid}.pdf`;
  const filePath = STORAGE_PATH + physicalFilename;

  await stampFile(srcPath, stamp, filePath);
  const filestats = fs.statSync(filePath);
  const archiveFile = {
    id: fileUuid,
    name: fileName,
    extension: 'pdf',
    format: 'application/pdf',
    size: filestats.size,
    created: filestats.birthtime
  };
  const muFile = await createFile(archiveFile, filePath.replace(/^\/share\//, 'share://'));
  return muFile;
}

async function stampFileToBytes(srcPath, text) {
  const inputFile = await fsp.readFile(srcPath);
  // Load a PDFDocument from the existing PDF bytes
  const pdfDoc = await PDFDocument.load(inputFile);

  // Embed the Helvetica font
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Get the first page of the document
  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  // Get the width and height of the first page
  const { width, height } = firstPage.getSize();

  const textOptions = {
    x: width / 2,
    y: height - 32,
    size: 16,
    font: helveticaFont,
    color: rgb(0, 0, 0)
  };

  drawBackground(firstPage, text, textOptions);

  firstPage.drawText(text, textOptions);

  // Serialize the PDFDocument to bytes (a Uint8Array)
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

async function stampFile (srcPath, text, destPath) {
  const pdfBytes = await stampFileToBytes(srcPath, text);
  return await fsp.writeFile(destPath, pdfBytes);
}

function drawBackground(page, text, textOptions) {
  const textWidth = textOptions.font.widthOfTextAtSize(text, textOptions.size);
  const textHeight = textOptions.font.heightAtSize(textOptions.size);

  page.drawRectangle({
    x: textOptions.x,
    y: textOptions.y,
    width: textWidth,
    height: textHeight,
    color: rgb(1, 1, 1)
  });
}

export {
  stampFile,
  stampMuFile,
  stampFileToBytes
};
