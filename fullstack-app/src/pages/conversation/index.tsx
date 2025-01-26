import {Sidebar} from '@/components/modules/sidebar/Sidebar';
import {DocumentListPickerModal} from '@/components/reusable/DocumentListPickerModal';
import MainLayout from '@/components/reusable/MainLayout';
import {appRouter} from '@/server/api/root';
import {createInnerTRPCContext} from '@/server/api/trpc';
import {prisma} from '@/server/db/prisma';
import {type Document} from '@/types/Document';
import {api, transformer} from '@/utils/api';
import {buildClerkProps, getAuth} from '@clerk/nextjs/server';
import {createServerSideHelpers} from '@trpc/react-query/server';
import type {GetServerSidePropsContext} from 'next';
import {useRouter} from 'next/router';
import {useState} from 'react';

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
  const authProviderUserId = getAuth(ctx.req).userId!;

  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: createInnerTRPCContext({
      authProviderUserId,
      prismaUser: await prisma.user.findFirst({
        where: {
          authProviderId: authProviderUserId,
        },
      }),
    }),
    transformer,
  });

  // Initialize user
  const locale = ctx.locale;
  const user = await helpers.users.initializePage.fetch({locale});

  if (user == null) {
    throw new Error(
      'User not found. This should not happen because the route is protected by Clerk middleware.'
    );
  }

  // TODO: Redirect user to the proper locale if the stored locale in the db doesn't match this SSR route locale.

  // Prefetch both queries
  await Promise.all([
    helpers.documents.getDocuments.prefetch({titleSearch: undefined}),
    helpers.conversations.getConversations.prefetch({titleSearch: undefined}),
  ]);

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
  const utils = api.useUtils();
  const addConversationMutation = api.conversations.addConversation.useMutation(
    {
      onSuccess: async () => {
        await utils.conversations.getConversations.invalidate();
      },
    }
  );
  const [docTitleSearch, setDocTitleSearch] = useState('');
  const documentsQuery = api.documents.getDocuments.useQuery({
    titleSearch: docTitleSearch.length > 1 ? docTitleSearch : undefined,
  });
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
        <Sidebar />
      </div>

      <DocumentListPickerModal
        documents={documentsQuery.data ?? []}
        isOpen={true}
        onDocumentClick={async (document) => {
          await createNewConversation(document);
        }}
        onSearchQueryChangeDebounced={(searchQuery) => {
          setDocTitleSearch(searchQuery);
        }}
        onClose={() => {
          void router.push('/');
        }}
      />
    </MainLayout>
  );
}
