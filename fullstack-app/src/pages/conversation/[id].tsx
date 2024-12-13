import {ConversationMain} from '@/components/modules/conversation/ConversationMain';
import {ConversationsSidebar} from '@/components/modules/conversation/ConversationsSidebar';
import MainLayout from '@/components/reusable/MainLayout';
import {useSidebar} from '@/contexts/ConversationsSidebarContext';
import {useTailwindBreakpoint} from '@/hooks/useTailwindBreakpoint';
import {appRouter} from '@/server/api/root';
import {createInnerTRPCContext} from '@/server/api/trpc';
import {buildClerkProps, getAuth} from '@clerk/nextjs/server';
import {createServerSideHelpers} from '@trpc/react-query/server';
import type {GetServerSidePropsContext} from 'next';
import superjson from 'superjson';

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: createInnerTRPCContext({
      authProviderUserId: getAuth(ctx.req).userId!,
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
  const {isCollapsed} = useSidebar();
  const isNotMobile = useTailwindBreakpoint('sm');

  return (
    <MainLayout>
      <div className="flex h-screen w-full flex-row bg-background">
        <ConversationsSidebar />
        {(isCollapsed || isNotMobile) && <ConversationMain />}
      </div>
    </MainLayout>
  );
}
