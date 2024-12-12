import {createTRPCRouter, publicProcedure} from '@/server/api/trpc';
import {
  type Conversation,
  type ConversationSimplified,
} from '@/types/Conversation';
import {type Message} from '@/types/Message';
import {z} from 'zod';

export const conversationsRouter = createTRPCRouter({
  // TODO #10: This should be an authed procedure: https://clerk.com/docs/references/nextjs/trpc

  getConversations: publicProcedure
    .input(
      z.object({
        simplify: z.boolean().optional(),
      })
    )
    .query(async ({ctx, input}) => {
      const simplifiedConversations: ConversationSimplified[] = [
        {
          id: '1',
          title: 'How does Bitcoin work and what are its implications?',
        },
        {id: '2', title: 'Troubleshooting volume issues in audio systems.'},
        {id: '3', title: 'Moving with a pawn in chess: strategies and tips.'},
        {id: '4', title: 'Configuring a detector for optimal performance.'},
      ];

      // TODO: Populate with more defined mock converstions.
      const conversations: Conversation[] = [];

      return input.simplify ? simplifiedConversations : conversations;
    }),

  getConversation: publicProcedure
    .input(z.object({id: z.string()}))
    .query(async ({ctx, input}) => {
      // TODO: Get the conversation for the specific user. Mock data for now.

      return mockConversation;
    }),

  addConversation: publicProcedure
    .input(
      z
        .object({
          // TODO: This should be whatever we end up using for IDs in the DB
          documentId: z.string().min(1),
        })
        .strict()
    )
    .mutation(({ctx, input}) => {
      console.log('Conversation added for ID: ', input.documentId);

      // TODO: Replace with actual DB call
      const conversation: Conversation = {
        id: '2',
        title: 'How to play chess',
        messages: [],
        document: {
          id: input.documentId,
          title: 'How to play chess',
          date: '2023-03-07T10:14:00.000Z',
          languageCode: 'en',
        },
      };

      return conversation.id;
    }),

  sendMessage: publicProcedure
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
      const userMessage: Message = {
        id: String(mockConversation.messages.length + 1),
        author: userId!,
        content: input.message,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockConversation.messages.push(userMessage);

      // Simulate AI response delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Generate and store AI response
      const aiResponse: Message = {
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
const mockConversation: Conversation = {
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
    date: '2023-03-07T10:14:00.000Z',
    languageCode: 'en',
  },
};
