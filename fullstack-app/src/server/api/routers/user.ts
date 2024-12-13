import {env} from '@/env';
import {authedProcedure, createTRPCRouter} from '@/server/api/trpc';
import {verifyToken} from '@clerk/nextjs/server';
import {TRPCError} from '@trpc/server';
import ISO6391 from 'iso-639-1';
import {z} from 'zod';

const verifyClerkTokenSchema = z
  .object({
    authProviderId: z
      .string()
      .trim()
      .min(1)
      .refine(async (id) => {
        try {
          const token = await verifyToken(id, {
            secretKey: env.CLERK_SECRET_KEY,
          });

          return token != null;
        } catch (error) {
          return false;
        }
      }),
  })
  .strict();

export const usersRouter = createTRPCRouter({
  getUser: authedProcedure
    .input(
      z.union([
        z
          .object({
            id: z.string().trim().uuid(),
          })
          .strict(),
        verifyClerkTokenSchema,
      ])
    )
    .query(async ({ctx, input}) => {
      const user = await (async () => {
        if ('id' in input) {
          return await ctx.db.user.findUnique({
            where: {
              id: input.id,
            },
          });
        } else {
          return await ctx.db.user.findUnique({
            where: {
              authProviderId: ctx.authProviderUserId,
            },
          });
        }
      })();

      if (user == null) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return user;
    }),

  /**
   * Handles user login continuation and initial setup.
   *
   * This procedure creates a new user record if one doesn't exist, or
   * returns the existing user. This is to ensure each user has a
   * corresponding record on the database.
   *
   * @returns The user object with the userSettings included.
   *
   * NOTE: This should be a mutation if we're strict with TRPC's paradigm,
   * but we need to call it from Next.js SSR methods because this is an
   * inherently server-side operation. And TRPC doesn't support SSR calls
   * on mutations, therefore the solution is to use query. Treat this as an
   * exception to the rule.
   */
  initializePage: authedProcedure
    .input(
      z.object({
        locale: z.union([
          z
            .string()
            .trim()
            .min(2)
            .max(2)
            .refine((l) => ISO6391.validate(l)),
          z.undefined(),
        ]),
      })
    )
    .query(async ({ctx, input}) => {
      const existingUser = await ctx.db.user.findUnique({
        where: {
          authProviderId: ctx.authProviderUserId,
        },
        include: {userSettings: true},
      });

      if (existingUser != null) {
        return existingUser;
      }

      const supportedLocales = (await ctx.db.globalSettings.findFirstOrThrow())
        .supportedLocales;

      const defaultLocale = supportedLocales[0]!;
      const inputLocale = input.locale ?? 'UNDEFINED';

      const locale = supportedLocales.includes(inputLocale)
        ? inputLocale
        : defaultLocale;

      const newUser = await ctx.db.user.create({
        data: {
          authProviderId: ctx.authProviderUserId,
          userSettings: {
            create: {
              appLocale: locale,
            },
          },
        },
        include: {userSettings: true},
      });

      return newUser;
    }),
});
