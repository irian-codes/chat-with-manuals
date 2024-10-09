import {z, ZodError, ZodSchema} from 'zod';

export type envVars = {
  OPENAI_API_KEY: string;
  COHERE_API_KEY: string;
  UNSTRUCTURED_API_KEY: string;
  LLMWHISPERER_API_KEY: string;
  LLAMA_CLOUD_API_KEY: string;
  AZURE_DOCUMENT_INTELLIGENCE_API_KEY: string;
  CHROMA_DB_HOST: string;
  CHROMA_DB_TIMEOUT: number;
};

export function getEnvironment() {
  const environment = z
    .union([
      z.literal('development'),
      z.literal('test'),
      z.literal('production'),
    ])
    .parse(process.env.NODE_ENV);

  return environment;
}

function getDevEnvVars() {
  const environment = getEnvironment();

  const envSchema = z
    .object({
      OPENAI_API_KEY: z.string().min(1),
      COHERE_API_KEY: z.string().default(''),
      UNSTRUCTURED_API_KEY: z.string().default(''),
      LLMWHISPERER_API_KEY: z.string().default(''),
      LLAMA_CLOUD_API_KEY: z.string().min(1),
      AZURE_DOCUMENT_INTELLIGENCE_API_KEY: z.string().default(''),
      CHROMA_DB_HOST: z.string().min(1).url(),
      CHROMA_DB_TIMEOUT: z.coerce.number().int().min(100).default(2000),
    })
    .readonly();

  if (environment !== 'development') {
    throw new Error(
      `Wrong environment variables function called, you are in '${environment}' environment and you're trying to call 'development' environment variables.`
    );
  }

  return validateEnvVars(envSchema);
}

function getTestEnvVars() {
  const environment = getEnvironment();

  const envSchema = z
    .object({
      VITE_OPENAI_API_KEY: z.string().min(1),
      VITE_COHERE_API_KEY: z.string().min(1),
    })
    .readonly();

  if (environment !== 'test') {
    throw new Error(
      `Wrong environment variables function called, you are in '${environment}' environment and you're trying to call 'test' environment variables.`
    );
  }

  return validateEnvVars(envSchema);
}

export function getEnvVars(): envVars {
  const environment = getEnvironment();

  switch (environment) {
    case 'development':
      const devVars = getDevEnvVars();

      return {
        OPENAI_API_KEY: devVars.OPENAI_API_KEY,
        COHERE_API_KEY: devVars.COHERE_API_KEY,
        UNSTRUCTURED_API_KEY: devVars.UNSTRUCTURED_API_KEY,
        LLMWHISPERER_API_KEY: devVars.LLMWHISPERER_API_KEY,
        LLAMA_CLOUD_API_KEY: devVars.LLAMA_CLOUD_API_KEY,
        AZURE_DOCUMENT_INTELLIGENCE_API_KEY:
          devVars.AZURE_DOCUMENT_INTELLIGENCE_API_KEY,
        CHROMA_DB_HOST: devVars.CHROMA_DB_HOST,
        CHROMA_DB_TIMEOUT: devVars.CHROMA_DB_TIMEOUT,
      };

    case 'test':
      const testVars = getTestEnvVars();

      return {
        OPENAI_API_KEY: testVars.VITE_OPENAI_API_KEY,
        COHERE_API_KEY: testVars.VITE_COHERE_API_KEY,
        UNSTRUCTURED_API_KEY: '',
        LLMWHISPERER_API_KEY: '',
        LLAMA_CLOUD_API_KEY: '',
        AZURE_DOCUMENT_INTELLIGENCE_API_KEY: '',
        CHROMA_DB_HOST: '',
        CHROMA_DB_TIMEOUT: Number.NaN,
      };

    default:
      throw new Error(
        `Invalid environment: '${environment}'. It's not supported yet.`
      );
  }
}

function validateEnvVars<T extends ZodSchema>(
  envSchema: T
): ReturnType<T['parse']> {
  const environment = getEnvironment();

  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(
        `Invalid environment variables on '${environment}' environment`,
        {
          cause: error,
        }
      );
    } else {
      throw error;
    }
  }
}
