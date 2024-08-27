import {pdfParsingOutputScheme} from '@/app/common/types/PdfParsingOutput';
import {isBlankString} from '@/app/common/utils/stringUtils';
import {CharacterTextSplitter} from 'langchain/text_splitter';
import {NextRequest, NextResponse} from 'next/server';
import util from 'node:util';
import {z} from 'zod';
import {
  deleteFileByHash,
  getFileByHash,
  initStorage,
  setFileByHash,
} from '../db/uploaded-files-db/files';
import {deleteCollection, embedPDF} from '../db/vector-db/VectorDB';
import {getFileHash} from '../utils/fileUtils';
import {
  chunkSectionNodes,
  chunkString,
  markdownToSectionsJson,
} from './chunking';
import {lintAndFixMarkdown, parsePdf, pdfParseWithPdfreader} from './functions';

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  try {
    const inputSchema = z
      .object({
        file: z
          .instanceof(File)
          .refine(
            (file) => file.type === 'application/pdf',
            'File must be a PDF'
          )
          .refine(
            (file) => file.size > 0,
            'File must have a size greater than 0. Maybe the file is corrupted.'
          ),
        columnsNumber: z.coerce.number().min(1),
        output: z.lazy(() => pdfParsingOutputScheme),
        force: z
          .union([z.literal('true'), z.literal('false')])
          .optional()
          .transform((value) => value === 'true'),
      })
      .strict();

    const {
      file,
      columnsNumber,
      output,
      force = false,
    } = inputSchema.parse(Object.fromEntries(formData));

    const fileHash = await getFileHash(file);
    await initStorage();

    if (force) {
      const fileUUID = await getFileByHash(fileHash);

      if (fileUUID !== null) {
        try {
          await deleteCollection(fileUUID.collectionName);
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === 'Document not found in vector store'
          ) {
            console.warn(
              "Trying to delete a non existent document in vector db, so it's fine"
            );
          } else {
            throw error;
          }
        }

        await deleteFileByHash(fileHash);
      }
    } else {
      if ((await getFileByHash(fileHash)) !== null) {
        throw new Error('File already embedded in the database.');
      }
    }

    const parseResult = await parsePdf({file, output, force, columnsNumber});

    switch (parseResult.contentType) {
      case 'json':
        // ⚠️ Outdated methods
        console.warn('Outdated method called');

        return NextResponse.json({
          result: JSON.parse(parseResult.text),
          cachedTimestamp: parseResult.cachedTime,
        });

      case 'string':
        // ⚠️ Outdated methods
        console.warn('Outdated method called');

        return NextResponse.json({
          result: parseResult.text,
          cachedTimestamp: parseResult.cachedTime,
        });

      case 'markdown':
        const lintedMarkdown = lintAndFixMarkdown(parseResult.text);
        const mdToJson = await markdownToSectionsJson(lintedMarkdown);

        const sentenceSplitter = new CharacterTextSplitter({
          chunkSize: 20,
          chunkOverlap: 0,
          keepSeparator: false,
          separator: '. ',
        });

        const sectionChunks = await chunkSectionNodes(
          mdToJson,
          sentenceSplitter
        );
        // TODO:
        // - Parse with pdfreader.
        //
        // - Chunk pdfreader output
        //
        // - Match section text chunk to pdfreader chunk (or maybe chunks
        //   if they aren't the same).
        //     -- Skip table chunks
        //
        // - Reconcile LLM chunk with pdfreader chunk(s) to fix
        //   hallucinations with some difference tolerance.

        const traditionalParsedText = await pdfParseWithPdfreader({
          file,
          columnsNumber,
        });

        if (isBlankString(traditionalParsedText)) {
          throw new Error("Parser 'pdfreader' produced an empty file");
        }

        const traditionalChunks = await chunkString({
          text: traditionalParsedText,
          splitter: sentenceSplitter,
        });

        const sortedSectionChunks = sectionChunks
          .sort((a, b) => a.pageContent.localeCompare(b.pageContent, 'en'))
          .slice(0, 15);

        const traditionalSortedChunks = traditionalChunks
          .sort((a, b) => a.pageContent.localeCompare(b.pageContent, 'en'))
          .slice(0, 15);

        console.log(
          'heeey 6.7',
          util.inspect(
            {
              sectionChunks: sortedSectionChunks,
              traditionalChunks: traditionalSortedChunks,
            },
            {
              showHidden: false,
              colors: true,
              depth: null,
            }
          )
        );

        console.log('heeey 6.8', {
          sectionChunks: sortedSectionChunks.map((c) => ({
            text: c.pageContent,
            order: c.metadata.order,
          })),
          traditionalChunks: traditionalSortedChunks.map((c) => ({
            text: c.pageContent,
            order: c.metadata.order,
          })),
        });

        throw new Error('TEMPORARY DEBUG ERROR');

        const store = await embedPDF(fileHash, sectionChunks);
        await setFileByHash(fileHash, {collectionName: store.collectionName});

        return NextResponse.json({
          result: {
            id: store.collectionName,
            metadata: store.collectionMetadata,
          },
          cachedTimestamp: parseResult.cachedTime,
        });

      default:
        throw new Error('Unsupported content type');
    }
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {error: (error as Error)?.message ?? 'Unknown error'},
      {status: 500}
    );
  }
}
