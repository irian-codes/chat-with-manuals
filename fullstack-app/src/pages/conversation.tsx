import {ConversationMain} from '@/components/pages/conversation/ConversationMain';
import {ConversationsSidebar} from '@/components/reusable/ConversationsSidebar';
import MainLayout from '@/components/reusable/MainLayout';
import {useSidebar} from '@/contexts/ConversationsSidebarContext';
import {useTailwindBreakpoint} from '@/hooks/useTailwindBreakpoint';
import type {Conversation, ConversationSimplified} from '@/types/Conversation';
import type {i18nMessages} from '@/types/i18nMessages';
import type {
  GetServerSideProps,
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from 'next';

export const getServerSideProps = (async (ctx: GetServerSidePropsContext) => {
  // TODO: Replace with actual API calls
  const conversations: ConversationSimplified[] = [
    {id: '1', title: 'How does Bitcoin work and what are its implications?'},
    {id: '2', title: 'Troubleshooting volume issues in audio systems.'},
    {id: '3', title: 'Moving with a pawn in chess: strategies and tips.'},
    {id: '4', title: 'Configuring a detector for optimal performance.'},
  ];

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

  return {
    props: {
      conversations,
      conversation,
      // eslint-disable-next-line
      messages: (await import(`../i18n/messages/${ctx.locale}.json`)).default,
    },
  };
}) satisfies GetServerSideProps<{
  conversations: ConversationSimplified[];
  conversation: Conversation;
  messages: i18nMessages;
}>;

export default function DashboardPage({
  conversations,
  conversation,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const {isCollapsed} = useSidebar();
  const isNotMobile = useTailwindBreakpoint('sm');

  return (
    <MainLayout>
      <div className="flex h-screen w-full flex-row bg-background">
        <ConversationsSidebar conversations={conversations} />
        {(isCollapsed || isNotMobile) && (
          <ConversationMain conversation={conversation} />
        )}
      </div>
    </MainLayout>
  );
}
