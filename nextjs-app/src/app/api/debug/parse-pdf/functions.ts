import {writeToTimestampedFile} from '@/app/api/utils/fileUtils';
import {PdfParsingOutput} from '@/app/common/types/PdfParsingOutput';
import {PDFLoader} from '@langchain/community/document_loaders/fs/pdf';
import assert from 'node:assert';
import PDFParser, {Output} from 'pdf2json';
import {UnstructuredClient} from 'unstructured-client';
import {PartitionResponse} from 'unstructured-client/sdk/models/operations';
import {Strategy} from 'unstructured-client/sdk/models/shared';

export async function parsePdf(file: File, output: PdfParsingOutput) {
  assert(file.type === 'application/pdf', 'File is not a pdf');

  switch (output) {
    case 'json':
      const res = await pdfParseToJson(file);
      writeToTimestampedFile(
        res,
        'tmp',
        `${file.name}_parser-${output}`,
        'json'
      );

      return res;

    case 'langchain':
      const loader = new PDFLoader(file);
      const docs = await loader.load();

      writeToTimestampedFile(
        docs.map((d) => d.pageContent).join('\n\n'),
        'tmp',
        `${file.name}_parser-${output}`,
        'txt'
      );

      return JSON.stringify(docs, null, 2);

    case 'unstructured':
      const unstructuredRes = await pdfParseWithUnstructured(file);

      writeToTimestampedFile(
        JSON.stringify(unstructuredRes, null, 2),
        'tmp',
        `${file.name}_parser-${output}`,
        'json'
      );

      return JSON.stringify(unstructuredRes, null, 2);

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

async function pdfParseWithUnstructured(file: File) {
  // Before calling the API, replace filename and ensure sdk is installed: "npm install unstructured-client"
  // See https://docs.unstructured.io/api-reference/api-services/sdk for more details

  const key = process.env.UNSTRUCTURED_API_KEY;

  if (!key) {
    throw new Error('UNSTRUCTURED_API_KEY is not set');
  }

  const client = new UnstructuredClient({
    serverURL: 'https://api.unstructuredapp.io',
    security: {
      apiKeyAuth: key,
    },
  });

  const data = Buffer.from(await file.arrayBuffer());

  try {
    const res: PartitionResponse = await client.general.partition({
      partitionParameters: {
        files: {
          content: data,
          fileName: file.name,
        },
        strategy: Strategy.Fast,
        languages: ['eng'],
      },
    });

    if (res.statusCode == 200) {
      return res.elements;
    }
  } catch (error) {
    if (error.statusCode != null) {
      console.error(error.statusCode);
      console.error(error.body);
    } else {
      console.error(error);
    }

    throw error;
  }
}
