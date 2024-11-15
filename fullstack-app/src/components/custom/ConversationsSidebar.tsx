import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {ScrollArea} from '@/components/ui/scroll-area';
import type {ConversationSimplified} from '@/types/Conversation';
import {Plus, Search} from 'lucide-react';
import {useTranslations} from 'next-intl';

interface ConversationSidebarProps {
  conversations: ConversationSimplified[];
}

export function ConversationsSidebar({
  conversations,
}: ConversationSidebarProps) {
  const t = useTranslations('conversation-sidebar');

  return (
    <div className="w-80 border-r">
      <div className="space-y-4 p-4">
        <h2 className="text-xl font-semibold">{t('title')}</h2>
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
                <span className="truncate font-normal">
                  {conversation.title}
                </span>
              </Button>
            ))}
            <Button className="w-full">
              <Plus className="mr-1 h-4 w-4" />
              {t('newConversation')}
            </Button>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
