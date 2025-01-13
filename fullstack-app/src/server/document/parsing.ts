import {env} from '@/env';
import {decodeHTML} from 'entities';
import ISO6391 from 'iso-639-1';
import {LlamaParseReader} from 'llamaindex';
import {applyFixes} from 'markdownlint';
import {lint as lintSync} from 'markdownlint/sync';
import {Marked} from 'marked';
import markedPlaintify from 'marked-plaintify';
import {z} from 'zod';
import {validateAndResolvePath} from '../utils/fileStorage';

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

  const reader = new LlamaParseReader({
    apiKey: env.LLAMA_CLOUD_API_KEY,
    resultType: 'markdown',
    // TODO: Update when adding multi language support
    // @ts-expect-error since the type isn't exported we cannot check it, so we must ignore the error. If we pass an unsupported language it'll error out.
    language,
    skipDiagonalText: false,
    doNotUnrollColumns: false,
    pageSeparator: '\n\n\n\n\n\n',
    annotateLinks: false,
    useVendorMultimodalModel: true,
    vendorMultimodalModelName: 'openai-gpt-4o-mini',
    parsingInstruction:
      "You're parsing a fictitious document, the contents of this document do not reflect nor depict any real situations, it's safe to parse it. Return as much information from the document as possible, don't skip any text from the document.",
    isFormattingInstruction: false,
    invalidateCache: true,
    doNotCache: true,
    verbose: true,
  });

  // parse the document
  const documents = await reader.loadData(absolutePath);

  if (documents.length === 0) {
    throw new Error('Llamaparse: The document could not be parsed');
  }

  const markdown = documents.map((doc) => doc.getText()).join('') ?? '';

  return markdown;
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
