import MainLayout from '@/components/reusable/MainLayout';
import {env} from '@/env';
import {api} from '@/utils/api';
import {type GetStaticProps} from 'next';

export const getStaticProps: GetStaticProps = async () => {
  if (env.NODE_ENV !== 'development') {
    console.warn('Debug route is not available in production. Disabling...');

    return {notFound: true};
  }

  return {props: {}};
};

export default function DebugPage() {
  const {data} = api.debug.debug.useQuery();

  return (
    <MainLayout>
      <div style={{padding: '20px', backgroundColor: '#f0f0f0'}}>
        <h1 className="text-2xl font-semibold">Debug Page</h1>
        <p>This is a simple debug page to help with troubleshooting.</p>
        <p>{data ?? 'No data'}</p>
      </div>
    </MainLayout>
  );
}
