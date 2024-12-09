import {ConversationMain} from '@/components/pages/conversation/ConversationMain';
import {ConversationsSidebar} from '@/components/reusable/ConversationsSidebar';
import MainLayout from '@/components/reusable/MainLayout';
import {useSidebar} from '@/contexts/ConversationsSidebarContext';
import {useTailwindBreakpoint} from '@/hooks/useTailwindBreakpoint';
import {appRouter} from '@/server/api/root';
import {createInnerTRPCContext} from '@/server/api/trpc';
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
      userId: getAuth(ctx.req).userId ?? null,
    }),
    transformer: superjson,
  });

  const conversationId = ctx.params?.id as string;

  await Promise.all([
    helpers.conversations.getConversations.prefetch({simplify: true}),
    helpers.conversations.getConversation.prefetch({id: conversationId}),
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

export default function ConversationPage() {
  const router = useRouter();
  const conversationId = router.query.id as string;

  const conversationsCall = api.conversations.getConversations.useQuery({
    simplify: true,
  });

  const conversationCall = api.conversations.getConversation.useQuery({
    id: conversationId,
  });

  const {isCollapsed} = useSidebar();
  const isNotMobile = useTailwindBreakpoint('sm');

  // TODO: Redirect user to error page if there's an error on the calls.
  if (conversationCall.isError || !conversationCall.data) {
    return <div>Error</div>;
  }

  return (
    <MainLayout>
      <div className="flex h-screen w-full flex-row bg-background">
        <ConversationsSidebar conversations={conversationsCall.data ?? []} />
        {(isCollapsed || isNotMobile) && (
          <ConversationMain conversation={conversationCall.data} />
        )}
      </div>
    </MainLayout>
  );
}
