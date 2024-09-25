// Import necessary modules
import {SystemMessage} from '@langchain/core/messages';
import {ChatPromptValueInterface} from '@langchain/core/prompt_values';
import {ChatPromptTemplate} from '@langchain/core/prompts';
import {ChatOpenAI, OpenAIEmbeddings} from '@langchain/openai';
import {loadEvaluator} from 'langchain/evaluation';
import {afterAll, describe, it} from 'vitest';

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
      id: 1,
      sectionTitle: 'WELCOME TO THE WEIRD WEST>TRAIT TESTS',
      sectionChunk:
        'If your roll (adding any modifiers) is equal to than the "Target Number (TN)," you succeed.',
      candidate:
        'ROLLING: If your roll (plus or \nminus any modifiers) is equal to or greater than \nthe "Target Number (TN)," you succeed.',
      expectedAnswer:
        'If your roll (plus or minus any modifiers) is equal to or greater than the "Target Number (TN)," you succeed.',
    },
    {
      id: 2,
      sectionTitle: 'BASICS>BENNIES',
      sectionChunk:
        'The Game Master starts with a single Benny per player character, and each of her Wild Cards has two of their own as well.',
      candidate:
        '("Bennies" is a slang \nterm derived from "benefits.")\nThe Game Master starts with one Benny per \nplayer character, and each of her Wild Cards \nhas two of their own as well.',
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
    {
      id: 6,
      sectionTitle: 'Game Components>Character Models',
      sectionChunk: 'Cpl.',
      candidate: 'CPL.',
      expectedAnswer: 'CPL.',
    },
    {
      id: 7,
      sectionTitle: 'Game Components>Character Models',
      sectionChunk: 'Lt. Scott Gorman',
      candidate: 'Scott \nGorman\nPvt.',
      expectedAnswer: 'Lt. Scott Gorman',
    },
    {
      id: 8,
      sectionTitle: '2 GAME BOARDS',
      sectionChunk:
        'The game has four double-sided Game Boards that make up the game space.',
      candidate:
        '5\nHADLEY’S \nHOPE\nATMOSPHERE \nPROCESSOR\nThe game has four double-sided Game Boards \nthat make up the game space.',
      expectedAnswer:
        'The game has four double-sided Game Boards that make up the game space.',
    },
    {
      id: 9,
      sectionTitle: '11. Calculations',
      sectionChunk:
        "He doesn't know the exact amount of progress the attacker has made, but assuming the honest blocks took the average expected time per block, the attacker's potential progress will be a Poisson distribution with expected value:",
      candidate:
        "He doesn't know the exact amount of progress the attacker has made, but \nassuming the honest blocks took the average expected time per block, the attacker's potential \nprogress will be a Poisson distribution with expected value:\n=z\nq\np\nTo get the probability the attacker could still catch up now, we multiply the Poisson density for \neach amount of progress he could have made by the probability he could catch up from that point:\n∑\nk=0\n∞\n\nk\ne\n−\nk!",
      expectedAnswer:
        "He doesn't know the exact amount of progress the attacker has made, but assuming the honest blocks took the average expected time per block, the attacker's potential progress will be a Poisson distribution with expected value:",
    },
    {
      id: 10,
      sectionTitle: '5. Network',
      sectionChunk:
        'Once the latest transaction in a block is buried under blocks, the spent transactions before it can be discarded to save disk space.',
      candidate:
        '7.Reclaiming Disk Space\nOnce the latest transaction in a coin is buried under enough blocks, the spent transactions before \nit can be discarded to save disk space.',
      expectedAnswer:
        'Once the latest transaction in a coin is buried under enough blocks, the spent transactions before it can be discarded to save disk space.',
    },
  ];

  const prompts: {
    id: number;
    content: string;
  }[] = [
    //     {
    //       id: 1,
    //       content: `Given the following fragments of a section of a document:

    // **Fragment A:** {sectionChunk}

    // **Fragment B:** {candidate}

    // Please correct any errors or hallucinations (if any) in Fragment A by using the accurate content from Fragment B. Preserve the structure and layout of Fragment A as much as possible.
    // To give you more context in your correction, here is the list of the nested section titles where the fragments belong to: {sectionTitle}

    // Your answer output format: The corrected version of Fragment A without adding extra information.`,
    //     },
    {
      id: 2,
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
      id: 3,
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
    {
      id: 21,
      content: `Given the following section fragments from a document:
  
Fragment A: {sectionChunk}
        
Fragment B: {candidate}
        
**Task:**
        
- Correct any errors or hallucinations in **Fragment A** by using the accurate content from **Fragment B**.
- **Do not** include any labels, headings, or additional text in your answer.
- Preserve the structure and layout of **Fragment A** as much as possible.
- Provide **only** the corrected version of **Fragment A** without adding extra information or newlines that are not present in the original.
- If the Fragment B contains unrelated or extra text than Fragment A, don't include it in your answer even if present in Fragment B.
        
For additional context, the fragments belong to the following nested section titles: {sectionTitle}
        
**Your answer should be only the corrected version of Fragment A.**`,
    },
    {
      id: 211,
      content: `Given the following section fragments from a document:

Fragment A: {sectionChunk}
      
Fragment B: {candidate}
      
**Task:**
      
- Correct any errors, typos, or hallucinations in **Fragment A** by referencing **Fragment B**.
- **Do not** add any new sentences, phrases, or information from **Fragment B** that are not already present in **Fragment A**.
- **Do not** include any labels, headings, or additional text in your answer.
- Preserve the structure, layout, and content of **Fragment A** as closely as possible.
- Make only the minimal necessary changes to correct errors in **Fragment A**.
- Provide **only** the corrected version of **Fragment A** without adding extra information or newlines.
      
For additional context, the fragments belong to the following nested section titles: {sectionTitle}
      
**Your answer should be only the corrected version of Fragment A, with minimal corrections made.**`,
    },
    {
      id: 31,
      content: `You are tasked with correcting errors in a text using a reference, without introducing new content.

---

Original Text (to be corrected): {sectionChunk}

Reference Text (for corrections only): {candidate}

---

**Instructions:**

- Use the **Reference Text** solely to identify and correct errors or hallucinations in the **Original Text**.
- **Do not** insert any content from the **Reference Text** that is not already present in the **Original Text**.
- **Do not** add new sentences, phrases, equations, or information not found in the **Original Text**.
- Make only the minimal changes necessary for correction.
- Preserve the formatting, structure, and content of the **Original Text** exactly as it is, except for corrections.
- **Do not** include any labels, headings, or additional commentary in your answer.
- Provide **only** the corrected version of the **Original Text** without extra newlines or spaces.

For context, these texts belong to the following nested section titles: {sectionTitle}

**Please provide only the corrected text, making minimal necessary corrections to the Original Text.**`,
    },
    {
      id: 4,
      content: `Please correct the following text by fixing errors using a reference, without adding any new information.

Text to Correct: {sectionChunk}

Reference for Corrections: {candidate}

**Instructions:**

- Identify and correct any errors or hallucinations in the **Text to Correct** by referring to the **Reference for Corrections**.
- **Do not** introduce any new content from the **Reference** that doesn't already exist in the **Text to Correct**.
- **Do not** add extra sentences, mathematical expressions, or details that are not present in the **Text to Correct**.
- Make only minimal changes necessary to correct the errors.
- Preserve the original structure, layout, and wording as much as possible.
- Provide **only** the corrected text, without any labels, explanations, or additional formatting.
- Avoid adding extra newlines, spaces, or altering the original formatting.

These texts are part of the following nested section titles: {sectionTitle}

**Your output should be the corrected text, identical to the original except for necessary corrections.**`,
    },
  ];

  const filledPrompts: {
    promptId: number;
    dataId: number;
    filledPrompt: ChatPromptValueInterface;
  }[] = await (async () => {
    const result = [];

    for (const prompt of prompts) {
      const promptId = prompt.id;

      for (const entry of data) {
        const filledPrompt = await ChatPromptTemplate.fromTemplate(
          prompt.content
        ).invoke({
          sectionChunk: entry.sectionChunk,
          candidate: entry.candidate,
          sectionTitle: entry.sectionTitle,
        });

        result.push({promptId, dataId: entry.id, filledPrompt});
      }
    }

    return result;
  })();

  const systemMessage = new SystemMessage(
    "You're an AI agent tasked with fixing hallucinations of text fragments from candidate fragments."
  );

  const results: {[key: string]: any}[] = [];

  it.concurrent.for(filledPrompts)(
    'Rating prompt ID: $promptId with data ID: $dataId',
    async ({promptId, dataId, filledPrompt}, ctx) => {
      const dataEntry = data.find((d) => d.id === dataId)!;

      ctx.expect(dataEntry).toBeDefined();

      const chat = new ChatOpenAI({
        model: 'gpt-4o-mini',
        temperature: 0,
        apiKey: OPENAI_API_KEY,
      });

      const response = await chat.invoke([
        systemMessage,
        ...filledPrompt.toChatMessages(),
      ]);

      ctx.expect(typeof response.content === 'string').toBeTruthy();

      const llmAnswer = response.content.toString().trim();

      ctx.expect(llmAnswer.length).toBeGreaterThan(0);

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

      ctx.expect(similarityDistance).toBeLessThanOrEqual(threshold);
    }
  );

  afterAll(() => {
    console.log('Final results:');
    const groups = Map.groupBy(results, (r) => r.promptId);

    let lastPromptId = -1;
    for (const [promptId, groupEntries] of groups) {
      if (promptId !== lastPromptId) {
        const prompt = prompts.find((p) => p.id === promptId)!;
        console.log(`Prompt ID ${promptId}:`, prompt.content);
        lastPromptId = promptId;
      }

      console.dir(groupEntries, {colors: true, depth: null});
    }
  });
});
