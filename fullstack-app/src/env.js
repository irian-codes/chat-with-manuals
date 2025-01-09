import {createEnv} from '@t3-oss/env-nextjs';
import {z} from 'zod';

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    CLERK_SECRET_KEY: z.string(),
    LLAMA_CLOUD_API_KEY: z.string(),
    OPENAI_API_KEY: z.string(),
    CHROMA_DB_HOST: z.string(),
    CHROMA_DB_TIMEOUT: z.coerce.number().min(100).max(10000).default(2000),
    API_REQUESTS_PER_MINUTE_PER_USER_RATE_LIMIT: z.coerce
      .number()
      .min(1)
      .max(Number.MAX_SAFE_INTEGER)
      .default(30 * 60),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    LLAMA_CLOUD_API_KEY: process.env.LLAMA_CLOUD_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    CHROMA_DB_HOST: process.env.CHROMA_DB_HOST,
    CHROMA_DB_TIMEOUT: process.env.CHROMA_DB_TIMEOUT,
    API_REQUESTS_PER_MINUTE_PER_USER_RATE_LIMIT:
      process.env.API_REQUESTS_PER_MINUTE_PER_USER_RATE_LIMIT,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
