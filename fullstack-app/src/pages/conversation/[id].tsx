import {
  ConversationMain,
  DEFAULT_MESSAGES_LIMIT,
} from '@/components/modules/conversation/ConversationMain';
import {ConversationsSidebar} from '@/components/modules/conversation/ConversationsSidebar';
import MainLayout from '@/components/reusable/MainLayout';
import {useSidebar} from '@/contexts/ConversationsSidebarContext';
import {useTailwindBreakpoint} from '@/hooks/useTailwindBreakpoint';
import {appRouter} from '@/server/api/root';
import {createInnerTRPCContext} from '@/server/api/trpc';
import {prisma} from '@/server/db/prisma';
import {transformer} from '@/utils/api';
import {buildClerkProps, getAuth} from '@clerk/nextjs/server';
import {createServerSideHelpers} from '@trpc/react-query/server';
import type {GetServerSidePropsContext} from 'next';

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

  const conversationId = ctx.params?.id as string;

  await Promise.all([
    helpers.conversations.getConversations.prefetch(),
    helpers.conversations.getConversation.prefetch({
      id: conversationId,
      withDocuments: true,
      withMessages: false,
    }),
    helpers.conversations.getConversationMessages.prefetchInfinite({
      conversationId,
      limit: DEFAULT_MESSAGES_LIMIT,
    }),
  ]);

  return {
    props: {
      trpcState: helpers.dehydrate(),
      ...buildClerkProps(ctx.req),
      // eslint-disable-next-line
      messages: (await import(`@/i18n/messages/${locale}.json`)).default,
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
