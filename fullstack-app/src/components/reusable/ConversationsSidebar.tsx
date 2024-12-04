import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {ScrollArea} from '@/components/ui/scroll-area';
import {cn} from '@/lib/utils/ui/utils';
import type {ConversationSimplified} from '@/types/Conversation';
import type {Document} from '@/types/Document';
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
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const router = useRouter();

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
                      {/* TODO: Add the conversation id to the url */}
                      <Link href={`/conversation`}>
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
        documents={mockDocuments}
        isOpen={isDocumentPickerModalOpen}
        onSelect={(document) => {
          console.log('document selected!', document);
          void router.push(`/conversation`);
        }}
        searchFunction={(searchQuery) => {
          return mockDocuments.filter((doc) =>
            doc.title.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }}
        onClose={() => setIsDocumentPickerModalOpen(false)}
      />
    </Fragment>
  );
}

const mockDocuments: Document[] = [
  {
    id: '2',
    title: 'Business report',
    date: '2024-10-12T21:21:00.000Z',
    languageCode: 'en',
  },
  {
    id: '3',
    title: 'Bitcoin whitepaper',
    date: '2023-03-07T10:14:00.000Z',
    languageCode: 'en',
  },
  {
    id: '4',
    title: 'Savage Worlds RPG',
    date: '2022-11-23T00:20:54.000Z',
    languageCode: 'en',
  },
  {
    id: '5',
    title: 'Urban mobility report',
    date: '2022-10-05T02:08:00.000Z',
    languageCode: 'en',
  },
  {
    id: '6',
    title: 'Fridge manual model X459 fasd sdad fasd asdf asdf sa d',
    date: '2021-03-10T00:24:00Z',
    languageCode: 'en',
  },
  {
    id: '7',
    title: 'Car manual model Ferrari F8 Tributo',
    date: '2020-01-04T13:45:00Z',
    languageCode: 'en',
  },
  {
    id: '8',
    title: 'Annual Financial Overview 2023',
    date: '2023-12-15T09:00:00.000Z',
    languageCode: 'en',
  },
  {
    id: '9',
    title: 'AI in Healthcare: Trends and Predictions',
    date: '2023-05-20T14:30:00.000Z',
    languageCode: 'en',
  },
];
