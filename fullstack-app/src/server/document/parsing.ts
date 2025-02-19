import {env} from '@/env';
import {validateAndResolvePath} from '@/server/utils/fileStorage';
import {narrowType} from '@/utils/zod';
import {decodeHTML} from 'entities';
import ISO6391 from 'iso-639-1';
import {LlamaParseReader} from 'llamaindex';
import {applyFixes} from 'markdownlint';
import {lint as lintSync} from 'markdownlint/sync';
import {Marked} from 'marked';
import markedPlaintify from 'marked-plaintify';
import {PdfReader, type Item} from 'pdfreader';
import {z} from 'zod';

export async function pdfParseWithLlamaparse(params: {
  filePath: string;
  documentLanguage: string;
}): Promise<string> {
  const absolutePath = validateAndResolvePath(params.filePath);
  const language = z
    .string()
    .min(2)
    .refine(ISO6391.validate)
    .parse(params.documentLanguage);

  // TODO: Add one prompt per type of document. I have a current Chat GPT conversation about this titled: Board Game Manual Parsing
  const parsingInstruction = `The provided document is a board game manual. It features complex layouts that include images, arrows, icons replacing text, nested tables (such as character cards), and dice results, among other elements. Your task is to parse the document and output a coherent, readable, and understandable Markdown document by following these guidelines:

1. **Text Parsing:**  
   - Parse all text —including decorative text— to ensure no potentially important information is skipped.
   - If extra sections such as REMINDER, FUN FACT, or similar notes appear in between major sections, parse them into their own distinct subsections to prevent mixing with the main rules text.

2. **Tables and Subsections:**  
   - For nested tables (for example, character cards that may appear as tables within tables), treat them as new subsections and render the tables beneath the subsection header.

3. **Visual Elements and Iconography:**  
   - **Images:** Do not parse images (e.g., photos of game cards, tokens, boards).  
   - **Icons:** Only parse icons that carry meaningful information.  
     - If an icon (such as a die icon used in place of a text value) conveys important game mechanics, replace it with a concise textual description (e.g., convert “🎲” used to indicate a die result into “1” if that is the intended value).  
     - Ignore icons that are purely decorative (for instance, a sword icon preceding a header should be omitted).

4. **Game Mechanics:**  
   - Render dice results and other game-specific icons as brief, natural language descriptions that respect the document's flow and maintain clarity.

5. **Overall Structure:**  
   - Preserve the original structure and ordering of the document, while adjusting the formatting where necessary to ensure the parsed output is clear and easy to follow.

Apply these guidelines consistently to produce a Markdown document that is both faithful to the source material and optimized for human readability.`;

  const reader = new LlamaParseReader({
    apiKey: env.LLAMA_CLOUD_API_KEY,
    premiumMode: true,
    resultType: 'markdown',
    // TODO: Update when adding multi language support
    // @ts-expect-error since the type isn't exported we cannot check it, so we must ignore the error. If we pass an unsupported language it'll error out.
    language,
    skipDiagonalText: false,
    doNotUnrollColumns: false,
    pageSeparator: '\n\n\n\n\n\n',
    annotateLinks: false,
    parsingInstruction,
    isFormattingInstruction: false,
    invalidateCache: false,
    doNotCache: false,
    verbose: env.NODE_ENV === 'development',
  });

  // parse the document
  const documents = await reader.loadData(absolutePath);

  if (documents.length === 0) {
    throw new Error('Llamaparse: The document could not be parsed');
  }

  const markdown = documents.map((doc) => doc.getText()).join('') ?? '';

  return markdown;
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

  const pageDataSchema = z.object({
    page: z.number().gte(0),
    width: z.number(),
    height: z.number(),
  });

  const itemSchema = z.object({
    x: z.number(),
    y: z.number(),
    sw: z.number(),
    w: z.number(),
    A: z.string(),
    clr: z.number(),
    R: z.array(
      z.object({
        T: z.string(),
        S: z.number(),
        TS: z.array(z.any()),
      })
    ),
    text: z.string(),
  });

  const itemDataSchema = itemSchema.extend({
    column: z.enum(['left', 'right']),
    page: pageDataSchema,
  });

  const fileDataSchema = z.object({
    file: z.object({
      path: z.string(),
    }),
  });

  type PageData = z.infer<typeof pageDataSchema>;
  type ItemData = z.infer<typeof itemDataSchema>;
  type FileData = z.infer<typeof fileDataSchema>;
  type PdfItem = FileData | PageData | Item;

  const fileBuffer = Buffer.isBuffer(file)
    ? file
    : Buffer.from(await file.arrayBuffer());
  const pages: string[] = [];

  // Obtaining all items
  await new Promise((resolve, reject) => {
    let leftColumn: ItemData[] = [];
    let rightColumn: ItemData[] = [];
    let currentPage: PageData = {page: 0, width: 0, height: 0};
    let lastHeight = 0;

    new PdfReader().parseBuffer(
      fileBuffer,
      (err, item: Partial<PdfItem> | null) => {
        if (err) {
          reject(new Error(err));
        } else if (item == null) {
          // Processing last page
          pushPage();
          resolve([]);
        } else if (narrowType(itemSchema, item)) {
          // Determine which column the text belongs to based on the x-coordinate
          const columnBoundary = currentPage.width / columnsNumber;
          const column = item.x <= columnBoundary ? 'left' : 'right';
          const newItem = {
            ...item,
            column,
            page: {
              page: currentPage.page,
              height: currentPage.height,
              width: currentPage.width,
            },
          } satisfies ItemData;

          if (column === 'left') {
            leftColumn.push(newItem);
          } else {
            rightColumn.push(newItem);
          }

          lastHeight = item.y;
        } else if (narrowType(pageDataSchema, item)) {
          // Processing previous page
          if (currentPage.page > 0) {
            pushPage();
          }

          leftColumn = [];
          rightColumn = [];
          currentPage = item;
        }
      }
    );

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
    .replaceAll(/^[•·o*—‒–][ ]+([\w\r\n])/gm, '- $1')
    // Replacing quotes and equivalent symbols with '
    .replaceAll(/["’“”‟«»‹›]/g, "'")
    .trim();

  return parsedText;
}

export function lintAndFixMarkdown(markdown: string) {
  // Sometimes the parser for whatever reason interprets the text as a code
  // block, so we fix this issue.
  if (markdown.startsWith('```') && markdown.endsWith('```')) {
    markdown = markdown.trim().substring(3, markdown.length - 3);
  }

  const results = lintSync({
    strings: {content: markdown},
  });

  if (!results.content) {
    return markdown;
  }

  const fixedMarkdown = applyFixes(markdown, results.content);

  return fixedMarkdown;
}

export async function plaintifyMarkdown(markdown: string) {
  const plainMarked = new Marked().use({gfm: true}, markedPlaintify());

  return decodeHTML(await plainMarked.parse(markdown));
}
