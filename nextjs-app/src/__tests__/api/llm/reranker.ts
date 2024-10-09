import {retrieveContext} from '@/app/api/send-prompt/llm/Agent';
import {getEnvVars} from '@/app/common/env';
import {SystemMessage} from '@langchain/core/messages';
import {ChatPromptTemplate} from '@langchain/core/prompts';
import {ChatOpenAI, OpenAIEmbeddings} from '@langchain/openai';
import {loadEvaluator} from 'langchain/evaluation';
import {z} from 'zod';

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
  aliensManual: '84e763aa-943a-46f5-8b06-0b53d3e491e8',
  bitcoinWhitepaper: 'c76946a7-671b-42b6-8d5a-3e57cd88690b',
  airPurifierManual: '86b5aea9-9848-4f90-829e-aad28539cece',
} as const;

const llm = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0,
  apiKey: getEnvVars().OPENAI_API_KEY,
});

const embeddingModel = new OpenAIEmbeddings({
  apiKey: getEnvVars().OPENAI_API_KEY,
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
  const retrievedContext = await retrieveContext({
    prompt: prompt.trim(),
    collectionName,
    sectionHeaderPrefix: sectionPrefix,
    reranker,
  });

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
      referenceAnswer: `To get wood as the Marquise de Cat, you can follow these steps:
Place Wood Tokens: During the Birdsong phase, place wood tokens in each clearing where you have sawmills, with one wood token for each sawmill present (SECTION HEADER ROUTE: 6. Marquise de Cat>6.4 Birdsong).
Build Buildings: When you build a building (sawmill, workshop, or recruiter), you will need to pay the cost in wood tokens. You can remove wood tokens equal to the building's cost from the chosen clearing, any adjacent clearings you rule, or any clearings connected to the chosen clearing that you rule (SECTION HEADER ROUTE: 6. Marquise de Cat>6.5 Daylight>6.5.4 Build).
Overwork: You can also spend a card that matches the clearing of a sawmill to place an additional wood token there (SECTION HEADER ROUTE: 6. Marquise de Cat>6.5 Daylight>6.5.5 Overwork).
By utilizing these methods, you can effectively gather and manage wood as the Marquise de Cat.
`,
      collectionName: documents.rootManual,
    },
    {
      prompt:
        "As the Alliance, if I'm the defender in a combat which die result should I keep, the highest or the lowest?",
      collectionName: documents.rootManual,
      referenceAnswer:
        'As the Alliance, if you are the defender in a combat, you should keep the highest die result. According to the relevant fragment, "As defender in battle, the Alliance will deal hits equal to the higher roll, and the attacker will deal hits equal to the lower roll" (SECTION HEADER ROUTE: 8. Woodland Alliance>8.2 Faction Rules and Abilities>8.2.2 Guerrilla War).',
    },
    {
      prompt: 'How many grunts can a player activate?',
      collectionName: documents.aliensManual,
      referenceAnswer: `A player can activate Grunts based on their Hero's Rank. Specifically:
    Rank 1: Activate one Grunt.
    Rank 2: Activate up to two Grunts.
    Rank 3: Activate up to three Grunts.`,
    },
    {
      prompt:
        'Is a blip spotted if if there are furniture or other items in the middle of the line of sight but the doors are all open?',
      collectionName: documents.aliensManual,
      referenceAnswer: `A Blip will be spotted as soon as it comes into Line of Sight of a Character. According to the provided document fragments, doors do not block Line of Sight or movement when they are open. Therefore, if there are furniture or other items in the middle of the line of sight, the presence of open doors means that the Blip can still be spotted as long as it comes into Line of Sight of a Character.
In summary, a Blip can be spotted even if there are furniture or other items in the middle of the line of sight, provided the doors are open.`,
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
