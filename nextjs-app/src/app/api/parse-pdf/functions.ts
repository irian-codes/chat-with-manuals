import {
  saveFileObjectToFileSystem,
  writeToTimestampedFile,
} from '@/app/api/utils/fileUtils';
import {PdfParsingOutput} from '@/app/common/types/PdfParsingOutput';
import {isBlankString} from '@/app/common/utils/stringUtils';
import DocumentIntelligence, {
  AnalyzeResultOperationOutput,
  getLongRunningPoller,
  isUnexpected,
} from '@azure-rest/ai-document-intelligence';
import {AzureKeyCredential} from '@azure/core-auth';
import {PDFLoader} from '@langchain/community/document_loaders/fs/pdf';
import pdf2md from '@opendocsg/pdf2md';
import {LlamaParseReader} from 'llamaindex/readers/index';
import {LLMWhispererClient} from 'llmwhisperer-client';
import markdownlint from 'markdownlint';
import markdownlintRuleHelpers from 'markdownlint-rule-helpers';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import PDFParser, {Output} from 'pdf2json';
import {Item, PdfReader} from 'pdfreader';
import {UnstructuredClient} from 'unstructured-client';
import {PartitionResponse} from 'unstructured-client/sdk/models/operations';
import {
  ChunkingStrategy,
  Strategy,
} from 'unstructured-client/sdk/models/shared';
import {z} from 'zod';

export async function parsePdf({
  file,
  columnsNumber = 1,
  output,
  force = false,
}: {
  file: File;
  columnsNumber: number;
  output: PdfParsingOutput;
  force?: boolean;
}): Promise<{
  text: string;
  contentType: 'json' | 'string' | 'markdown';
  cachedTime: number | null;
}> {
  assert(file.type === 'application/pdf', 'File is not a pdf');

  if (!force) {
    // Check if file is already parsed and stored in ./tmp folder
    const cachedFile = await findMostRecentParsedFilePath(file.name, output);

    if (cachedFile) {
      const contentType = (() => {
        switch (path.extname(cachedFile.path)) {
          case '.json':
            return 'json';

          case '.txt':
            return 'string';

          case '.md':
            return 'markdown';

          default:
            throw new Error('Unsupported content type');
        }
      })();

      const result = {
        text: fs.readFileSync(cachedFile.path).toString('utf-8'),
        contentType,
        cachedTime: cachedFile.timestamp,
      } as const;

      if (result.text.trim().length === 0 || result.text === 'UNDEFINED') {
        throw new Error(
          'File retrieved from cache is empty. Path: ' + cachedFile.path
        );
      }

      return result;
    }
  }

  // If the file is not present, well, then parse it.
  switch (output) {
    case 'json': {
      const res = await pdfParseToJson(file);
      writeToTimestampedFile({
        content: res,
        destinationFolderPath: 'tmp',
        fileName: `${file.name}_parser-${output}`,
        fileExtension: 'json',
        prefix: 'parsedPdf',
      });

      return {text: res, contentType: 'json', cachedTime: null};
    }

    case 'langchain': {
      const loader = new PDFLoader(file);
      const docs = await loader.load();
      const text = docs.map((d) => d.pageContent).join('\n\n') ?? '';

      if (isBlankString(text)) {
        throw new Error(`Parser ${output} produced an empty file`);
      }

      writeToTimestampedFile({
        content: text,
        destinationFolderPath: 'tmp',
        fileName: `${file.name}_parser-${output}`,
        fileExtension: 'txt',
        prefix: 'parsedPdf',
      });

      return {text, contentType: 'string', cachedTime: null};
    }

    case 'unstructured': {
      const unstructuredRes = await pdfParseWithUnstructured(file);

      writeToTimestampedFile({
        content: JSON.stringify(unstructuredRes, null, 2),
        destinationFolderPath: 'tmp',
        fileName: `${file.name}_parser-${output}`,
        fileExtension: 'json',
        prefix: 'parsedPdf',
      });

      return {
        text: JSON.stringify(unstructuredRes, null, 2),
        contentType: 'json',
        cachedTime: null,
      };
    }

    case 'llmwhisperer': {
      const llmwhispererRes = await pdfParseWithLLMWhisperer(file);
      const text = llmwhispererRes ?? '';

      if (isBlankString(text)) {
        throw new Error(`Parser ${output} produced an empty file`);
      }

      writeToTimestampedFile({
        content: text,
        destinationFolderPath: 'tmp',
        fileName: `${file.name}_parser-${output}`,
        fileExtension: 'txt',
        prefix: 'parsedPdf',
      });

      return {text, contentType: 'string', cachedTime: null};
    }

    case 'llamaparse': {
      const llamaparseRes = await pdfParseWithLlamaparse(file, false);
      const text = llamaparseRes.map((d) => d.getText()).join('') ?? '';

      if (isBlankString(text)) {
        throw new Error(`Parser ${output} produced an empty file`);
      }

      writeToTimestampedFile({
        content: text,
        destinationFolderPath: 'tmp',
        fileName: `${file.name}_parser-${output}`,
        fileExtension: 'md',
        prefix: 'parsedPdf',
      });

      return {text, contentType: 'markdown', cachedTime: null};
    }

    case 'llamaparse-fastmode': {
      const llamaparseRes = await pdfParseWithLlamaparse(file, true);
      const text = llamaparseRes.map((d) => d.getText()).join('') ?? '';

      if (isBlankString(text)) {
        throw new Error(`Parser ${output} produced an empty file`);
      }

      writeToTimestampedFile({
        content: text,
        destinationFolderPath: 'tmp',
        fileName: `${file.name}_parser-${output}`,
        fileExtension: 'txt',
        prefix: 'parsedPdf',
      });

      return {text, contentType: 'string', cachedTime: null};
    }

    case 'azure-document-intelligence': {
      const azureDocumentIntelligenceRes =
        await pdfParseWithAzureDocumentIntelligence(file);

      const text = azureDocumentIntelligenceRes ?? '';

      if (isBlankString(text)) {
        throw new Error(`Parser ${output} produced an empty file`);
      }

      writeToTimestampedFile({
        content: text,
        destinationFolderPath: 'tmp',
        fileName: `${file.name}_parser-${output}`,
        fileExtension: 'md',
        prefix: 'parsedPdf',
      });

      return {text, contentType: 'markdown', cachedTime: null};
    }

    case '@opendocsg-pdf2md': {
      const text = await pdf2md(await file.arrayBuffer());

      if (isBlankString(text)) {
        throw new Error(`Parser ${output} produced an empty file`);
      }

      writeToTimestampedFile({
        content: text,
        destinationFolderPath: 'tmp',
        fileName: `${file.name}_parser-${output}`,
        fileExtension: 'md',
        prefix: 'parsedPdf',
      });

      return {text, contentType: 'markdown', cachedTime: null};
    }

    case 'pdfreader': {
      const text = await pdfParseWithPdfReader({file, columnsNumber});

      if (isBlankString(text)) {
        throw new Error(`Parser ${output} produced an empty file`);
      }

      writeToTimestampedFile({
        content: text,
        destinationFolderPath: 'tmp',
        fileName: `${file.name}_parser-${output}`,
        fileExtension: 'txt',
        prefix: 'parsedPdf',
      });

      return {text, contentType: 'string', cachedTime: null};
    }

    default: {
      throw new Error('Not implemented');
    }
  }
}

