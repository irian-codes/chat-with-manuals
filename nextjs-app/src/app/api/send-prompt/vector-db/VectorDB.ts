import {PDFLoader} from '@langchain/community/document_loaders/fs/pdf';
import {Chroma} from '@langchain/community/vectorstores/chroma';
import {OpenAIEmbeddings} from '@langchain/openai';
import fs from 'fs';
import {Document} from 'langchain/document';

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
  const file = new File([blob], 'tempFile.pdf', {type: 'application/pdf'});

  return file;
}

export async function embedPDF(fileUrl: string, collectionName: string) {
  const file = await downloadFile(fileUrl);

  // Check that the file is a pdf
  if (file.type !== 'application/pdf') {
    throw new Error(`File ${fileUrl} is not a pdf file`);
  }

  // Create docs with a loader
  const loader = new PDFLoader(file);
  const docs = await loader.load();

  const vectorStore = await createVectorStore(collectionName, docs);

  return vectorStore;
}

async function createVectorStore(
  collectionName: string,
  docs: Document<Record<string, any>>[]
) {
  console.log('heeey 2.4', docs);

  // Create vector store and index the docs
  const vectorStore = await Chroma.fromDocuments(
    docs,
    new OpenAIEmbeddings({apiKey: process.env.OPENAI_API_KEY}),
    {
      collectionName: collectionName,
      url: process.env.CHROMA_DB_HOST,
    }
  );

  return vectorStore;
}

export async function queryCollection(name: string, prompt: string) {
  const vectorStore = await Chroma.fromExistingCollection(
    new OpenAIEmbeddings(),
    {
      collectionName: name,
    }
  );

  if (!vectorStore) {
    throw new Error('Vector store not found');
  }

  const result = await vectorStore.similaritySearch(prompt);

  return result;
}

export async function doesCollectionExists(name: string) {
  const vectorStore = await Chroma.fromExistingCollection(
    new OpenAIEmbeddings(),
    {
      collectionName: name,
    }
  );

  return vectorStore != null;
}
