import {ConversationsSidebar} from '@/components/custom/ConversationsSidebar';
import {DashboardModals} from '@/components/custom/DashboardModals';
import MainLayout from '@/components/custom/MainLayout';
import {Dashboard} from '@/components/dashboard';
import type {ConversationSimplified} from '@/types/Conversation';
import type {Document} from '@/types/Document';
import type {i18nMessages} from '@/types/i18nMessages';
import type {
  GetServerSideProps,
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
} from 'next';
import {Fragment} from 'react';

export const getServerSideProps = (async (ctx: GetServerSidePropsContext) => {
  // TODO: Replace with actual API calls
  const conversations: ConversationSimplified[] = [
    {id: '1', title: 'How does Bitcoin work and what are its implications?'},
    {id: '2', title: 'Troubleshooting volume issues in audio systems.'},
    {id: '3', title: 'Moving with a pawn in chess: strategies and tips.'},
    {id: '4', title: 'Configuring a detector for optimal performance.'},
  ];

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

  const locale = ctx.locale;

  return {
    props: {
      conversations,
      documents,
      // eslint-disable-next-line
      messages: (await import(`../i18n/messages/${locale}.json`)).default,
    },
  };
}) satisfies GetServerSideProps<{
  conversations: ConversationSimplified[];
  documents: Document[];
  messages: i18nMessages;
}>;

export default function DashboardPage({
  conversations,
  documents,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <MainLayout>
      <Fragment>
        <div className="flex h-screen w-full flex-row bg-background">
          <ConversationsSidebar conversations={conversations} />
          <Dashboard documents={documents} />
        </div>

        <DashboardModals documents={documents} />
      </Fragment>
    </MainLayout>
  );
}
