import {DEFAULT_MESSAGES_LIMIT} from '@/components/modules/conversation/ConversationMain';
import {DocumentListPickerModal} from '@/components/reusable/DocumentListPickerModal';
import {ToggleableLink} from '@/components/reusable/ToggleableLink';
import {Button} from '@/components/shadcn-ui/button';
import {Input} from '@/components/shadcn-ui/input';
import {ScrollArea} from '@/components/shadcn-ui/scroll-area';
import {useSidebar} from '@/contexts/ConversationsSidebarContext';
import {useErrorToast} from '@/hooks/useErrorToast';
import {usePathname} from '@/hooks/usePathname';
import type {Document} from '@/types/Document';
import {api} from '@/utils/api';
import {isStringEmpty} from '@/utils/strings';
import {cn} from '@/utils/ui/utils';
import {MessageSquare, Plus, Search} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useRouter} from 'next/router';
import {Fragment, useEffect, useState} from 'react';
import {useDebounceValue} from 'usehooks-ts';
import {ConversationListItem} from './ConversationListItem';

export function ConversationSidebarSection() {
  const t = useTranslations('sidebar.conversations');
  const getConversationsErrorToast = useErrorToast(
    'sidebar.errors.conversations.get'
  );
  const getDocumentsErrorToast = useErrorToast(
    'document-list-picker-modal.errors.documents.get'
  );
  const addConversationErrorToast = useErrorToast(
    'sidebar.errors.conversation.add'
  );
  const editConversationErrorToast = useErrorToast(
    'sidebar.errors.conversation.edit'
  );
  const deleteConversationErrorToast = useErrorToast(
    'sidebar.errors.conversation.delete'
  );
  const [isDocumentPickerModalOpen, setIsDocumentPickerModalOpen] =
    useState<boolean>(false);
  const router = useRouter();
  const pathname = usePathname();
  const utils = api.useUtils();
  const {isCollapsed} = useSidebar();
  const [conversationSearch, setConversationSearch] = useState('');
  const [debouncedConversationSearch] = useDebounceValue(
    conversationSearch,
    1000
  );

  const conversationsQuery = api.conversations.getConversations.useQuery(
    {
      titleSearch:
        debouncedConversationSearch.length > 1
          ? debouncedConversationSearch
          : undefined,
    },
    {
      enabled: !isCollapsed,
    }
  );

  const currentConversationId = router.query.id as string;
  const conversations = conversationsQuery.data ?? [];
  const [docTitleSearch, setDocTitleSearch] = useState('');
  const documentsQuery = api.documents.getDocuments.useQuery(
    {
      titleSearch: docTitleSearch.length > 1 ? docTitleSearch : undefined,
    },
    {
      enabled: isDocumentPickerModalOpen,
    }
  );

  const documents = documentsQuery.data ?? [];
  const addConversationMutation = api.conversations.addConversation.useMutation(
    {
      onSuccess: async () => {
        await utils.conversations.getConversations.invalidate();
      },
      onError: addConversationErrorToast,
    }
  );

  const editConversationMutation =
    api.conversations.editConversation.useMutation({
      onSuccess: async (conversation) => {
        await utils.conversations.getConversations.invalidate();
        await utils.conversations.getConversation.invalidate();
      },
      onError: editConversationErrorToast,
    });

  const deleteConversationMutation =
    api.conversations.deleteConversation.useMutation({
      onSuccess: async (conversation) => {
        await utils.conversations.getConversations.invalidate();

        // If conversation is the current conversation, redirect to home
        if (pathname === `/conversation/${conversation.id}`) {
          await router.push('/conversation');
        }
      },
      onError: deleteConversationErrorToast,
    });

  const isLoading =
    conversationsQuery.isPending ||
    documentsQuery.isLoading ||
    editConversationMutation.isPending ||
    deleteConversationMutation.isPending ||
    addConversationMutation.isPending;

  useEffect(() => {
    if (conversationsQuery.error != null) {
      getConversationsErrorToast(conversationsQuery.error);
    }
  }, [conversationsQuery.error, getConversationsErrorToast]);

  useEffect(() => {
    if (documentsQuery.error != null) {
      getDocumentsErrorToast(documentsQuery.error);
    }
  }, [documentsQuery.error, getDocumentsErrorToast]);

  async function createNewConversation(doc: Document) {
    const conversationId = await addConversationMutation.mutateAsync({
      documentId: doc.id,
    });

    void router.push(`/conversation/${conversationId}`);
  }

  return (
    <Fragment>
      <div className="flex h-full flex-col gap-4">
        <ToggleableLink
          linkProps={{href: '/conversation'}}
          disabled={pathname.includes('/conversation')}
        >
          <div className="flex items-center">
            <MessageSquare size={22} className="mr-2" />
            <h2
              className={cn(
                'text-xl font-semibold',
                pathname.includes('conversation') ? 'italic' : undefined
              )}
            >
              {t('title')}
            </h2>
          </div>
        </ToggleableLink>

        <div className="relative">
          <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
          <Input
            placeholder={t('search')}
            className="pl-8"
            value={conversationSearch}
            onChange={(ev) => setConversationSearch(ev.target.value)}
          />
        </div>

        <ScrollArea className="max-h-[calc(100vh-18em)]">
          {conversations.map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              isHighlighted={currentConversationId === conversation.id}
              onEdit={async (newTitle) => {
                if (!isStringEmpty(newTitle) && !isLoading) {
                  const newConversation =
                    await editConversationMutation.mutateAsync({
                      id: conversation.id,
                      title: newTitle,
                    });

                  return newConversation.title;
                } else {
                  return conversation.title;
                }
              }}
              onDelete={async () => {
                if (isLoading) {
                  return;
                }

                await deleteConversationMutation.mutateAsync({
                  id: conversation.id,
                });
              }}
              onPreview={() => {
                void utils.conversations.getConversation.prefetch({
                  id: conversation.id,
                  withDocuments: true,
                  withMessages: false,
                });

                void utils.conversations.getConversationMessages.prefetchInfinite(
                  {
                    conversationId: conversation.id,
                    limit: DEFAULT_MESSAGES_LIMIT,
                  }
                );
              }}
              isLoading={isLoading}
            />
          ))}
        </ScrollArea>

        <Button
          className="w-full"
          disabled={isLoading}
          onClick={() => setIsDocumentPickerModalOpen(true)}
          onMouseEnter={() => {
            void utils.documents.getDocuments.prefetch({
              titleSearch: undefined,
            });
          }}
          onFocus={() => {
            void utils.documents.getDocuments.prefetch({
              titleSearch: undefined,
            });
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          {t('newConversation')}
        </Button>
      </div>

      <DocumentListPickerModal
        documents={documents}
        isOpen={isDocumentPickerModalOpen}
        isLoading={isLoading}
        onDocumentClick={async (document) => {
          if (isLoading) {
            return;
          }

          await createNewConversation(document);
        }}
        onSearchQueryChangeDebounced={(searchQuery) =>
          setDocTitleSearch(searchQuery)
        }
        onClose={() => setIsDocumentPickerModalOpen(false)}
      />
    </Fragment>
  );
}
