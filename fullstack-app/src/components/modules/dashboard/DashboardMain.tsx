import {DocumentCard} from '@/components/modules/dashboard/DocumentCard';
import {Header} from '@/components/reusable/Header';
import {Button} from '@/components/shadcn-ui/button';
import {Input} from '@/components/shadcn-ui/input';
import {env} from '@/env';
import {type ToastErrorType, useErrorToast} from '@/hooks/useErrorToast';
import type {Document} from '@/types/Document';
import {api} from '@/utils/api';
import {STATUS} from '@prisma/client';
import {Search, Upload} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useRouter} from 'next/router';
import {useEffect, useState} from 'react';
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
  const getDocumentsErrorToast = useErrorToast(
    'document-manager.errors.documents.get'
  );
  const cancelDocumentParsingErrorToast = useErrorToast(
    'document-manager.errors.documents.cancelDocumentParsing'
  );
  const documentParsingSubscriptionErrorToast = useErrorToast(
    'document-manager.errors.documents.documentParsing.sse-subscription'
  );
  const documentParsingUpdateErrorToast = useErrorToast(
    'document-manager.errors.documents.documentParsing.document-parsing-update'
  );
  const addConversationErrorToast = useErrorToast(
    'document-manager.errors.conversation.add'
  );

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

          if (data.action === 'error') {
            documentParsingUpdateErrorToast({
              data: {
                code: 'UNKNOWN_ERROR',
              },
            } satisfies ToastErrorType);
          }
        },
        onError: (error) => {
          if (env.NEXT_PUBLIC_CLIENT_ENV === 'development') {
            console.error(
              'Error subscribing to document parsing updates:',
              error
            );
          }

          documentParsingSubscriptionErrorToast(error);
        },
      }
    );

  const documents = documentsQuery.data ?? [];
  const pendingDocuments = pendingDocumentsSubs.data?.docs ?? [];
  const cancelDocumentParsingMutation =
    api.documents.cancelDocumentParsing.useMutation({
      onError: cancelDocumentParsingErrorToast,
    });
  const addConversationMutation = api.conversations.addConversation.useMutation(
    {
      onSuccess: async () => {
        await utils.conversations.getConversations.invalidate();
      },
      onError: addConversationErrorToast,
    }
  );

  const isLoading =
    cancelDocumentParsingMutation.isPending ||
    addConversationMutation.isPending;

  useEffect(() => {
    if (documentsQuery.error != null) {
      getDocumentsErrorToast(documentsQuery.error);
    }
  }, [documentsQuery.error, getDocumentsErrorToast]);

  function handleCancelDocumentParsing(docId: string) {
    if (isLoading) {
      return;
    }

    cancelDocumentParsingMutation.mutate({
      id: docId,
    });
  }

  function handleUpdateDocument(doc: Document) {
    void router.push(`/?documentId=${doc.id}`, undefined, {
      shallow: true,
    });
  }

  async function handleCreateConversation(doc: Document) {
    if (isLoading) {
      return;
    }

    const conversationId = await addConversationMutation.mutateAsync({
      documentId: doc.id,
    });

    void router.push(`/conversation/${conversationId}`);
  }

  return (
    <div className="flex-1">
      <Header>
        <div className="flex flex-row flex-wrap gap-4">
          <div className="relative max-w-md min-w-[200px] flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
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
                isLoading={isLoading}
              />
            ) : (
              <DocumentCard
                doc={doc}
                key={doc.id}
                isLoading={isLoading}
                onUpdateButtonClick={(ev) => {
                  ev.preventDefault();
                  void handleUpdateDocument(doc);
                }}
                onUpdateDocumentPreview={(ev) => {
                  ev.preventDefault();
                  void utils.documents.getDocument.prefetch({id: doc.id});
                }}
                onNewConversationButtonClick={() =>
                  void handleCreateConversation(doc)
                }
              />
            )
          )}
        </div>
      </main>
    </div>
  );
}
