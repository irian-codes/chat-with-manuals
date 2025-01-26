import {DocumentCard} from '@/components/reusable/DocumentCard';
import {Header} from '@/components/reusable/Header';
import {Button} from '@/components/shadcn-ui/button';
import {Input} from '@/components/shadcn-ui/input';
import type {Document} from '@/types/Document';
import {api} from '@/utils/api';
import {STATUS} from '@prisma/client';
import {Search, Upload} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useRouter} from 'next/router';
import {useState} from 'react';
import {useDebounceValue} from 'usehooks-ts';

export function DashboardMain() {
  const t = useTranslations('document-manager');
  const router = useRouter();
  const utils = api.useUtils();
  const [titleSearch, setTitleSearch] = useState('');
  const [debouncedTitleSearch] = useDebounceValue(titleSearch, 1000);
  const documentsQuery = api.documents.getDocuments.useQuery({
    titleSearch:
      debouncedTitleSearch.length > 1 ? debouncedTitleSearch : undefined,
  });
  const pendingDocumentsSubs =
    api.documents.onDocumentParsingUpdate.useSubscription(
      {
        includedStatuses: [STATUS.PENDING, STATUS.RUNNING],
      },
      {
        onData: (data) => {
          // If a document finished parsing, it means now it's in the documents list, so we refetch it.
          if (data.action === 'finished') {
            void utils.documents.getDocuments.invalidate();
          }

          // TODO: Handle error ones on the UI to indicate they're errors.
          // Or maybe send an email about it and that's enough. For now we
          // don't fetch them.
          // if (data.action === 'error') {}
        },
        onError: (error) => {
          console.error(
            'Error subscribing to document parsing updates:',
            error
          );
        },
      }
    );

  const documents = documentsQuery.data ?? [];
  const pendingDocuments = pendingDocumentsSubs.data?.docs ?? [];
  const cancelDocumentParsingMutation =
    api.documents.cancelDocumentParsing.useMutation();

  function handleCancelDocumentParsing(docId: string) {
    cancelDocumentParsingMutation.mutate({
      id: docId,
    });

    // TODO: Show notification (error and success) to the user
  }

  function handleUpdateDocument(doc: Document) {
    // TODO: Show notification (error and success) to the user

    void router.push(`/?documentId=${doc.id}`, undefined, {
      shallow: true,
    });
  }

  return (
    <div className="flex-1">
      <Header>
        <div className="flex flex-row flex-wrap gap-4">
          <div className="relative min-w-[200px] max-w-md flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('header.search')}
              className="pl-8"
              value={titleSearch}
              onChange={(ev) => setTitleSearch(ev.target.value)}
            />
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={() =>
                void router.push('/?uploadingDocument=true', undefined, {
                  shallow: true,
                })
              }
            >
              <Upload className="mr-2 h-4 w-4" />
              {t('header.upload')}
            </Button>
          </div>
        </div>
      </Header>

      <main className="p-4">
        <div className="flex flex-row flex-wrap gap-4">
          {[...pendingDocuments, ...documents].map((doc) =>
            'status' in doc ? (
              <DocumentCard
                doc={doc}
                key={doc.id}
                onCancelButtonClick={() => handleCancelDocumentParsing(doc.id)}
              />
            ) : (
              <DocumentCard
                doc={doc}
                key={doc.id}
                onUpdateButtonClick={(ev) => {
                  ev.preventDefault();
                  handleUpdateDocument(doc);
                }}
                onUpdateDocumentPreview={(ev) => {
                  ev.preventDefault();
                  void utils.documents.getDocument.prefetch({id: doc.id});
                }}
              />
            )
          )}
        </div>
      </main>
    </div>
  );
}
