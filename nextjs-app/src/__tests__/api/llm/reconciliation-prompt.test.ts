// Import necessary modules
import {SystemMessage} from '@langchain/core/messages';
import {ChatPromptValueInterface} from '@langchain/core/prompt_values';
import {ChatPromptTemplate} from '@langchain/core/prompts';
import {ChatOpenAI, OpenAIEmbeddings} from '@langchain/openai';
import {loadEvaluator} from 'langchain/evaluation';
import {afterAll, describe, expect, it} from 'vitest';

// Set up OpenAI API key (ensure you have your API key set in your environment variables)
const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
const embeddingModel = new OpenAIEmbeddings({apiKey: OPENAI_API_KEY});

type ReconciliationEntry = {
  id: number;
  sectionTitle: string;
  sectionChunk: string;
  candidate: string;
  expectedAnswer: string;
};

// Define the test case
describe('Testing different prompts to reconciliate a section chunk with a candidate', async () => {
  // Input data
  const data: ReconciliationEntry[] = [
    {
      id: 0,
      sectionTitle: 'WELCOME TO THE WEIRD WEST>TRAIT TESTS',
      sectionChunk:
        'If your roll (adding any modifiers) is equal to than the "Target Number (TN)," you succeed.',
      candidate:
        'ROLLING: If your roll (plus or \nminus any modifiers) is equal to or greater than \nthe “Target Number (TN),” you succeed.',
      expectedAnswer:
        'If your roll (plus or minus any modifiers) is equal to or greater than the “Target Number (TN),” you succeed.',
    },
    {
      id: 1,
      sectionTitle: 'BASICS>BENNIES',
      sectionChunk:
        'The Game Master starts with a single Benny per player character, and each of her Wild Cards has two of their own as well.',
      candidate:
        '(“Bennies” is a slang \nterm derived from “benefits.”)\nThe Game Master starts with one Benny per \nplayer character, and each of her Wild Cards \nhas two of their own as well.',
      expectedAnswer:
        'The Game Master starts with one Benny per player character, and each of her Wild Cards has two of their own as well.',
    },
    {
      id: 3,
      sectionTitle:
        '8. Woodland Alliance>8.2 Faction Rules and Abilities>8.2.2 Guerrilla War',
      sectionChunk:
        'As defender in battle, the Alliance will deal hits equal to the lower roll, and the attacker will deal hits equal to the higher roll.',
      candidate:
        'As defender in battle, the Alliance \nwill deal hits equal to the higher roll, and the attacker \nwill deal hits equal to the lower roll.',
      expectedAnswer:
        'As defender in battle, the Alliance will deal hits equal to the higher roll, and the attacker will deal hits equal to the lower roll.',
    },
    {
      id: 4,
      sectionTitle:
        '8. Woodland Alliance>8.2 Faction Rules and Abilities>8.2.3 The Supporters Stack',
      sectionChunk:
        'If the Alliance could gain a supporter but the stack cannot hold it, that card is discarded.',
      candidate:
        'If the Alliance would gain a supporter \nbut the stack cannot hold it, that card \nis discarded.',
      expectedAnswer:
        'If the Alliance would gain a supporter but the stack cannot hold it, that card is discarded.',
    },
    {
      id: 5,
      sectionTitle:
        '8. Woodland Alliance>8.2 Faction Rules and Abilities>8.2.3 The Supporters Stack',
      sectionChunk:
        '1 Capacity: If the Alliance has no bases on the map, the Supporters stack can only hold up to five cards.',
      candidate:
        'If the Alliance has no bases on the \nmap, the Supporters stack can only hold up \nto five cards.',
      expectedAnswer:
        '1 Capacity: If the Alliance has no bases on the map, the Supporters stack can only hold up to five cards.',
    },
  ];

  const prompts: {
    id: number;
    content: string;
  }[] = [
    {
      id: 0,
      content: `Given the following fragments of a section of a document:

**Fragment A:** {sectionChunk}

**Fragment B:** {candidate}

Please correct any errors or hallucinations (if any) in Fragment A by using the accurate content from Fragment B. Preserve the structure and layout of Fragment A as much as possible.
To give you more context in your correction, here is the list of the nested section titles where the fragments belong to: {sectionTitle}

Your answer output format: The corrected version of Fragment A without adding extra information.`,
    },
    {
      id: 1,
      content: `Given the following section fragments from a document:

      Fragment A: {sectionChunk}
      
      Fragment B: {candidate}
      
      **Task:**
      
      - Correct any errors or hallucinations in **Fragment A** by using the accurate content from **Fragment B**.
      - **Do not** include any labels, headings, or additional text in your answer.
      - Preserve the structure and layout of **Fragment A** as much as possible.
      - Provide **only** the corrected version of **Fragment A** without adding extra information or newlines that are not present in the original.
      
      For additional context, the fragments belong to the following nested section titles: {sectionTitle}
      
      **Your answer should be only the corrected version of Fragment A.**`,
    },
    {
      id: 2,
      content: `You are tasked with correcting the following section text by using accurate information from another source.

---

**Original Text (to be corrected):** {sectionChunk}

**Reference Text (use for corrections):** {candidate}

---

**Instructions:**

- Produce **only** the corrected version of the **Original Text**.
- **Do not** include any labels, headings, or additional commentary in your answer.
- Preserve the original formatting and structure as much as possible.
- Avoid adding extra newlines, spaces, or information not present in the **Original Text**.
- Use the **Reference Text** solely to correct errors or hallucinations in the **Original Text**.

For context, the text belongs to these nested section titles: {sectionTitle}

**Please provide only the corrected text below.**
`,
    },
  ];

  const filledPrompts: Map<number, ChatPromptValueInterface[]> =
    await (async () => {
      const result = new Map();

      for (const prompt of prompts) {
        const promptsArr = [];
        const promptId = prompt.id;

        for (const entry of data) {
          const filledPrompt = await ChatPromptTemplate.fromTemplate(
            prompt.content
          ).invoke({
            sectionChunk: entry.sectionChunk,
            candidate: entry.candidate,
            sectionTitle: entry.sectionTitle,
          });

          promptsArr.push(filledPrompt);
        }

        result.set(promptId, promptsArr);
      }

      return result;
    })();

  const systemMessage = new SystemMessage(
    "You're an AI agent tasked with fixing hallucinations of text fragments from candidate fragments."
  );

  const results: {[key: string]: any}[] = [];

  const promptsWithFilledValues = Array.from(filledPrompts).flatMap(
    ([key, values]) =>
      values.map((value, i) => ({
        promptId: key,
        dataId: i,
        filledPrompt: value,
      }))
  );

  it.for(promptsWithFilledValues)(
    'Rating prompt ID: $promptId with data ID: $dataId',
    async ({promptId, dataId, filledPrompt}, ctx) => {
      const dataEntry = data[dataId];

      const chat = new ChatOpenAI({
        model: 'gpt-4o-mini',
        temperature: 0,
        apiKey: OPENAI_API_KEY,
      });

      const response = await chat.invoke([
        systemMessage,
        ...filledPrompt.toChatMessages(),
      ]);

      expect(typeof response.content === 'string').toBeTruthy();

      const llmAnswer = response.content.toString().trim();

      expect(llmAnswer.length).toBeGreaterThan(0);

      const evaluator = await loadEvaluator('embedding_distance', {
        embedding: embeddingModel,
        llm: chat,
      });

      const evaluationResult = await evaluator.evaluateStrings({
        prediction: llmAnswer,
        reference: dataEntry.expectedAnswer,
      });

      const similarityDistance = evaluationResult.score;

      // Set a threshold for acceptance distance (lower score means more similar)
      const threshold = 0.01;

      results.push({
        promptId,
        dataId,
        llmAnswer,
        expectedAnswer: dataEntry.expectedAnswer,
        similarityDistance,
        result: similarityDistance <= threshold ? 'PASS ✅' : 'FAIL ❌',
      } as const);

      expect(similarityDistance).toBeLessThanOrEqual(threshold);
    }
  );

  afterAll(() => {
    console.log('Final results:');
    const groups = Map.groupBy(results, (r) => r.promptId);

    let lastPromptId = -1;
    for (const [promptId, groupEntries] of groups) {
      if (promptId !== lastPromptId) {
        console.log(`Prompt ID ${promptId}:`, prompts[promptId].content);
        lastPromptId = promptId;
      }

      console.dir(groupEntries, {colors: true, depth: null});
    }
  });
});
