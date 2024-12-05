import {DashboardMain} from '@/components/pages/dashboard/DashboardMain';
import {DashboardModals} from '@/components/pages/dashboard/DashboardModals';
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
import {Fragment} from 'react';
import superjson from 'superjson';

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: createInnerTRPCContext({
      userId: getAuth(ctx.req).userId ?? null,
    }),
    transformer: superjson,
  });

  // Prefetch both queries
  await Promise.all([
    helpers.documents.getDocuments.prefetch(),
    helpers.documents.getConversations.prefetch({simplify: true}),
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
  const conversationsCall = api.documents.getConversations.useQuery({
    simplify: true,
  });
  const documentsCall = api.documents.getDocuments.useQuery();

  const {isCollapsed} = useSidebar();
  const isNotMobile = useTailwindBreakpoint('sm');

  // TODO: Redirect user to error page if there's an error on the calls.

  return (
    <MainLayout>
      <Fragment>
        <div className="flex h-screen w-full flex-row bg-background">
          <ConversationsSidebar conversations={conversationsCall.data ?? []} />
          {(isCollapsed || isNotMobile) && (
            <DashboardMain documents={documentsCall.data ?? []} />
          )}
        </div>

        <DashboardModals documents={documentsCall.data ?? []} />
      </Fragment>
    </MainLayout>
  );
}
