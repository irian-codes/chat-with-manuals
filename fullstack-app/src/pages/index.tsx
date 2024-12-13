import {ConversationsSidebar} from '@/components/modules/conversation/ConversationsSidebar';
import {DashboardMain} from '@/components/modules/dashboard/DashboardMain';
import {DashboardModals} from '@/components/modules/dashboard/DashboardModals';
import MainLayout from '@/components/reusable/MainLayout';
import {useSidebar} from '@/contexts/ConversationsSidebarContext';
import {useTailwindBreakpoint} from '@/hooks/useTailwindBreakpoint';
import {appRouter} from '@/server/api/root';
import {createInnerTRPCContext} from '@/server/api/trpc';
import {buildClerkProps, getAuth} from '@clerk/nextjs/server';
import {createServerSideHelpers} from '@trpc/react-query/server';
import type {GetServerSidePropsContext} from 'next';
import {Fragment} from 'react';
import superjson from 'superjson';

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: createInnerTRPCContext({
      authProviderUserId: getAuth(ctx.req).userId!,
    }),
    transformer: superjson,
  });

  // Prefetch both queries
  await Promise.all([
    helpers.documents.getDocuments.prefetch(),
    helpers.conversations.getConversations.prefetch({simplify: true}),
  ]);

  const locale = ctx.locale;

  return {
    props: {
      trpcState: helpers.dehydrate(),
      ...buildClerkProps(ctx.req),
      // eslint-disable-next-line
      messages: (await import(`../i18n/messages/${locale}.json`)).default,
    },
  };
};

export default function DashboardPage() {
  const {isCollapsed} = useSidebar();
  const isNotMobile = useTailwindBreakpoint('sm');

  return (
    <MainLayout>
      <Fragment>
        <div className="flex h-screen w-full flex-row bg-background">
          <ConversationsSidebar />
          {(isCollapsed || isNotMobile) && <DashboardMain />}
        </div>

        <DashboardModals />
      </Fragment>
    </MainLayout>
  );
}