async function pdfParseToJson(file: File) {
  const pdfParser = new PDFParser();

  const parsedPdf: Output | Error = await new Promise(
    async (resolve, reject) => {
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        resolve(pdfData);
      });

      pdfParser.on('pdfParser_dataError', (errData) => {
        reject(errData.parserError);
      });

      pdfParser.parseBuffer(Buffer.from(await file.arrayBuffer()));
    }
  );

  if (parsedPdf instanceof Error) {
    throw parsedPdf;
  }

  return JSON.stringify(parsedPdf, null, 2);
}

async function pdfParseWithUnstructured(file: File) {
  // Before calling the API, replace filename and ensure sdk is installed: "npm install unstructured-client"
  // See https://docs.unstructured.io/api-reference/api-services/sdk for more details

  const key = process.env.UNSTRUCTURED_API_KEY;

  if (!key) {
    throw new Error('UNSTRUCTURED_API_KEY is not set');
  }

  const client = new UnstructuredClient({
    serverURL: 'https://api.unstructuredapp.io',
    security: {
      apiKeyAuth: key,
    },
  });

  const data = Buffer.from(await file.arrayBuffer());

  try {
    const res: PartitionResponse = await client.general.partition({
      partitionParameters: {
        files: {
          content: data,
          fileName: file.name,
        },
        strategy: Strategy.Fast,
        languages: ['eng'],
        uniqueElementIds: true,
        chunkingStrategy: ChunkingStrategy.ByTitle,
        maxCharacters: 500,
        includeOrigElements: false,
        combineUnderNChars: 16,
      },
    });

    if (res.statusCode == 200) {
      return res.elements;
    }
  } catch (error) {
    if (error.statusCode != null) {
      console.error(error.statusCode);
      console.error(error.body);
    } else {
      console.error(error);
    }

    throw error;
  }
}
async function pdfParseWithLLMWhisperer(file: File) {
  const key = process.env.LLMWHISPERER_API_KEY;

  if (!key) {
    throw new Error('LLMWHISPERER_API_KEY is not set');
  }

  const client = new LLMWhispererClient();

  const whisperJob = await client.whisper({
    filePath: await saveFileObjectToFileSystem(file),
    processingMode: 'text',
    outputMode: 'line-printer',
  });

  if (whisperJob.statusCode == 200) {
    return whisperJob.extracted_text;
  } else if (whisperJob.statusCode == 202) {
    // Keep polling until completed
    const whisperHash = whisperJob['whisper-hash'];
    let whisperStatus = whisperJob.status;

    while (whisperStatus === 'processing') {
      console.log('LLMWhisperer: Processing... ' + whisperHash);

      //Let's check every second
      await new Promise((r) => setTimeout(r, 4000));
      whisperStatus =
        (await client.whisperStatus(whisperHash)).status ?? 'unknown';
    }

    if (whisperStatus === 'processed') {
      //Retrieve the result
      const whisper = await client.whisperRetrieve(whisperHash);
      return whisper.extracted_text;
    } else {
      throw new Error('LLMWhisperer: Job failed. Status: ' + whisperStatus);
    }
  } else {
    throw new Error(
      'LLMWhisperer: Job failed. Status Code: ' + whisperJob.statusCode
    );
  }
}

