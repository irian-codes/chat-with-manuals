import {PDFLoader} from '@langchain/community/document_loaders/fs/pdf';
import {Chroma} from '@langchain/community/vectorstores/chroma';
import {OpenAIEmbeddings} from '@langchain/openai';
import fs from 'fs';
import type {Document} from 'langchain/document';

function validateFilePath(filePath: unknown): asserts filePath is string {
  if (typeof filePath !== 'string') {
    throw new TypeError('filePath must be a string');
  }

  if (!fs.existsSync(filePath.trim())) {
    throw new Error(`File ${filePath} does not exist`);
  }
}

export async function embedPDF(filePath: string) {
  // Validate the filePath parameter
  validateFilePath(filePath);

  // Check that the file is a pdf
  if (!filePath.toLowerCase().endsWith('.pdf')) {
    throw new Error(`File ${filePath} is not a pdf file`);
  }

  // Create docs with a loader
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();

  const vectorStore = await createVectorStore(docs);

  return vectorStore;
}

async function createVectorStore(docs: Document<Record<string, any>>[]) {
  // Create vector store and index the docs
  const vectorStore = await Chroma.fromDocuments(docs, new OpenAIEmbeddings(), {
    collectionName: 'a-test-collection',
    url: 'http://localhost:8000', // Optional, will default to this value
    collectionMetadata: {
      'hnsw:space': 'cosine',
    }, // Optional, can be used to specify the distance method of the embedding space https://docs.trychroma.com/usage-guide#changing-the-distance-function
  });

  return vectorStore;
}
