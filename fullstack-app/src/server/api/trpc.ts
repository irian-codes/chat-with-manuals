/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import {env} from '@/env';
import {prisma} from '@/server/db/prisma';
import {transformer} from '@/utils/api';
import {getAuth} from '@clerk/nextjs/server';
import {type User} from '@prisma/client';
import {initTRPC, TRPCError} from '@trpc/server';
import {type CreateNextContextOptions} from '@trpc/server/adapters/next';
import {ZodError} from 'zod';
import rateLimit from '../middleware/rateLimit';

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 */

interface CreateInnerContextOptions extends Partial<CreateNextContextOptions> {
  authProviderUserId: string | null;
  prismaUser: User | null;
}

/**
 * This helper generates the "internals" for a tRPC context. If you need to use it, you can export
 * it from here.
 *
 * Examples of things you may need it for:
 * - testing, so we don't have to mock Next.js' req/res
 * - tRPC's `createSSGHelpers`, where we don't have req/res
 *
 * @see https://create.t3.gg/en/usage/trpc#-serverapitrpcts
 */
export const createInnerTRPCContext = (opts: CreateInnerContextOptions) => {
  return {
    ...opts,
    prisma,
  };
};

/**
 * This is the actual context you will use in your router. It will be used to process every request
 * that goes through your tRPC endpoint.
 *
 * @see https://trpc.io/docs/context
 */
export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const {userId: authProviderUserId} = getAuth(opts.req);

  const prismaUser: User | null = await (async () => {
    if (authProviderUserId == null) {
      return null;
    }

    return await prisma.user.findUnique({
      where: {
        authProviderId: authProviderUserId,
      },
    });
  })();

  const innerContext = createInnerTRPCContext({
    authProviderUserId,
    prismaUser,
    ...opts,
  });

  return {
    ...innerContext,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */

const t = initTRPC.context<typeof createInnerTRPCContext>().create({
  transformer,
  errorFormatter({shape, error}) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
  sse: {
    enabled: true,
    // Force disconnect after 5 minutes to prevent stale connections
    maxDurationMs: 5 * 60 * 1_000,
    ping: {
      enabled: true,
      intervalMs: 3_000,
    },
    client: {
      reconnectAfterInactivityMs: 5_000,
    },
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({next, path}) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Middleware to ensure that the request context is present.
 * Meant to be used with client side only calls, not from ssg helpers.
 */
export const requestContextMiddleware = t.middleware(async (opts) => {
  if (!opts.ctx.req || !opts.ctx.res) {
    throw new TRPCError({
      message: 'You are missing `req` or `res` in your call.',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }

  return opts.next({
    ctx: {
      // We overwrite the context with the truthy `req` & `res`, which will also overwrite the types used in your procedure.
      req: opts.ctx.req,
      res: opts.ctx.res,
    },
  });
});

const rateLimiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 500, // Max 500 users per minute
});

/**
 * Rate limiting middleware
 *
 * This middleware applies rate limiting to all procedures that use it.
 * Default is 10 requests per minute per IP address.
 */
const rateLimitMiddleware = t.middleware(async ({ctx, next}) => {
  // Skip rate limiting if not in production
  // if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
  //   return next();
  // }

  const id = ctx.authProviderUserId;

  if (id == null || typeof id !== 'string' || id.trim().length === 0) {
    // TODO: Use anonymous rate limiter for when we know if we have or not have DDOS protections on the server.
    // const isRateLimited = await limiter.check({
    //   res: ctx.res,
    //   limit: 50,
    //   token: 'anonymous',
    // });
  } else {
    const isRateLimited = await rateLimiter.check({
      res: ctx.res,
      limit: env.API_REQUESTS_PER_MINUTE_PER_USER_RATE_LIMIT,
      token: id,
    });

    if (isRateLimited) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded',
      });
    }
  }

  return next();
});

const authorizationMiddleware = t.middleware(({next, ctx}) => {
  if (!ctx.authProviderUserId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'No valid auth provider user ID found',
    });
  }

  return next({
    ctx: {
      authProviderUserId: ctx.authProviderUserId,
    },
  });
});

const withDbUserMiddleware = t.middleware(async ({next, ctx}) => {
  if (ctx.prismaUser == null) {
    throw new TRPCError({
      message: 'User not found',
      code: 'NOT_FOUND',
    });
  }

  // This helps TypeScript know that prismaUser is non-null in protected routes
  return next({
    ctx: {
      prismaUser: ctx.prismaUser,
    },
  });
});

const debugMiddleware = t.middleware(async ({next, ctx}) => {
  if (env.NODE_ENV !== 'development') {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message:
        'This route is only available in development mode, you sneaky bastard!',
    });
  }
  return next({ctx});
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure
  .use(timingMiddleware)
  .use(rateLimitMiddleware);

export const authedProcedure = publicProcedure.use(authorizationMiddleware);
export const withDbUserProcedure = authedProcedure.use(withDbUserMiddleware);
export const debugAuthedProcedure = authedProcedure.use(debugMiddleware);
export const debugPublicProcedure = publicProcedure.use(debugMiddleware);
