import {retrieveContext} from '@/app/api/send-prompt/llm/Agent';
import {SystemMessage} from '@langchain/core/messages';
import {ChatPromptTemplate} from '@langchain/core/prompts';
import {ChatOpenAI, OpenAIEmbeddings} from '@langchain/openai';
import {loadEvaluator} from 'langchain/evaluation';
import {z} from 'zod';

const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;

type PromptReference = {
  prompt: string;
  referenceAnswer: string;
  collectionName: string;
};

type Answer = {
  reranker: string | null;
  content: string;
  similarityDistance: number;
};

type TestResult = PromptReference & {
  answers: Answer[];
};

const documents = {
  rootManual: '1733c6da-6de4-4aa1-8e8a-e4bd92ed23ff',
  swadeManual: 'f3fd1efc-dfb8-45aa-a80f-2c21bb8a2c54',
} as const;

const llm = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0,
  apiKey: OPENAI_API_KEY,
});

const embeddingModel = new OpenAIEmbeddings({
  apiKey: OPENAI_API_KEY,
  model: 'text-embedding-3-small',
  dimensions: 1536,
});

async function computeSimilarityDistance(
  llmAnswer: string,
  reference: string
): Promise<number> {
  const evaluator = await loadEvaluator('embedding_distance', {
    embedding: embeddingModel,
    llm,
  });

  const evaluationResult = await evaluator.evaluateStrings({
    prediction: llmAnswer,
    reference,
  });

  const similarityDistance = evaluationResult.score;

  return z.number().min(0).max(1).parse(similarityDistance);
}

async function queryLLM(
  prompt: string,
  collectionName: string,
  reranker: 'cohere' | null
): Promise<string> {
  const sectionPrefix = 'SECTION HEADER ROUTE: ';
  const retrievedContext = await retrieveContext(
    prompt.trim(),
    collectionName,
    sectionPrefix,
    reranker
  );

  const chatText = `From the following fragments of text extracted from the original document, use the relevant fragments as context to answer the user's question to the best of your ability.
  
USER QUESTION: {question}

The fragments represent sections (classified with headers in the original document).
The fragments include at the top the header route of the section they belong to in the format "{sectionPrefix}header>subheader>...".
The fragments are ordered as they appear in the original document.

DOCUMENT FRAGMENTS:
{context}`;

  const chatTemplate = await ChatPromptTemplate.fromTemplate(chatText).invoke({
    context: retrievedContext,
    question: prompt,
    sectionPrefix,
  });

  const systemMessage = new SystemMessage(
    "You're a helpful AI assistant expert in explaining documents in understandable terms. Your answers should be elaborate. If you don't know the answer just say 'I couldn't find the answer in the provided document.'."
  );

  const response = await llm.invoke([
    systemMessage,
    ...chatTemplate.toChatMessages(),
  ]);

  const llmAnswer = z.string().min(1).parse(response.content.toString().trim());

  return llmAnswer;
}

async function testLLMAnswers() {
  const testCases: PromptReference[] = [
    {
      prompt: 'How do I get wood as the Cat?',
      referenceAnswer: `Starting Supplies: At the beginning of the game, you should set up by forming supplies of 8 wood tokens. This is part of your initial setup as the Marquise de Cat (refer to section 6.3.1 Gather Warriors and Wood).
    Using Sawmills: During your Birdsong phase, you can place wood tokens in each clearing that has a sawmill. You will receive one wood token for each sawmill you have in those clearings (see section 6.4 Birdsong). This means that if you have multiple sawmills, you can accumulate more wood.
    Building and Overworking: In the Daylight phase, you can also gain wood by using the Overwork action. This involves spending a card that matches the clearing of a sawmill you control, which allows you to place an additional wood token there (refer to section 6.5.5 Overwork).`,
      collectionName: documents.rootManual,
    },
    {
      prompt:
        "As the Alliance, if I'm the defender in a combat which die result should I keep, the highest or the lowest?",
      collectionName: documents.rootManual,
      referenceAnswer: `As the Woodland Alliance, if you are the defender in a combat, you should keep the highest die result.
    According to the rules outlined in the document fragments, specifically in the section regarding the Woodland Alliance's faction rules, it states that "As defender in battle, the Alliance will deal hits equal to the higher roll, and the attacker will deal hits equal to the lower roll."
    This means that in a battle, as the defender, you benefit from keeping the highest roll to maximize the hits you can deal to the attacker.`,
    },
  ];

  const rerankerProviders = ['cohere', null] as const;

  const results: TestResult[] = await Promise.all(
    testCases.map(async (testCase) => {
      const answers: Answer[] = await Promise.all(
        rerankerProviders.map(async (reranker) => {
          const llmAnswer = await queryLLM(
            testCase.prompt,
            testCase.collectionName,
            reranker
          );

          const similarityDistance = await computeSimilarityDistance(
            llmAnswer,
            testCase.referenceAnswer
          );

          return {reranker, content: llmAnswer, similarityDistance};
        })
      );

      return {
        prompt: testCase.prompt,
        answers: answers,
        referenceAnswer: testCase.referenceAnswer,
        collectionName: testCase.collectionName,
      };
    })
  );

  return results;
}

function printResults(results: TestResult[]) {
  for (const result of results) {
    console.log(`\nPrompt: ${result.prompt}`);
    console.log(`Reference Answer: ${result.referenceAnswer}\n`);
    console.log('Answers:\n');
    console.dir(result.answers, {colors: true, depth: null});
    console.log('-----------------------------');
  }
}

export async function runRerankerTests() {
  console.log('Running reranker tests...');

  console.time('testLLMAnswers()');
  const results = await testLLMAnswers();
  console.timeEnd('testLLMAnswers()');

  printResults(results);

  return results;
}
