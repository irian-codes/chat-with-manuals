import {createTRPCRouter, publicProcedure} from '@/server/api/trpc';
import {Conversation, ConversationSimplified} from '@/types/Conversation';
import type {Document} from '@/types/Document';
import {z} from 'zod';

export const documentsRouter = createTRPCRouter({
  // TODO #10: This should be an authed procedure: https://clerk.com/docs/references/nextjs/trpc
  getDocuments: publicProcedure.query(({ctx}) => {
    // TODO: Get only the documents for the specific user.

    const documents: Document[] = [
      {
        id: '2',
        title: 'Business report',
        date: '2024-10-12T21:21:00.000Z',
        languageCode: 'en',
      },
      {
        id: '3',
        title: 'Bitcoin whitepaper',
        date: '2023-03-07T10:14:00.000Z',
        languageCode: 'en',
      },
      {
        id: '4',
        title: 'Savage Worlds RPG',
        date: '2022-11-23T00:20:54.000Z',
        languageCode: 'en',
      },
      {
        id: '5',
        title: 'Urban mobility report',
        date: '2022-10-05T02:08:00.000Z',
        languageCode: 'en',
      },
      {
        id: '6',
        title: 'Fridge manual model X459 fasd sdad fasd  asdf asdf sa d',
        date: '2021-03-10T00:24:00Z',
        languageCode: 'en',
      },
    ];

    return documents;
  }),

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
});
