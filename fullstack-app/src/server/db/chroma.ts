import {env} from '@/env';
import {
  Chroma,
  type ChromaLibArgs,
} from '@langchain/community/vectorstores/chroma';
import {OpenAIEmbeddings} from '@langchain/openai';
import {ChromaClient, type GetParams, IncludeEnum} from 'chromadb';
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

export async function embedPDF({
  fileHash,
  locale,
  docs,
}: {
  fileHash: string;
  locale: string;
  docs: Document[];
}) {
  const vectorStore = await createVectorStore(docs, {
    collectionMetadata: {
      documentType: 'pdf',
      fileHash,
      locale,
      'hnsw:space': 'cosine',
    },
  });

  if (!(await doesCollectionExists(vectorStore.collectionName))) {
    throw new Error('Document could not be embedded in vector store');
  }

  return vectorStore;
}

async function createVectorStore(
  docs: Document<Record<string, unknown>>[],
  options?: Omit<ChromaLibArgs, 'collectionName'>
) {
  // Create vector store and index the docs
  const vectorStore = await Chroma.fromDocuments(docs, createEmbedder(), {
    collectionName: uuidv4(),
    url: env.CHROMA_DB_HOST,
    ...options,
  });

  return vectorStore;
}

export async function getDocs({
  collectionName,
  options,
  dbQuery,
  throwOnEmptyReturn,
}: {
  collectionName: string;
  dbQuery: GetParams;
  options?: Omit<ChromaLibArgs, 'collectionName' | 'filter'>;
  throwOnEmptyReturn: boolean;
}) {
  if (dbQuery == null || typeof dbQuery !== 'object') {
    throw new Error("'dbQuery' parameter must be an object");
  }

  const vectorStore = getChromaCachedClient({
    collectionName,
    url: env.CHROMA_DB_HOST,
    ...options,
  });

  const collection = await vectorStore.ensureCollection();

  if ((await collection.count()) === 0) {
    throw new Error('Document not found in vector store');
  }

  if (
    dbQuery.include != null &&
    !dbQuery.include?.includes(IncludeEnum.Documents)
  ) {
    throw new Error(
      'You should request at least documents, otherwise this method will fail'
    );
  }

  const res = await collection.get(dbQuery);

  if (throwOnEmptyReturn && res.documents.length === 0) {
    throw new Error(
      "ChromaDB returned no valid chunks due to an unknown error. Ensure you're not passing an AbortSignal.timeout() that is too short and the DB is reachable."
    );
  }

  const docs = res.documents
    .filter((doc: unknown): doc is string => doc != null)
    .map(
      (doc: string, i: number) =>
        new Document({
          pageContent: doc,
          metadata: res.metadatas[i] ?? {},
        })
    );

  return docs;
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
    throw new Error(
      'Document not found in vector store. Collection name: ' + collectionName
    );
  }

  const vectorStore = getChromaCachedClient({
    collectionName,
    url: env.CHROMA_DB_HOST,
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
    url: env.CHROMA_DB_HOST,
    ...options,
  });

  const collection = await chromaClient.ensureCollection();

  return (await collection.count()) > 0;
}

export async function deleteCollection(collectionName: string) {
  const client = new ChromaClient({path: env.CHROMA_DB_HOST});

  try {
    await client.deleteCollection({name: collectionName});
  } catch (error) {
    if (
      error instanceof Error &&
      String(error.cause).includes('ECONNREFUSED')
    ) {
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
  const client = new ChromaClient({path: env.CHROMA_DB_HOST});

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

      throw error;
    } else {
      // @ts-expect-error This is not en Error instance so we have to check like this
      if (error?.status === 500) {
        throw new Error(
          "Couldn't reset ChromaDB. Please ensure environment variable ALLOW_RESET is set to true in ChromaDB Docker container. Also, check the underlying error to be sure what's wrong.",
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
