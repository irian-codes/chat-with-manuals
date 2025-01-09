/**
 * This is the client-side entrypoint for your tRPC API. It is used to create the `api` object which
 * contains the Next.js App-wrapper, as well as your type-safe React Query hooks.
 *
 * We also create a few inference helpers for input and output types.
 */
import {type AppRouter} from '@/server/api/root';
import {
  httpBatchLink,
  isNonJsonSerializable,
  loggerLink,
  splitLink,
  unstable_httpSubscriptionLink,
} from '@trpc/client';
import {createTRPCNext} from '@trpc/next';
import {
  type TRPCCombinedDataTransformer,
  type inferRouterInputs,
  type inferRouterOutputs,
} from '@trpc/server';
import superjson from 'superjson';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return ''; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
};

export const transformer: TRPCCombinedDataTransformer = {
  input: {
    serialize: (obj) => {
      if (isNonJsonSerializable(obj)) {
        return obj;
      } else {
        return superjson.serialize(obj);
      }
    },
    deserialize: (obj) => {
      if (isNonJsonSerializable(obj)) {
        return obj;
      } else {
        // eslint-disable-next-line
        return superjson.deserialize(obj);
      }
    },
  },
  output: superjson,
};

/** A set of type-safe react-query hooks for your tRPC API. */
export const api = createTRPCNext<AppRouter>({
  config() {
    const linkConfig = {
      url: `${getBaseUrl()}/api/trpc`,
      transformer,
    };

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
          condition: (op) => op.type === 'subscription',
          true: unstable_httpSubscriptionLink(linkConfig),
          false: httpBatchLink(linkConfig),
        }),
      ],
      queryClientConfig: {
        defaultOptions: {
          queries: {
            retry: 3,
            // React Query defaults to very aggressive fetching, but we
            // want to have some stale time since our data is not changing
            // much. Also, we invalidate data on mutations so we ensure
            // it'll always be up to date.
            staleTime: 5_000,
            gcTime: 10_000,
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
  transformer,
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