async function pdfParseWithLlamaparse(file: File, textOnly: boolean) {
  // DOCS: https://docs.cloud.llamaindex.ai/llamaparse/getting_started/typescript

  const key = process.env.LLAMA_CLOUD_API_KEY;

  if (!key) {
    throw new Error('LLAMA_CLOUD_API_KEY is not set');
  }

  const reader = (() => {
    if (textOnly) {
      return new LlamaParseReader({
        resultType: 'text',
        fastMode: true,
        language: 'en',
        skipDiagonalText: false,
        doNotUnrollColumns: false,
        pageSeparator: '\n\n\n\n\n\n',
        parsingInstruction:
          "You're parsing a fictitious document, the contents of this document do not reflect nor depict any real situations, it's safe to parse it. Return as much information from the document as possible, don't skip any text from the document",
        invalidateCache: true,
        doNotCache: true,
        verbose: true,
      });
    } else {
      return new LlamaParseReader({
        resultType: 'markdown',
        language: 'en',
        skipDiagonalText: false,
        doNotUnrollColumns: false,
        pageSeparator: '\n\n\n\n\n\n',
        useVendorMultimodalModel: true,
        vendorMultimodalModelName: 'openai-gpt-4o-mini',
        parsingInstruction:
          "You're parsing a fictitious document, the contents of this document do not reflect nor depict any real situations, it's safe to parse it. Return as much information from the document as possible, don't skip any text from the document",
        invalidateCache: true,
        doNotCache: true,
        verbose: true,
      });
    }
  })();

  // parse the document
  const documents = await reader.loadDataAsContent(
    Buffer.from(await file.arrayBuffer()),
    file.name
  );

  if (documents.length === 0) {
    throw new Error('Llamaparse: The document could not be parsed');
  }

  return documents;
}

export async function pdfParseWithAzureDocumentIntelligence(file: File) {
  const client = DocumentIntelligence(
    'https://chat-with-manuals-document-parser.cognitiveservices.azure.com/',
    new AzureKeyCredential(
      process.env.AZURE_DOCUMENT_INTELLIGENCE_API_KEY ?? ''
    )
  );

  const initialResponse = await client
    .path('/documentModels/{modelId}:analyze', 'prebuilt-layout')
    .post({
      contentType: 'application/json',
      body: {
        base64Source: Buffer.from(await file.arrayBuffer()).toString('base64'),
      },
      queryParameters: {outputContentFormat: 'markdown', locale: 'en'},
    });

  if (isUnexpected(initialResponse)) {
    throw initialResponse.body.error;
  }

  const poller = await getLongRunningPoller(client, initialResponse);
  const result = (await poller.pollUntilDone())
    .body as AnalyzeResultOperationOutput;

  assert(result.analyzeResult?.contentFormat === 'markdown');

  if (result.analyzeResult.content.length === 0) {
    throw new Error(
      'Azure Document Intelligence: The document could not be parsed'
    );
  }

  return result.analyzeResult.content;
}

