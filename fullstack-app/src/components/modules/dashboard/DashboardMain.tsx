import {DocumentCard} from '@/components/modules/dashboard/DocumentCard';
import {Header} from '@/components/reusable/Header';
import {UploadDocumentButton} from '@/components/reusable/UploadDocumentButton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/shadcn-ui/card';
import {Input} from '@/components/shadcn-ui/input';
import {env} from '@/env';
import {type ToastErrorType, useErrorToast} from '@/hooks/useErrorToast';
import type {Document} from '@/types/Document';
import {api} from '@/utils/api';
import {STATUS} from '@prisma/client';
import {Search} from 'lucide-react';
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
  const allDocuments = [...pendingDocuments, ...documents];
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
    <div className="w-full min-w-0 flex-1">
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
            <UploadDocumentButton uploadIconProps={{className: 'mr-2'}} />
          </div>
        </div>
      </Header>

      <main className="p-4">
        {allDocuments.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center p-6">
            <Card className="w-full max-w-md shadow-md">
              <CardHeader className="mb-4 text-center">
                <CardTitle className="text-2xl font-bold">
                  {t('no-documents-title')}
                </CardTitle>
                <CardDescription className="text-primary">
                  {t('no-documents-body')}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center">
                <UploadDocumentButton
                  buttonProps={{
                    className: 'max-w-54 p-2 sm:p-4',
                    variant: 'default',
                    size: 'lg',
                  }}
                  textProps={{className: 'w-full text-wrap'}}
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-row flex-wrap gap-4">
            {allDocuments.map((doc) =>
              'status' in doc ? (
                <DocumentCard
                  doc={doc}
                  key={doc.id}
                  onCancelButtonClick={() =>
                    handleCancelDocumentParsing(doc.id)
                  }
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
        )}
      </main>
    </div>
  );
}
