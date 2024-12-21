import {ConversationsSidebar} from '@/components/modules/conversation/ConversationsSidebar';
import {DashboardMain} from '@/components/modules/dashboard/DashboardMain';
import {DashboardModals} from '@/components/modules/dashboard/DashboardModals';
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
import {Fragment} from 'react';

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

  await helpers.conversations.getConversations.prefetch();

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
