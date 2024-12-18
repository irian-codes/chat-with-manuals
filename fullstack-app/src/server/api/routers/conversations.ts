import {createTRPCRouter, withDbUserProcedure} from '@/server/api/trpc';
import {TRPCError} from '@trpc/server';
import ISO6391 from 'iso-639-1';
import {z} from 'zod';

export const conversationsRouter = createTRPCRouter({
  getConversations: withDbUserProcedure
    .input(
      z
        .object({
          withMessages: z.boolean().optional(),
          withDocuments: z.boolean().optional(),
        })
        .strict()
        .optional()
    )
    .query(async ({ctx, input}) => {
      const userId = ctx.dbUser.id;

      const conversations = await ctx.db.conversation.findMany({
        where: {
          userId,
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
      const userId = ctx.dbUser.id;

      const conversation = await ctx.db.conversation.findUnique({
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
      const userId = ctx.dbUser.id;

      const document = await ctx.db.document.findUnique({
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

      const conversation = await ctx.db.conversation.create({
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
          // TODO: This should be whatever we end up using for IDs in the DB
          conversationId: z.string().min(1),
          message: z.string().trim().min(1),
        })
        .strict()
    )
    .mutation(async ({ctx, input}) => {
      const userId = ctx.authProviderUserId;

      // Store user message in DB (not shown in mock)
      const userMessage = {
        id: String(mockConversation.messages.length + 1),
        author: userId,
        content: input.message,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockConversation.messages.push(userMessage);

      // Simulate AI response delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Generate and store AI response
      const aiResponse = {
        id: String(mockConversation.messages.length + 1),
        author: 'ai',
        content: "Thank you for your message. I'm processing your request.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockConversation.messages.push(aiResponse);

      return aiResponse;
    }),
});

// TODO: Pass this to DB when we have it.
const mockConversation = {
  id: '1',
  title: 'How does Bitcoin work and what are its implications?',
  messages: [
    {
      id: '1',
      author: 'ai',
      content: 'Hello! How can I assist you today?',
      createdAt: new Date('2023-04-15T10:00:00').toISOString(),
      updatedAt: new Date('2023-04-15T10:00:00').toISOString(),
    },
    {
      id: '2',
      author: 'user',
      content: 'I have a question about Bitcoin. Can you explain how it works?',
      createdAt: new Date('2023-04-15T10:01:00').toISOString(),
      updatedAt: new Date('2023-04-16T23:55:30').toISOString(),
    },
    {
      id: '3',
      author: 'ai',
      content:
        'Bitcoin is a decentralized digital currency that operates on a technology called blockchain. It allows for secure, peer-to-peer transactions without the need for intermediaries like banks. Would you like me to go into more detail about any specific aspect of Bitcoin?',
      createdAt: new Date('2023-04-15T10:01:30').toISOString(),
      updatedAt: new Date('2023-04-15T10:01:30').toISOString(),
    },
  ],
  document: {
    id: '3',
    title: 'Bitcoin whitepaper',
    description: 'Bitcoin whitepaper',
    createdAt: new Date('2023-03-07T10:14:00.000Z'),
    updatedAt: new Date('2023-03-07T10:14:00.000Z'),
    locale: 'en',
    fileUrl: 'https://example.com/file.pdf',
    fileHash: '1234567890',
    imageUrl: 'https://example.com/image.jpg',
  },
};
