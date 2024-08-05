import {downloadFile} from '@/app/api/utils/fileUtils';
import {PDFLoader} from '@langchain/community/document_loaders/fs/pdf';
import {Chroma, ChromaLibArgs} from '@langchain/community/vectorstores/chroma';
import {OpenAIEmbeddings} from '@langchain/openai';
import assert from 'assert';
import {Document} from 'langchain/document';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';

const embedder = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
  dimensions: 1536,
});

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

export async function queryCollection(
  name: string,
  prompt: string,
  options?: Omit<ChromaLibArgs, 'collectionName'>
) {
  const vectorStore = await Chroma.fromExistingCollection(embedder, {
    collectionName: name,
    ...options,
  });

  if (!vectorStore) {
    throw new Error('Vector store not found');
  }

  const result = await vectorStore.similaritySearch(prompt);

  return result;
}
