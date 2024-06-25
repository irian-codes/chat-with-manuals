import {PDFLoader} from '@langchain/community/document_loaders/fs/pdf';
import {Chroma} from '@langchain/community/vectorstores/chroma';
import {OpenAIEmbeddings} from '@langchain/openai';
import assert from 'assert';
import fs from 'fs';
import {Document} from 'langchain/document';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';
import path from 'path';
import PDFParser, {Output} from 'pdf2json';

const embedder = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
  dimensions: 1536,
});

function validateFilePath(filePath: unknown): asserts filePath is string {
  if (typeof filePath !== 'string') {
    throw new TypeError('filePath must be a string');
  }

  if (!fs.existsSync(filePath.trim())) {
    throw new Error(`File ${filePath} does not exist`);
  }
}

async function downloadFile(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  const blob = await response.blob();
  const fileName = url.split('/').pop() ?? 'tempFile.pdf';
  const file = new File([blob], fileName, {type: 'application/pdf'});

  return file;
}

export async function parsePdf(fileUrl: string) {
  const file = await downloadFile(fileUrl);

  assert(file.type === 'application/pdf', 'File is not a pdf');

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

  fs.writeFileSync(
    path.join(
      process.cwd(),
      'public',
      `parsedPdf_${file.name}_${new Date().toISOString().split('T')[0]}.json`
    ),
    JSON.stringify(parsedPdf, null, 2)
  );
}

export async function embedPDF(fileUrl: string, collectionName: string) {
  const file = await downloadFile(fileUrl);

  assert(file.type === 'application/pdf', 'File is not a pdf');

  // Create docs with a loader
  const docs = await new PDFLoader(file).load();

  const splitDocs = await chunkDocs(docs);
  const vectorStore = await createVectorStore(collectionName, splitDocs);

  return vectorStore;
}

async function chunkDocs(docs: Document<Record<string, any>>[]) {
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 20,
  });

  const texts = await textSplitter.splitDocuments(docs);

  return texts;
}

async function createVectorStore(
  collectionName: string,
  docs: Document<Record<string, any>>[]
) {
  // Create vector store and index the docs
  const vectorStore = await Chroma.fromDocuments(docs, embedder, {
    collectionName: collectionName,
    url: process.env.CHROMA_DB_HOST,
  });

  return vectorStore;
}

export async function queryCollection(name: string, prompt: string) {
  const vectorStore = await Chroma.fromExistingCollection(embedder, {
    collectionName: name,
  });

  if (!vectorStore) {
    throw new Error('Vector store not found');
  }

  const result = await vectorStore.similaritySearch(prompt);

  return result;
}
