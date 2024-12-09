/**
 * This is the client-side entrypoint for your tRPC API. It is used to create the `api` object which
 * contains the Next.js App-wrapper, as well as your type-safe React Query hooks.
 *
 * We also create a few inference helpers for input and output types.
 */
import {httpBatchLink, httpLink, loggerLink, splitLink} from '@trpc/client';
import {createTRPCNext} from '@trpc/next';
import {type inferRouterInputs, type inferRouterOutputs} from '@trpc/server';
import superjson from 'superjson';

import {type AppRouter} from '@/server/api/root';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return ''; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
};

const cannotSendToTRPCdirectly = (value: unknown) => {
  return value instanceof FormData || value instanceof File;
};

/** A set of type-safe react-query hooks for your tRPC API. */
export const api = createTRPCNext<AppRouter>({
  config() {
    return {
      /**
       * Links used to determine request flow from client to server.
       *
       * @see https://trpc.io/docs/links
       */
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === 'development' ||
            (opts.direction === 'down' && opts.result instanceof Error),
        }),
        // TRPC doesn't support sending files directly so we need to use a
        // custom link to send FormData.
        // @see https://github.com/trpc/trpc/issues/1937#issuecomment-2267163025
        splitLink({
          condition: (op) => cannotSendToTRPCdirectly(op.input),
          true: httpLink({
            url: `${getBaseUrl()}/api/trpc`,
            transformer: {
              serialize: (data) => data as FormData | File,
              deserialize: superjson.deserialize,
            },
          }),
          false: httpBatchLink({
            transformer: superjson,
            url: `${getBaseUrl()}/api/trpc`,
          }),
        }),
      ],
      queryClientConfig: {
        defaultOptions: {
          queries: {
            retry: 3,
          },
        },
      },
    };
  },
  /**
   * Whether tRPC should await queries when server rendering pages.
   *
   * @see https://trpc.io/docs/nextjs#ssr-boolean-default-false
   */
  ssr: false,
  transformer: superjson,
});

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
