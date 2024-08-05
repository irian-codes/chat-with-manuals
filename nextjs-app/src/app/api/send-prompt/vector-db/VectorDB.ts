import {Chroma, ChromaLibArgs} from '@langchain/community/vectorstores/chroma';
import {OpenAIEmbeddings} from '@langchain/openai';
import {Document} from 'langchain/document';
import {v4 as uuidv4} from 'uuid';
import embeddedFilesDb from '../../db/files';

const embedder = new OpenAIEmbeddings({
  model: 'text-embedding-3-small',
  dimensions: 1536,
});

export async function embedPDF(fileHash: string, docs: Document[]) {
  const vectorStore = await createVectorStore(docs, {
    collectionMetadata: {
      fileHash,
    },
  });

  return vectorStore;
}

async function createVectorStore(
  docs: Document<Record<string, any>>[],
  options?: Omit<ChromaLibArgs, 'collectionName'>
) {
  // Create vector store and index the docs
  const vectorStore = await Chroma.fromDocuments(docs, embedder, {
    collectionName: uuidv4(),
    url: process.env.CHROMA_DB_HOST,
    ...options,
  });

  // Adding to the db
  embeddedFilesDb.set(vectorStore.collectionMetadata.fileHash, {
    collectionName: vectorStore.collectionName,
  });

  return vectorStore;
}

export async function queryCollection(
  collectionName: string,
  prompt: string,
  options?: Omit<ChromaLibArgs, 'collectionName'>
) {
  if (!(await doesCollectionExists(collectionName))) {
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

export async function doesCollectionExists(
  fileHash: string,
  options?: Omit<ChromaLibArgs, 'collectionName'>
): Promise<boolean> {
  if (!embeddedFilesDb.has(fileHash)) {
    return false;
  }

  // Double checking
  const chromaClient = new Chroma(embedder, {
    collectionName: embeddedFilesDb.get(fileHash)!.collectionName,
    ...options,
  });

  return ((await chromaClient.collection?.count()) || 0) > 0;
}
