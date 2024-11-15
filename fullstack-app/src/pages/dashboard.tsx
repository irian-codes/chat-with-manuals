import MainLayout from '@/components/custom/MainLayout';
import {Dashboard} from '@/components/dashboard';
import type {Conversation} from '@/types/Conversation';
import type {Document} from '@/types/Document';
import type {GetServerSideProps, InferGetServerSidePropsType} from 'next';

export const getServerSideProps = (async () => {
  // TODO: Replace with actual API calls
  const conversations: Conversation[] = [
    {id: '1', title: 'How does Bitcoin work and what are its implications?'},
    {id: '2', title: 'Troubleshooting volume issues in audio systems.'},
    {id: '3', title: 'Moving with a pawn in chess: strategies and tips.'},
    {id: '4', title: 'Configuring a detector for optimal performance.'},
  ];

  const documents: Document[] = [
    {id: '1', title: 'Uploading...', date: '3 minutes ago'},
    {id: '2', title: 'Business report', date: '2024-10-12'},
    {id: '3', title: 'Bitcoin whitepaper', date: '2023-03-07'},
    {id: '4', title: 'Savage Worlds RPG', date: '2022-11-23'},
    {id: '5', title: 'Urban mobility report', date: '2022-10-05'},
    {
      id: '6',
      title: 'Fridge manual model X459 fasd sdad fasd  asdf asdf sa d',
      date: '2021-03-10',
    },
  ];

  return {
    props: {
      conversations,
      documents,
    },
  };
}) satisfies GetServerSideProps<{
  conversations: Conversation[];
  documents: Document[];
}>;

export default function DashboardPage({
  conversations,
  documents,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <MainLayout>
      <Dashboard conversations={conversations} documents={documents} />
    </MainLayout>
  );
}
