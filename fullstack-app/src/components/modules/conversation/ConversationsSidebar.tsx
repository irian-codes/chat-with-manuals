import {Button} from '@/components/shadcn-ui/button';
import {Input} from '@/components/shadcn-ui/input';
import {ScrollArea} from '@/components/shadcn-ui/scroll-area';
import {useSidebar} from '@/contexts/ConversationsSidebarContext';
import type {Document} from '@/types/Document';
import {api} from '@/utils/api';
import {isStringEmpty} from '@/utils/strings';
import {cn} from '@/utils/ui/utils';
import {Menu, Plus, Search} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {Fragment, useState} from 'react';
import {useDebounce} from 'use-debounce';
import {DocumentListPickerModal} from '../../reusable/DocumentListPickerModal';

export function ConversationsSidebar() {
  const t = useTranslations('conversation-sidebar');
  const [isDocumentPickerModalOpen, setIsDocumentPickerModalOpen] =
    useState<boolean>(false);
  const {isCollapsed, setIsCollapsed} = useSidebar();
  const router = useRouter();
  const utils = api.useUtils();
  const [conversationSearch, setConversationSearch] = useState('');
  const [debouncedConversationSearch] = useDebounce(conversationSearch, 1000);
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
    }
  );

  async function createNewConversation(doc: Document) {
    const conversationId = await addConversationMutation.mutateAsync({
      documentId: doc.id,
    });

    void router.push(`/conversation/${conversationId}`);
  }

  return (
    <Fragment>
      <div
        className={cn(
          'border-r transition-all duration-300',
          isCollapsed ? 'w-12' : 'w-80'
        )}
      >
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <h2 className="text-xl font-semibold">{t('title')}</h2>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>

          {!isCollapsed && (
            <Fragment>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('search')}
                  className="pl-8"
                  value={conversationSearch}
                  onChange={(ev) => setConversationSearch(ev.target.value)}
                />
              </div>
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="space-y-2">
                  {conversations.map((conversation) => (
                    <Button
                      key={conversation.id}
                      variant="ghost"
                      className="w-full justify-start"
                      onMouseEnter={() => {
                        void utils.conversations.getConversation.prefetch({
                          id: conversation.id,
                        });
                      }}
                      onFocus={() => {
                        void utils.conversations.getConversation.prefetch({
                          id: conversation.id,
                        });
                      }}
                    >
                      <Link
                        href={`/conversation/${conversation.id}`}
                        prefetch={!isCollapsed}
                        className="w-full text-left"
                      >
                        <span className="truncate font-normal">
                          {isStringEmpty(conversation.title)
                            ? t('conversation-title-missing')
                            : conversation.title}
                        </span>
                      </Link>
                    </Button>
                  ))}
                  <Button
                    className="w-full"
                    onClick={() => setIsDocumentPickerModalOpen(true)}
                    onMouseEnter={() => {
                      void utils.documents.getDocuments.prefetch();
                    }}
                    onFocus={() => {
                      void utils.documents.getDocuments.prefetch();
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {t('newConversation')}
                  </Button>
                </div>
              </ScrollArea>
            </Fragment>
          )}
        </div>
      </div>

      <DocumentListPickerModal
        documents={documents}
        isOpen={isDocumentPickerModalOpen}
        onDocumentClick={async (document) => {
          console.log('NEW conversation started with document: ', document);
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
