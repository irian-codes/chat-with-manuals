import {Button} from '@/components/shadcn-ui/button';
import {Input} from '@/components/shadcn-ui/input';
import type {Conversation} from '@/types/Conversation';
import {isStringEmpty} from '@/utils/strings';
import {Check, Pencil, Trash2, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {Fragment, useState} from 'react';

interface ConversationListItemProps {
  conversation: Conversation;
  isHighlighted?: boolean;
  onEdit: (newTitle: string) => Promise<string>;
  onDelete: () => Promise<void>;
  onPreview: () => void;
  isLoading: boolean;
}

export function ConversationListItem(props: ConversationListItemProps) {
  const t = useTranslations('sidebar.conversations');
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(props.conversation.title);

  return (
    <div className="flex flex-row items-center justify-between gap-2">
      {isEditing ? (
        <Input
          className="w-full flex-grow overflow-hidden text-left focus-visible:ring-0"
          value={newTitle}
          onChange={(ev) => setNewTitle(ev.target.value)}
          autoFocus
          onKeyDown={async (ev) => {
            if (ev.key === 'Enter') {
              const _newTitle = await props.onEdit(newTitle);
              setNewTitle(_newTitle);
              setIsEditing(false);
            }

            if (ev.key === 'Escape') {
              setIsEditing(false);
              setNewTitle(props.conversation.title);
            }
          }}
          disabled={props.isLoading}
        />
      ) : (
        <Link
          href={`/conversation/${props.conversation.id}`}
          className="flex-grow overflow-hidden"
          prefetch={false}
          onMouseEnter={props.onPreview}
          onFocus={props.onPreview}
        >
          <Button
            variant={props.isHighlighted ? 'default' : 'ghost'}
            className="w-full justify-start"
            disabled={props.isLoading || isEditing}
          >
            <p className="w-full truncate text-left font-normal">
              {isStringEmpty(props.conversation.title)
                ? t('conversation-title-missing')
                : props.conversation.title}
            </p>
          </Button>
        </Link>
      )}

      {isEditing ? (
        <Fragment>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={async () => {
              const _newTitle = await props.onEdit(newTitle);
              setNewTitle(_newTitle);
              setIsEditing(false);
            }}
            disabled={props.isLoading}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={() => {
              setIsEditing(false);
              setNewTitle(props.conversation.title);
            }}
            disabled={props.isLoading}
          >
            <X className="h-4 w-4" />
          </Button>
        </Fragment>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={() => setIsEditing(true)}
          disabled={props.isLoading}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0"
        onClick={async () => {
          if (
            window.confirm(
              t('deleteConversationConfirmation', {
                title: props.conversation.title,
              })
            )
          ) {
            await props.onDelete();
          }
        }}
        disabled={props.isLoading || isEditing}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
