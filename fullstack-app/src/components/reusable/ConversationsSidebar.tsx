import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {ScrollArea} from '@/components/ui/scroll-area';
import {useSidebar} from '@/contexts/ConversationsSidebarContext';
import type {ConversationSimplified} from '@/types/Conversation';
import type {Document} from '@/types/Document';
import {api} from '@/utils/api';
import {cn} from '@/utils/ui/utils';
import {Menu, Plus, Search} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {Fragment, useState} from 'react';
import {DocumentPickerModal} from './DocumentListPickerModal';

interface ConversationSidebarProps {
  conversations: ConversationSimplified[];
}

export function ConversationsSidebar({
  conversations,
}: ConversationSidebarProps) {
  const t = useTranslations('conversation-sidebar');
  const [isDocumentPickerModalOpen, setIsDocumentPickerModalOpen] =
    useState<boolean>(false);
  const {isCollapsed, setIsCollapsed} = useSidebar();
  const router = useRouter();
  const documentsCall = api.documents.getDocuments.useQuery();
  const addConversationCall = api.conversations.addConversation.useMutation();

  async function createNewConversation(doc: Document) {
    const conversationId = await addConversationCall.mutateAsync({
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
                <Input placeholder={t('search')} className="pl-8" />
              </div>
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="space-y-2">
                  {conversations.map((conversation) => (
                    <Button
                      key={conversation.id}
                      variant="ghost"
                      className="w-full justify-start"
                    >
                      <Link href={`/conversation/${conversation.id}`}>
                        <span className="truncate font-normal">
                          {conversation.title}
                        </span>
                      </Link>
                    </Button>
                  ))}
                  <Button
                    className="w-full"
                    onClick={() => setIsDocumentPickerModalOpen(true)}
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

      <DocumentPickerModal
        documents={documentsCall.data ?? []}
        isOpen={isDocumentPickerModalOpen}
        onSelect={async (document) => {
          console.log('NEW conversation started with document: ', document);
          await createNewConversation(document);
        }}
        searchFunction={(searchQuery) => {
          if (documentsCall.data == null) {
            return [];
          }

          return documentsCall.data.filter((doc) =>
            doc.title.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }}
        onClose={() => setIsDocumentPickerModalOpen(false)}
      />
    </Fragment>
  );
}
