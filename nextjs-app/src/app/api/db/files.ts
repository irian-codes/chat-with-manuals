type fileDetails = {
  collectionName: string;
};

/**
 * A debug database for storing hashes of files and their corresponding file IDs.
 * It represents the files ALREADY EMBEDDED in Chroma DB
 * This is used for mocking the database in development and testing.
 */
const embeddedFilesDb = new Map<string, fileDetails>([
  [
    'B5EA203DE2EE4C8E46F0417944A9A9485B412BE11668AA4009DE58418FE47AE6'
      .toLowerCase()
      .trim(),
    {
      collectionName: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
        .toLowerCase()
        .trim(),
    },
  ],
  [
    '17C29F7785FF3A7E457F0DE10FB86556090C5B398BFAA20A602116E700519B28'
      .toLowerCase()
      .trim(),
    {
      collectionName: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed'
        .toLowerCase()
        .trim(),
    },
  ],
  [
    'ff95ba761c3a20a85d21fef0754f40ebe56f395573e8de6b820e390740a3eeeb'
      .toLowerCase()
      .trim(),
    {
      collectionName: '81e5957f-fa39-4701-9adf-5df897b2d671'
        .toLowerCase()
        .trim(),
    },
  ],
]);

export default embeddedFilesDb;
