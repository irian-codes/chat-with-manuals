import type {TextChunkDoc, TextChunkMetadata} from '@/types/TextChunkDoc';
import type {TextSplitter} from '@/types/TextSplitter';
import {isStringEmpty} from '@/utils/strings';
import {isWithinTokenLimit} from 'gpt-tokenizer/model/gpt-4o';
import {Document} from 'langchain/document';
import {v4 as uuidv4} from 'uuid';

export async function chunkString({
  text,
  splitter,
}: {
  text: string;
  splitter: TextSplitter;
}): Promise<TextChunkDoc[]> {
  const splits = await splitter.splitText(text);
  const chunks: TextChunkDoc[] = [];

  for (let i = 0; i < splits.length; i++) {
    const split = splits[i]?.trim();

    if (split == null || isStringEmpty(split ?? '')) {
      continue;
    }

    // Hacky way to get the token size of a chunk.
    const tokens: number | boolean = isWithinTokenLimit(
      split,
      Number.MAX_VALUE
    );

    if (typeof tokens !== 'number') {
      throw new Error(
        "This shouldn't happen. Attempt to get the token size of a chunk failed."
      );
    }

    chunks.push(
      new Document<TextChunkMetadata>({
        id: uuidv4(),
        pageContent: split,
        metadata: {
          totalOrder: i + 1,
          tokens,
          charCount: split.length,
        },
      })
    );
  }

  return chunks;
}
