import {createTRPCRouter, withDbUserProcedure} from '@/server/api/trpc';
import {isStringEmpty} from '@/utils/strings';
import {AUTHOR} from '@prisma/client';
import {TRPCError} from '@trpc/server';
import ISO6391 from 'iso-639-1';
import {z} from 'zod';

export const conversationsRouter = createTRPCRouter({
  getConversations: withDbUserProcedure
    .input(
      z
        .object({
          titleSearch: z.string().max(30).default(''),
          withMessages: z.boolean().optional(),
          withDocuments: z.boolean().optional(),
        })
        .strict()
        .optional()
    )
    .query(async ({ctx, input}) => {
      const userId = ctx.prismaUser.id;

      const conversations = await ctx.prisma.conversation.findMany({
        where: {
          AND: {
            userId,
            ...(input == null ||
            isStringEmpty(input.titleSearch) ||
            input.titleSearch.length < 2
              ? undefined
              : {
                  title: {
                    mode: 'insensitive',
                    contains: input.titleSearch.trim(),
                  },
                }),
          },
        },
        include: {
          messages: input?.withMessages ? true : false,
          documents: input?.withDocuments ? true : false,
        },
      });

      return conversations;
    }),

  getConversation: withDbUserProcedure
    .input(z.object({id: z.string().min(1).uuid()}))
    .query(async ({ctx, input}) => {
      const userId = ctx.prismaUser.id;

      const conversation = await ctx.prisma.conversation.findUnique({
        where: {
          id: input.id,
          userId,
        },
        include: {
          messages: true,
          documents: true,
        },
      });

      if (conversation == null) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found or access denied',
        });
      }

      return conversation;
    }),

  addConversation: withDbUserProcedure
    .input(
      z
        .object({
          // TODO: For now we only support one document per conversation even if the schema is ready for more.
          documentId: z.string().min(1).uuid(),
        })
        .strict()
    )
    .mutation(async ({ctx, input}) => {
      const userId = ctx.prismaUser.id;

      const document = await ctx.prisma.document.findUnique({
        where: {
          id: input.documentId,
          users: {
            some: {
              id: userId,
            },
          },
        },
        select: {
          id: true,
          description: true,
          locale: true,
        },
      });

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found or access denied',
        });
      }

      const defaultLlmSystemPrompt = `You're a helpful AI assistant that answers questions about documents in understandable terms.
This document has the following description:
${document.description}

The language of the document is ${ISO6391.getName(document.locale)}. Your answers must always be in this same language.`;

      const conversation = await ctx.prisma.conversation.create({
        data: {
          userId,
          llmSystemPrompt: defaultLlmSystemPrompt,
          documents: {
            connect: {
              id: document.id,
            },
          },
        },
        select: {
          id: true,
        },
      });

      return conversation.id;
    }),

  sendMessage: withDbUserProcedure
    .input(
      z
        .object({
          conversationId: z.string().min(1).uuid(),
          message: z.string().refine((val) => !isStringEmpty(val), {
            message: 'Message cannot be empty',
          }),
        })
        .strict()
    )
    .mutation(async ({ctx, input}) => {
      const userId = ctx.prismaUser.id;

      // Get conversation to verify it exists and user has access
      const conversation = await ctx.prisma.conversation.findFirst({
        where: {
          id: input.conversationId,
          userId: userId,
        },
      });

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found or access denied',
        });
      }

      // Create user message
      const userMessage = await ctx.prisma.message.create({
        data: {
          conversation: {
            connect: {
              id: conversation.id,
            },
          },
          author: AUTHOR.USER,
          content: input.message,
        },
      });

      // Add artificial delay to simulate AI processing time
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const aiMessage = await ctx.prisma.message.create({
        data: {
          conversation: {
            connect: {
              id: conversation.id,
            },
          },
          author: AUTHOR.AI,
          // TODO: Replace with actual AI response
          content: "Thank you for your message. I'm processing your request.",
        },
      });

      return aiMessage;
    }),
});
