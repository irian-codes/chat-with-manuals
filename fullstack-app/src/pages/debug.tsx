import MainLayout from '@/components/reusable/MainLayout';
import {env} from '@/env';
import {api} from '@/utils/api';
import {type GetStaticProps} from 'next';
import {useState} from 'react';

export const getStaticProps: GetStaticProps = async () => {
  if (env.NODE_ENV !== 'development') {
    console.warn('Debug route is not available in production. Disabling...');

    return {notFound: true};
  }

  return {props: {}};
};

export default function DebugPage() {
  const [collectionName, setCollectionName] = useState('');
  const chromaMutation = api.debug.debugStoreInChroma.useMutation();
  const clearChromaMutation = api.debug.debugClearChroma.useMutation({
    onSuccess: () => {
      chromaMutation.reset();
    },
  });
  const getDocsQuery = api.debug.debugGetDocsFromChroma.useQuery(
    {collectionName},
    {
      enabled: false,
    }
  );

  const error =
    chromaMutation.error ?? getDocsQuery.error ?? clearChromaMutation.error;
  const data = chromaMutation.data ?? getDocsQuery.data;

  const handleStoreInChromaCustom = () => {
    chromaMutation.mutate();
  };

  const handleClearChroma = () => {
    clearChromaMutation.mutate();
  };

  const handleGetDocsFromChroma = () => {
    void getDocsQuery.refetch();
  };

  if (error) {
    console.error(error);
  }

  return (
    <MainLayout>
      <div className="flex flex-col items-start gap-2 rounded-md bg-gray-100 p-4">
        <h1 className="text-2xl font-semibold">Debug Page</h1>
        <p>This is a simple debug page to help with troubleshooting.</p>
        <button
          onClick={handleStoreInChromaCustom}
          className="bg-blue-400 px-4 py-2 text-white"
        >
          Store in Chroma
        </button>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Collection name (UUID)"
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
          />
          <button
            onClick={handleGetDocsFromChroma}
            className="bg-blue-400 px-4 py-2 text-white"
          >
            Get docs from Chroma
          </button>
        </div>
        <button
          onClick={handleClearChroma}
          className="bg-red-400 px-4 py-2 text-white"
        >
          Clear Chroma
        </button>
        {chromaMutation.isPending && <p>Loading...</p>}
        {error && <p>Error!</p>}
        {data && (
          <div className="flex flex-col gap-1">
            <p>Data:</p>
            <p>{JSON.stringify(data)}</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
