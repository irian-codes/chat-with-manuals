import storage from 'node-persist';
import path from 'node:path';
import {z} from 'zod';

type ExtraFileData = {
  [key: string]: string;
};

/**
 * Represents a file entry in the database, accessed by the unique ID of the file.
 *
 * @property {string} key - Unique identifier of the file.
 * @property {Object} data - Data associated with the file.
 */
export type FileIdEntry = {
  key: string;
  data: {
    fileHash: string;
  } & ExtraFileData;
};

/**
 * Represents a file entry in the database, accessed by the hash of the file.
 *
 * @property {string} key - Hash of the file.
 * @property {Object} data - Data associated with the file.
 */
export type FileHashEntry = {
  key: string;
  data: {
    collectionName: string;
  } & ExtraFileData;
};

export async function initStorage() {
  await storage.init({
    dir: path.join(process.cwd(), 'tmp/db/node-persist'),
    logging: true,
  });
}

export async function getFileById(
  id: string
): Promise<FileIdEntry['data'] | null> {
  z.string().uuid().parse(id);

  const fileData = (await storage.getItem(id)) as
    | FileIdEntry['data']
    | undefined;

  return fileData ?? null;
}

export async function getAllFilesByUuid(): Promise<FileIdEntry['data'][]> {
  const fileDataList = (await storage.valuesWithKeyMatch(
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
  )) as FileIdEntry['data'][];

  return fileDataList;
}

export async function deleteFileById(
  id: string,
  recurse: boolean = true
): Promise<void> {
  z.string().uuid().parse(id);

  const fileData = await getFileById(id);

  await storage.removeItem(id);

  if (recurse) {
    if (fileData !== null) {
      await deleteFileByHash(fileData.fileHash, false);
    }
  }
}

export async function setFileById(
  id: string,
  fileData: FileIdEntry['data'],
  recurse: boolean = true
) {
  z.string().uuid().parse(id);

  await storage.setItem(id, fileData);

  if (recurse) {
    await setFileByHash(
      fileData.fileHash,
      {
        collectionName: id,
      },
      false
    );
  }
}

export async function getFileByHash(
  hash: string
): Promise<FileHashEntry['data'] | null> {
  if (/^[a-f0-9]{64}$/i.test(hash) === false) {
    throw new Error(
      'Invalid hash: the provided hash does not seem to be a SHA-256 hash'
    );
  }

  const fileData = (await storage.getItem(hash)) as
    | FileHashEntry['data']
    | undefined;

  return fileData ?? null;
}

export async function getAllFilesByHash(): Promise<FileHashEntry['data'][]> {
  const fileDataList = (await storage.valuesWithKeyMatch(
    /^[a-f0-9]{64}$/i
  )) as FileHashEntry['data'][];

  return fileDataList;
}

export async function setFileByHash(
  hash: string,
  fileData: FileHashEntry['data'],
  recurse: boolean = true
) {
  if (/^[a-f0-9]{64}$/i.test(hash) === false) {
    throw new Error(
      'Invalid hash: the provided hash does not seem to be a SHA-256 hash'
    );
  }

  await storage.setItem(hash, fileData);

  if (recurse) {
    await setFileById(
      fileData.collectionName,
      {
        fileHash: hash,
      },
      false
    );
  }
}

export async function deleteFileByHash(
  hash: string,
  recurse: boolean = true
): Promise<void> {
  if (/^[a-f0-9]{64}$/i.test(hash) === false) {
    throw new Error(
      'Invalid hash: the provided hash does not seem to be a SHA-256 hash'
    );
  }

  const fileData = await getFileByHash(hash);

  await storage.removeItem(hash);

  if (recurse) {
    if (fileData !== null) {
      await deleteFileById(fileData.collectionName, false);
    }
  }
}

export async function clearStorage() {
  await storage.clear();
}

export async function isEmpty() {
  return (await storage.length()) === 0;
}
