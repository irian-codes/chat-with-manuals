import {createTRPCRouter, publicProcedure} from '@/server/api/trpc';
import {
  type Conversation,
  type ConversationSimplified,
} from '@/types/Conversation';
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

      const conversation: Conversation = {
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
            content:
              'I have a question about Bitcoin. Can you explain how it works?',
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

      return conversation;
    }),
});