export async function pdfParseWithPdfReader({
  file,
  columnsNumber,
}: {
  file: File | Buffer;
  columnsNumber: number;
}): Promise<string> {
  const pdfParseWithPdfreaderSchema = z.object({
    file: z.union([z.instanceof(File), z.instanceof(Buffer)]),
    columnsNumber: z.number().int().min(1).max(2),
  });

  pdfParseWithPdfreaderSchema.parse({
    file,
    columnsNumber,
  });

  const fileBuffer = Buffer.isBuffer(file)
    ? file
    : Buffer.from(await file.arrayBuffer());

  type PageData = {page: number; width: number; height: number};
  type ItemData = Item & {
    column: 'left' | 'right';
    page: {num: number; width: number; height: number};
  };
  type FileData = {file: {path: string}};
  type PdfItem = FileData | PageData | Item;

  const pages: string[] = [];

  // Obtaining all items
  await new Promise((resolve, reject) => {
    let leftColumn: ItemData[] = [];
    let rightColumn: ItemData[] = [];
    let currentPage: PageData = {page: 0, width: 0, height: 0};
    let lastHeight = 0;

    new PdfReader().parseBuffer(fileBuffer, (err, item: PdfItem | null) => {
      if (err) {
        reject(err);
      } else if (item == null) {
        // Processing last page
        pushPage();
        resolve([]);
      } else if ('text' in item) {
        // Determine which column the text belongs to based on the x-coordinate
        const columnBoundary = currentPage.width / columnsNumber;
        const column = item.x <= columnBoundary ? 'left' : 'right';
        const newItem = {
          ...item,
          column,
          page: {
            num: currentPage.page,
            height: currentPage.height,
            width: currentPage.width,
          },
        } as const;

        if (column === 'left') {
          leftColumn.push(newItem);
        } else {
          rightColumn.push(newItem);
        }

        lastHeight = item.y;
      } else if ('page' in item) {
        // Processing previous page
        if (currentPage.page > 0) {
          pushPage();
        }

        leftColumn = [];
        rightColumn = [];
        currentPage = item;
      }
    });

    /**
     * Pushes the content of the current page to the pages array adding a
     * newline character when the line changes in the original PDF.
     */
    function pushPage() {
      let previousI: {y: number} | null = null;
      pages.push(
        [...leftColumn, ...rightColumn].reduce((acc, i) => {
          if (previousI?.y !== i.y) {
            acc += '\n';
          }

          previousI = i;
          return acc + i.text;
        }, '')
      );
    }
  });

  const parsedText = pages
    .join(' ')
    // Removing hyphens on newlines
    .replaceAll(/([a-z]+)-[\r\n]+([a-z]+[ .,:;!?\])’”"'»›]{0,1})/g, '$1$2\n')
    // Replacing double spaces and multiple newlines to single ones
    .replaceAll(/[ ]+/g, ' ')
    .replaceAll(/[\r\n]+/g, '\n')
    // Replacing unwanted extra spaces before and after punctuation characters
    .replaceAll(/([\w,:;!?\])’”"'»›])[ ]+([.,:;!?\])’”"'»›])/g, '$1$2')
    .replaceAll(/([\(\[`‘“"'«‹])[ ]+(\w)/g, '$1$2')
    // Replacing list characters to '-'
    .replaceAll(/^[•·o*—‒–][ ]+(\w)/gm, '- $1')
    .trim();

  return parsedText;
}

export function lintAndFixMarkdown(markdown: string) {
  // Sometimes the parser for whatever reason interprets the text as a code
  // block, so we fix this issue.
  if (markdown.startsWith('```') && markdown.endsWith('```')) {
    markdown = markdown.trim().substring(3, markdown.length - 3);
  }

  const results = markdownlint.sync({
    strings: {content: markdown},
    resultVersion: 3,
  });

  return markdownlintRuleHelpers.applyFixes(markdown, results.content);
}

async function findMostRecentParsedFilePath(
  fileName: string,
  output: PdfParsingOutput
): Promise<null | {
  path: string;
  timestamp: number;
}> {
  const tmpDir = path.join(process.cwd(), 'tmp');

  try {
    const files = fs.readdirSync(tmpDir);

    // Filter files based on naming convention and output type
    const filteredFiles = files.filter((file) => {
      const regex = new RegExp(
        `^parsedPdf_${fileName.replace('.', '\\.')}_parser-${output}.*_2\\d{11}.(json|txt|md)$`
      );

      return regex.test(file);
    });

    if (filteredFiles.length === 0) {
      return null; // No matching parsed file found
    }

    // Sort files by timestamp to get the most recent one
    const sortedFiles = filteredFiles.sort((fileA, fileB) => {
      const timestampA = extractTimestamp(fileA);
      const timestampB = extractTimestamp(fileB);

      return timestampB - timestampA; // Sort in descending order
    });

    // Return the path of the most recent file
    return {
      path: path.join(tmpDir, sortedFiles[0]),
      timestamp: extractTimestamp(sortedFiles[0]),
    };
  } catch (error) {
    console.error('Error finding most recent parsed file:', error);

    return null;
  }
}

function extractTimestamp(fileName: string): number {
  const match = fileName.match(/2\d{11}/);

  if (match) {
    return parseInt(match[0], 10);
  }

  // Return 0 if timestamp not found (shouldn't happen if file name matches regex)
  return 0;
}
