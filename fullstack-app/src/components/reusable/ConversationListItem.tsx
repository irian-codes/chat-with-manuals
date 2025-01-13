import {Button} from '@/components/shadcn-ui/button';
import type {Conversation} from '@/types/Conversation';
import {isStringEmpty} from '@/utils/strings';
import {Check, Pencil, Trash2, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {Fragment, useState} from 'react';
import {Input} from '../shadcn-ui/input';

interface ConversationListItemProps {
  conversation: Conversation;
  onEdit: (newTitle: string) => Promise<string>;
  onDelete: () => Promise<void>;
  onPreview: () => void;
  isLoading: boolean;
}

export function ConversationListItem(props: ConversationListItemProps) {
  const t = useTranslations('conversation-sidebar');
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(props.conversation.title);

  return (
    <div className="flex flex-row items-center justify-between gap-2">
      {isEditing ? (
        <Input
          className="w-full overflow-hidden text-left focus-visible:ring-0"
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
        <Button
          variant="ghost"
          className="flex-1 justify-start overflow-hidden"
          disabled={props.isLoading || isEditing}
        >
          <Link
            href={`/conversation/${props.conversation.id}`}
            className="w-full truncate text-left"
            prefetch={false}
            onMouseEnter={props.onPreview}
            onFocus={props.onPreview}
          >
            <span className="font-normal">
              {isStringEmpty(props.conversation.title)
                ? t('conversation-title-missing')
                : props.conversation.title}
            </span>
          </Link>
        </Button>
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
