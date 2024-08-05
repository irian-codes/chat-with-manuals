import {Chroma, ChromaLibArgs} from '@langchain/community/vectorstores/chroma';
import {OpenAIEmbeddings} from '@langchain/openai';
import {Document} from 'langchain/document';

const embedder = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
  dimensions: 1536,
});

export async function embedPDF(collectionName: string, docs: Document[]) {
  const vectorStore = await createVectorStore(collectionName, docs);

  return vectorStore;
}

async function createVectorStore(
  collectionName: string,
  docs: Document<Record<string, any>>[],
  options?: Omit<ChromaLibArgs, 'collectionName'>
) {
  // Create vector store and index the docs
  const vectorStore = await Chroma.fromDocuments(docs, embedder, {
    collectionName,
    url: process.env.CHROMA_DB_HOST,
    ...options,
  });

  return vectorStore;
}

export async function queryCollection(
  collectionName: string,
  prompt: string,
  options?: Omit<ChromaLibArgs, 'collectionName'>
) {
  if (!(await isFileAlreadyEmbedded(collectionName))) {
    throw new Error('Document not found in vector store');
  }

  const vectorStore = await Chroma.fromExistingCollection(embedder, {
    collectionName,
    url: process.env.CHROMA_DB_HOST,
    ...options,
  });

  const result = await vectorStore.similaritySearch(prompt);

  return result;
}

export async function isFileAlreadyEmbedded(
  fileHash: string,
  options?: Omit<ChromaLibArgs, 'collectionName'>
): Promise<boolean> {
  const chromaClient = new Chroma(embedder, {
    collectionName: fileHash,
    ...options,
  });

  return ((await chromaClient.collection?.count()) || 0) > 0;
}
