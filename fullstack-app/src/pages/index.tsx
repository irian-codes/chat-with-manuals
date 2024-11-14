import Link from 'next/link';

import MainLayout from '@/components/custom/MainLayout';
import {appRouter} from '@/server/api/root';
import {createInnerTRPCContext} from '@/server/api/trpc';
import {api} from '@/utils/api';
import {SignedIn, SignedOut, SignInButton, SignOutButton} from '@clerk/nextjs';
import {createServerSideHelpers} from '@trpc/react-query/server';
import type {GetServerSidePropsContext} from 'next';
import superjson from 'superjson';

export default function Home() {
  const {
    data: latestPost,
    isLoading: isLatestPostLoading,
    isError: isLatestPostError,
    error,
  } = api.post.getLatest.useQuery();

  if (isLatestPostLoading) return <div>Loading...</div>;
  if (isLatestPostError) return <div>Error: {error?.message}</div>;
  if (latestPost == null) return <div>No post found</div>;

  return (
    <MainLayout>
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
          Create <span className="text-[hsl(280,100%,70%)]">T3</span> App
        </h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
          <Link
            className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 text-white hover:bg-white/20"
            href="https://create.t3.gg/en/usage/first-steps"
            target="_blank"
          >
            <h3 className="text-2xl font-bold">First Steps →</h3>
            <div className="text-lg">
              Just the basics - Everything you need to know to set up your
              database and authentication.
            </div>
          </Link>
          <Link
            className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 text-white hover:bg-white/20"
            href="https://create.t3.gg/en/introduction"
            target="_blank"
          >
            <h3 className="text-2xl font-bold">Documentation →</h3>
            <div className="text-lg">
              Learn more about Create T3 App, the libraries it uses, and how to
              deploy it.
            </div>
          </Link>
        </div>
        <SignedIn>
          <div className="mt-8 rounded-xl bg-white/10 p-4 text-white">
            <h2 className="text-2xl font-bold">Latest Post</h2>
            {latestPost ? (
              <>
                <p className="text-lg">{latestPost.name}</p>
                <p className="text-sm">{latestPost.content}</p>
              </>
            ) : (
              <p className="text-lg italic">No last post found</p>
            )}
          </div>
          <div className="text-blue-500">
            <SignOutButton />
          </div>
        </SignedIn>
        <SignedOut>
          <SignInButton />
        </SignedOut>
      </div>
    </MainLayout>
  );
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: createInnerTRPCContext({
      userId: null,
    }),
    transformer: superjson,
  });

  await helpers.post.getLatest.prefetch();

  // Make sure to return { props: { trpcState: helpers.dehydrate() } }
  return {
    props: {
      trpcState: helpers.dehydrate(),
    },
  };
}
