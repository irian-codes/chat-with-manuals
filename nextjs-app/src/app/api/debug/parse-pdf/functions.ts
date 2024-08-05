import {
  saveFileObjectToFileSystem,
  writeToTimestampedFile,
} from '@/app/api/utils/fileUtils';
import {PdfParsingOutput} from '@/app/common/types/PdfParsingOutput';
import {isBlankString} from '@/app/common/utils/stringUtils';
import {PDFLoader} from '@langchain/community/document_loaders/fs/pdf';
import {decodeHTML} from 'entities';
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter';
import {LlamaParseReader} from 'llamaindex/readers/index';
import {LLMWhispererClient} from 'llmwhisperer-client';
import {Marked} from 'marked';
import markedPlaintify from 'marked-plaintify';
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
    pageSeparator: '\n',
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

type SectionNode = {
  type: 'section';
  level: number;
  title: string;
  content: string;
  subsections: SectionNode[];
};

export async function markdownSectionsJson(markdown: string) {
  const plainMarked = new Marked().use({gfm: true}, markedPlaintify());
  const tokens = plainMarked.lexer(markdown);
  // This should be an array because the object itself acts as a fake root
  // node, in case there are more than one level 1 headings in the document
  const jsonStructure: SectionNode[] = [];
  const stack: SectionNode[] = [];
  let currentContent = '';

  for (const token of tokens) {
    if (token.type === 'heading') {
      // When we encounter a new heading, we should finalize the previous section content
      if (currentContent.length > 0) {
        stack[stack.length - 1].content = decodeHTML(
          await plainMarked.parse(currentContent.trim())
        );

        currentContent = '';
      }

      const node: SectionNode = {
        type: 'section',
        level: token.depth,
        title: token.text,
        content: '',
        subsections: [],
      };

      // Find the right place to insert the node based on its level
      while (stack.length > 0 && stack[stack.length - 1].level >= token.depth) {
        stack.pop();
      }

      if (stack.length === 0) {
        jsonStructure.push(node);
      } else {
        stack[stack.length - 1].subsections.push(node);
      }

      stack.push(node);
    } else {
      // Append the current token to the content string
      currentContent += token.raw;
    }
  }

  // Finalize the last section content
  if (currentContent && stack.length > 0) {
    stack[stack.length - 1].content = decodeHTML(
      await plainMarked.parse(currentContent.trim())
    );
  }

  return jsonStructure;
}

export async function chunkSectionsJson(sectionsJson: SectionNode[]) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 100,
    chunkOverlap: 0,
    separators: ['\n\n', '\n', '.', ' ', ''],
  });

  type Chunk = {
    headerRoute: string;
    headerRouteLevels: string;
    order: number;
    charSize: number;
    content: string;
  };

  async function chunkSectionContent({
    section,
    headerRoute,
    headerRouteLevels,
    chunks,
  }: {
    section: SectionNode;
    headerRoute: string;
    headerRouteLevels: string;
    chunks: Chunk[];
  }) {
    const splits = await splitter.splitText(section.content);

    const newChunks = splits.map(
      (text, index): Chunk => ({
        headerRoute,
        headerRouteLevels,
        order: index + 1,
        charSize: text.length,
        content: text.trim(),
      })
    );

    chunks.push(...newChunks);

    for (let i = 0; i < section.subsections.length; i++) {
      const subsection = section.subsections[i];

      await chunkSectionContent({
        section: subsection,
        headerRoute: `${headerRoute}>${subsection.title}`,
        headerRouteLevels: `${headerRouteLevels}>${i + 1}`,
        chunks,
      });
    }
  }

  const chunks: Chunk[] = [];

  for (let i = 0; i < sectionsJson.length; i++) {
    const section = sectionsJson[i];
    await chunkSectionContent({
      section,
      headerRoute: section.title,
      headerRouteLevels: `${i + 1}`,
      chunks,
    });
  }

  return chunks;
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
