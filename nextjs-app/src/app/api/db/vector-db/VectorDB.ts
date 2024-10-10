import {getEnvVars} from '@/app/common/env';
import {Chroma, ChromaLibArgs} from '@langchain/community/vectorstores/chroma';
import {OpenAIEmbeddings} from '@langchain/openai';
import {ChromaClient} from 'chromadb';
import {Document} from 'langchain/document';
import {v4 as uuidv4} from 'uuid';
import {z} from 'zod';

function createEmbedder() {
  return new OpenAIEmbeddings({
    model: 'text-embedding-3-small',
    dimensions: 1536,
  });
}

function cacheClient() {
  const vectorStores = new Map<string, Chroma>();

  return function (params: ChromaLibArgs) {
    const serializedParams = JSON.stringify(params);

    if (vectorStores.has(serializedParams)) {
      return vectorStores.get(serializedParams)!;
    } else {
      const vectorStore = new Chroma(createEmbedder(), params);
      vectorStores.set(serializedParams, vectorStore);

      return vectorStore;
    }
  };
}

const getChromaCachedClient = cacheClient();

export async function embedPDF(fileHash: string, docs: Document[]) {
  const vectorStore = await createVectorStore(docs, {
    collectionMetadata: {
      'hnsw:space': 'cosine',
      fileHash,
    },
  });

  if (!(await doesCollectionExists(vectorStore.collectionName))) {
    throw new Error('Document could not be embedded in vector store');
  }

  return vectorStore;
}

async function createVectorStore(
  docs: Document<Record<string, any>>[],
  options?: Omit<ChromaLibArgs, 'collectionName'>
) {
  // Create vector store and index the docs
  const vectorStore = await Chroma.fromDocuments(docs, createEmbedder(), {
    collectionName: uuidv4(),
    url: getEnvVars().CHROMA_DB_HOST,
    ...options,
  });

  return vectorStore;
}

export async function queryCollection({
  collectionName,
  prompt,
  topK = 4,
  throwOnEmptyReturn,
  options,
}: {
  collectionName: string;
  prompt: string;
  topK: number;
  throwOnEmptyReturn: boolean;
  options?: Omit<ChromaLibArgs, 'collectionName'>;
}) {
  if (!(await doesCollectionExists(collectionName))) {
    throw new Error('Document not found in vector store');
  }

  const vectorStore = getChromaCachedClient({
    collectionName,
    url: getEnvVars().CHROMA_DB_HOST,
    ...options,
  });

  const result = await vectorStore.similaritySearch(prompt, topK);

  if (
    throwOnEmptyReturn &&
    !z.array(z.instanceof(Document)).nonempty().safeParse(result).success
  ) {
    // Sometimes instead of crashing with an error it just returns empty,
    // so we have to add an extra error here.
    throw new Error(
      "ChromaDB returned no valid chunks due to an unknown error. Ensure you're not passing an AbortSignal.timeout() that is too short and the DB is reachable."
    );
  }

  return result;
}

export async function doesCollectionExists(
  collectionName: string,
  options?: Omit<ChromaLibArgs, 'collectionName'>
): Promise<boolean> {
  // Double checking
  const chromaClient = getChromaCachedClient({
    collectionName,
    url: getEnvVars().CHROMA_DB_HOST,
    ...options,
  });

  const collection = await chromaClient.ensureCollection();

  return (await collection.count()) > 0;
}

export async function deleteCollection(collectionName: string) {
  const client = new ChromaClient({path: getEnvVars().CHROMA_DB_HOST});

  try {
    await client.deleteCollection({name: collectionName});
  } catch (error) {
    if (String(error.cause).includes('ECONNREFUSED')) {
      throw new Error(
        'Could not connect to ChromaDB. Please restart the instance and try again.',
        {
          cause: error,
        }
      );
    } else {
      throw error;
    }
  }
}

export async function clearDatabase() {
  const client = new ChromaClient({path: getEnvVars().CHROMA_DB_HOST});

  try {
    await client.reset();
  } catch (error) {
    if (error instanceof Error) {
      if (String(error.cause).includes('ECONNREFUSED')) {
        throw new Error(
          'Could not connect to ChromaDB. Please restart the instance and try again.',
          {
            cause: error,
          }
        );
      }
    } else {
      if (error.status === 500) {
        throw new Error(
          "Couldn't reset ChromaDB. Please ensure environment variable ALLOW_RESET is set to true in ChromaDB Docker container. Also, check the underlaying error to be sure what's wrong.",
          {
            cause: error,
          }
        );
      } else {
        throw error;
      }
    }
  }
}
