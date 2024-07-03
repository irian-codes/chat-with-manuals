import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import PDFParser, {Output} from 'pdf2json';

export async function parsePdf(file: File, output: 'json') {
  assert(file.type === 'application/pdf', 'File is not a pdf');

  switch (output) {
    case 'json':
      const res = await pdfParseToJson(file);

      fs.writeFileSync(
        path.join(
          process.cwd(),
          'public',
          `parsedPdf_${file.name}_${new Date().toISOString().split('T')[0]}.json`
        ),
        res
      );

      return res;

    default:
      throw new Error('Not implemented');
  }
}

async function pdfParseToJson(file: File) {
  const pdfParser = new PDFParser();

  const parsedPdf: Output | Error = await new Promise(
    async (resolve, reject) => {
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        resolve(pdfData);
      });

      pdfParser.on('pdfParser_dataError', (errData) => {
        reject(errData.parserError);
      });

      pdfParser.parseBuffer(Buffer.from(await file.arrayBuffer()));
    }
  );

  if (parsedPdf instanceof Error) {
    throw parsedPdf;
  }

  return JSON.stringify(parsedPdf, null, 2);
}
