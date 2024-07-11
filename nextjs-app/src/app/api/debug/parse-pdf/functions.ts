import {
  saveFileObjectToFileSystem,
  writeToTimestampedFile,
} from '@/app/api/utils/fileUtils';
import {PdfParsingOutput} from '@/app/common/types/PdfParsingOutput';
import {isBlankString} from '@/app/common/utils/stringUtils';
import {PDFLoader} from '@langchain/community/document_loaders/fs/pdf';
import {LlamaParseReader} from 'llamaindex/readers/index';
import {LLMWhispererClient} from 'llmwhisperer-client';
import {Marked} from 'marked';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import PDFParser, {Output} from 'pdf2json';
import {UnstructuredClient} from 'unstructured-client';
import {PartitionResponse} from 'unstructured-client/sdk/models/operations';
import {
  ChunkingStrategy,
  Strategy,
} from 'unstructured-client/sdk/models/shared';

export async function parsePdf(
  file: File,
  output: PdfParsingOutput,
  force: boolean = false
): Promise<{
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

      return {
        text: fs.readFileSync(cachedFile.path).toString('utf-8'),
        contentType,
        cachedTime: cachedFile.timestamp,
      };
    }
  }

  // If the file is not present, well, then parse it.
  switch (output) {
    case 'json': {
      const res = await pdfParseToJson(file);
      writeToTimestampedFile(
        res,
        'tmp',
        `${file.name}_parser-${output}`,
        'json'
      );

      return {text: res, contentType: 'json', cachedTime: null};
    }

    case 'langchain': {
      const loader = new PDFLoader(file);
      const docs = await loader.load();
      const text = docs.map((d) => d.pageContent).join('\n\n') ?? '';

      writeToTimestampedFile(
        !isBlankString(text) ? text : 'UNDEFINED',
        'tmp',
        `${file.name}_parser-${output}`,
        'txt'
      );

      return {text, contentType: 'string', cachedTime: null};
    }

    case 'unstructured': {
      const unstructuredRes = await pdfParseWithUnstructured(file);

      writeToTimestampedFile(
        JSON.stringify(unstructuredRes, null, 2),
        'tmp',
        `${file.name}_parser-${output}`,
        'json'
      );

      return {
        text: JSON.stringify(unstructuredRes, null, 2),
        contentType: 'json',
        cachedTime: null,
      };
    }

    case 'llmwhisperer': {
      const llmwhispererRes = await pdfParseWithLLMWhisperer(file);
      const text = llmwhispererRes ?? '';

      writeToTimestampedFile(
        !isBlankString(text) ? text : 'UNDEFINED',
        'tmp',
        `${file.name}_parser-${output}`,
        'txt'
      );

      return {text, contentType: 'string', cachedTime: null};
    }

    case 'llamaparse': {
      const llamaparseRes = await pdfParseWithLlamaparse(file);
      const text = llamaparseRes.map((d) => d.getText()).join('') ?? '';

      writeToTimestampedFile(
        !isBlankString(text) ? text : 'UNDEFINED',
        'tmp',
        `${file.name}_parser-${output}`,
        'md'
      );

      return {text, contentType: 'markdown', cachedTime: null};
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

async function pdfParseWithLlamaparse(file: File) {
  // DOCS: https://docs.cloud.llamaindex.ai/llamaparse/getting_started/typescript

  const key = process.env.LLAMA_CLOUD_API_KEY;

  if (!key) {
    throw new Error('LLAMA_CLOUD_API_KEY is not set');
  }

  const reader = new LlamaParseReader({
    resultType: 'markdown',
    language: 'en',
    skipDiagonalText: false,
    doNotUnrollColumns: false,
    pageSeparator: '\n<<<NEW_PAGE>>>\n',
    gpt4oMode: true,
    parsingInstruction:
      "You're parsing a ttrpg manual that contains text, tables, images an character cards (treat them as tables). Parse each content appropriately in the markdown format.",
  });

  // parse the document
  const documents = await reader.loadDataAsContent(
    Buffer.from(await file.arrayBuffer()),
    file.name
  );

  return documents;
}

export function markdownToJson(markdown: string) {
  const marked = new Marked();

  return marked.lexer(markdown);
}

async function findMostRecentParsedFilePath(
  fileName: string,
  output: string
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
