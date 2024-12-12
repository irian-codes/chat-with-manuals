import {ConversationsSidebar} from '@/components/modules/conversation/ConversationsSidebar';
import {DocumentListPickerModal} from '@/components/reusable/DocumentListPickerModal';
import MainLayout from '@/components/reusable/MainLayout';
import {appRouter} from '@/server/api/root';
import {createInnerTRPCContext} from '@/server/api/trpc';
import {type Document} from '@/types/Document';
import {api} from '@/utils/api';
import {buildClerkProps, getAuth} from '@clerk/nextjs/server';
import {createServerSideHelpers} from '@trpc/react-query/server';
import type {GetServerSidePropsContext} from 'next';
import {useRouter} from 'next/router';
import superjson from 'superjson';

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: createInnerTRPCContext({
      authProviderUserId: getAuth(ctx.req).userId ?? null,
    }),
    transformer: superjson,
  });

  await helpers.conversations.getConversations.prefetch({simplify: true});
  await helpers.documents.getDocuments.prefetch();

  return {
    props: {
      trpcState: helpers.dehydrate(),
      ...buildClerkProps(ctx.req),
      // eslint-disable-next-line
      messages: (await import(`@/i18n/messages/${ctx.locale}.json`)).default,
    },
  };
};

export default function NewConversationPage() {
  const addConversationMutation =
    api.conversations.addConversation.useMutation();
  const documentsQuery = api.documents.getDocuments.useQuery();
  const router = useRouter();

  async function createNewConversation(doc: Document) {
    const conversationId = await addConversationMutation.mutateAsync({
      documentId: doc.id,
    });

    void router.push(`/conversation/${conversationId}`);
  }

  return (
    <MainLayout>
      <div className="flex h-screen w-full flex-row bg-background">
        <ConversationsSidebar />
      </div>

      <DocumentListPickerModal
        documents={documentsQuery.data ?? []}
        isOpen={true}
        onSelect={async (document) => {
          console.log('NEW conversation started with document: ', document);
          await createNewConversation(document);
        }}
        searchFunction={(searchQuery) => {
          if (documentsQuery.data == null) {
            return [];
          }

          return documentsQuery.data.filter((doc) =>
            doc.title.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }}
        onClose={() => {
          void router.push('/');
        }}
      />
    </MainLayout>
  );
}
