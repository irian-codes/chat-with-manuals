import {writeToPublicFile} from '@/app/api/utils/fileUtils';
import {PdfParsingOutput} from '@/app/common/types/PdfParsingOutput';
import {PDFLoader} from '@langchain/community/document_loaders/fs/pdf';
import assert from 'node:assert';
import PDFParser, {Output} from 'pdf2json';

export async function parsePdf(file: File, output: PdfParsingOutput) {
  assert(file.type === 'application/pdf', 'File is not a pdf');

  switch (output) {
    case 'json':
      const res = await pdfParseToJson(file);
      writeToPublicFile(res, file.name, 'json');

      return res;

    case 'langchain':
      const loader = new PDFLoader(file);
      const docs = await loader.load();

      writeToPublicFile(
        docs.map((d) => d.pageContent).join('\n\n'),
        file.name,
        'txt'
      );

      return JSON.stringify(docs, null, 2);

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
