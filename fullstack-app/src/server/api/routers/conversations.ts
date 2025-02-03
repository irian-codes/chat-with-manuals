import {createTRPCRouter, withDbUserProcedure} from '@/server/api/trpc';
import {
  generateConversationTitle,
  sendPrompt,
} from '@/server/conversation/prompt';
import {isStringEmpty} from '@/utils/strings';
import {AUTHOR, Prisma} from '@prisma/client';
import {TRPCError} from '@trpc/server';
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
    .input(
      z
        .object({
          id: z.string().min(1).uuid(),
          withMessages: z.boolean().optional(),
          withDocuments: z.boolean().optional(),
        })
        .strict()
    )
    .query(async ({ctx, input}) => {
      const userId = ctx.prismaUser.id;

      const conversation = await ctx.prisma.conversation.findUnique({
        where: {
          id: input.id,
          userId,
        },
        include: {
          documents: input?.withDocuments ? true : false,
          messages: input?.withMessages ? true : false,
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

  getConversationMessages: withDbUserProcedure
    .input(
      z.object({
        conversationId: z.string().min(1).uuid(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ctx, input}) => {
      const userId = ctx.prismaUser.id;

      // Verify user has access to this conversation
      const conversation = await ctx.prisma.conversation.findUnique({
        where: {
          id: input.conversationId,
          userId,
        },
        select: {id: true},
      });

      if (!conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found or access denied',
        });
      }

      const messages = await ctx.prisma.message.findMany({
        // Getting one more to use as next cursor
        take: input.limit + 1,
        where: {
          conversationId: input.conversationId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        cursor: input.cursor
          ? {
              id: input.cursor,
            }
          : undefined,
      });

      let nextCursor: typeof input.cursor | undefined;
      if (messages.length > input.limit) {
        const nextItem = messages.pop();
        nextCursor = nextItem!.id;
      }

      return {
        messages: messages.reverse(),
        nextCursor,
      };
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

      const conversation = await ctx.prisma.conversation.create({
        data: {
          userId,
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
          userId,
        },
        include: {
          _count: {
            select: {
              documents: true,
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

      if (conversation._count.documents === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message:
            'No document found for this conversation. Invalid conversation.',
        });
      }

      const response = await sendPrompt({
        prompt: input.message,
        conversationId: conversation.id,
      });

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

  editMessage: withDbUserProcedure
    .input(
      z
        .object({
          messageId: z.string().min(1).uuid(),
          content: z.string().trim().min(1),
        })
        .strict()
    )
    .mutation(async ({ctx, input}) => {
      const userId = ctx.prismaUser.id;

      // Get the message and verify ownership and update the content
      const updatedMessage = await ctx.prisma.message
        .update({
          where: {
            id: input.messageId,
            author: AUTHOR.USER,
            conversation: {
              userId,
            },
          },
          include: {
            conversation: true,
          },
          data: {
            content: input.content,
          },
        })
        .catch((error) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'Message not found or access denied',
              });
            }
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to update message',
          });
        });

      // Delete all messages after this one
      await ctx.prisma.message.deleteMany({
        where: {
          conversationId: updatedMessage.conversation.id,
          createdAt: {
            gt: updatedMessage.createdAt,
          },
        },
      });

      const response = await sendPrompt({
        prompt: updatedMessage.content,
        conversationId: updatedMessage.conversation.id,
      });

      const aiMessage = await ctx.prisma.message.create({
        data: {
          conversation: {
            connect: {
              id: updatedMessage.conversation.id,
            },
          },
          author: AUTHOR.AI,
          content: response,
        },
      });

      return updatedMessage;
    }),
});
