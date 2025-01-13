import {createTRPCRouter, withDbUserProcedure} from '@/server/api/trpc';
import {isStringEmpty} from '@/utils/strings';
import {AUTHOR, Prisma} from '@prisma/client';
import {TRPCError} from '@trpc/server';
import ISO6391 from 'iso-639-1';
import {z} from 'zod';
import {generateConversationTitle, sendPrompt} from '../llm/prompt';

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
          locale: true,
        },
      });

      if (!document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found or access denied',
        });
      }

      const defaultLlmSystemPrompt = `You are a highly effective AI assistant specialized in explaining documents with precise logical and factual reasoning. Your responses must be based on the provided context, avoiding any unrelated external information. Ensure that your answers are accurate, clear, and cite references from the given context. If the answer is not available within the context, respond with 'I couldn't find the answer in the provided document.'

All documents are written in ${ISO6391.getName(document.locale)}. You must **always** communicate in ${ISO6391.getName(document.locale)}.

**Language Enforcement:**
- **Detection:** Automatically detect the language of the user's input.
- **Compliance:** 
  - If the user communicates in ${ISO6391.getName(document.locale)}, proceed normally.
  - If the user uses a different language, respond **immediately** in the user's language with a clear and polite instruction to continue the conversation in ${ISO6391.getName(document.locale)}. For example:
    - "Por favor, continúe nuestra conversación en Español para que pueda asistirle de manera efectiva."
    - "Bitte fahren Sie unser Gespräch auf Spanisch fort, damit ich Ihnen effektiv helfen kann."

**Purpose:**
This strict language requirement ensures that all interactions remain consistent and that the assistance provided is both accurate and meaningful. Adhering to the document's language is crucial for maintaining clarity and effectiveness in communication.`;

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
          message: z
            .string()
            .trim()
            .refine((val) => !isStringEmpty(val), {
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
        include: {
          documents: true,
        },
      });

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found or access denied',
        });
      }

      if (conversation.documents.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            'No document found for this conversation. Invalid conversation.',
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

      const response = await sendPrompt({
        llmSystemPrompt: conversation.llmSystemPrompt,
        prompt: input.message,
        // TODO: Add support for multiple documents per conversation
        collectionName: conversation.documents[0]!.vectorStoreId,
      });

      const aiMessage = await ctx.prisma.message.create({
        data: {
          conversation: {
            connect: {
              id: conversation.id,
            },
          },
          author: AUTHOR.AI,
          content: response,
        },
      });

      return aiMessage;
    }),

  deleteConversation: withDbUserProcedure
    .input(z.object({id: z.string().min(1).uuid()}))
    .mutation(async ({ctx, input}) => {
      const userId = ctx.prismaUser.id;

      const deletedConversation = await ctx.prisma.conversation
        .delete({
          where: {
            id: input.id,
            userId,
          },
        })
        .catch(async (error) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Conversation not found or access denied',
              });
            } else {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to delete conversation',
              });
            }
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete conversation',
          });
        });

      return deletedConversation;
    }),

  editConversation: withDbUserProcedure
    .input(
      z
        .object({
          id: z.string().min(1).uuid(),
          title: z.string().trim().max(255).optional(),
          llmSystemPrompt: z.string().trim().optional(),
        })
        .strict()
        .refine((data) => data.title != null || data.llmSystemPrompt != null, {
          message: 'At least one field must be provided for update',
        })
    )
    .mutation(async ({ctx, input}) => {
      const userId = ctx.prismaUser.id;

      const updatedData = Object.fromEntries(
        Object.entries({
          title: input?.title,
          llmSystemPrompt: input?.llmSystemPrompt,
        }).filter(([_, value]) => value != null && !isStringEmpty(value))
      );

      const updatedConversation = await ctx.prisma.conversation
        .update({
          where: {
            id: input.id,
            userId,
          },
          data: updatedData,
        })
        .catch(async (error) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Conversation not found or access denied',
              });
            } else {
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to update conversation',
              });
            }
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update conversation',
          });
        });

      return updatedConversation;
    }),

  generateTitle: withDbUserProcedure
    .input(z.object({conversationId: z.string().min(1).uuid()}))
    .mutation(async ({ctx, input}) => {
      const userId = ctx.prismaUser.id;

      const conversation = await ctx.prisma.conversation.findUnique({
        where: {
          id: input.conversationId,
          userId,
        },
        include: {
          messages: {
            take: 2,
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found or access denied',
        });
      }

      const newTitle = await generateConversationTitle(conversation.messages);

      if (!isStringEmpty(newTitle)) {
        await ctx.prisma.conversation.update({
          where: {id: conversation.id},
          data: {title: newTitle},
        });
      }

      return newTitle;
    }),
});
