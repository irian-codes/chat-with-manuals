import {Button} from '@/components/shadcn-ui/button';
import {Textarea} from '@/components/shadcn-ui/textarea';
import {type Message} from '@/types/Message';
import {isStringEmpty} from '@/utils/strings';
import {AUTHOR} from '@prisma/client';
import {Pencil, Send, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useState} from 'react';

interface ChatMessageProps {
  message: Message;
  isLoading: boolean;
  onMessageEditSave: (messageId: string, content: string) => Promise<void>;
  formatDate: (date: Date) => string;
}

function UserMessage(props: ChatMessageProps) {
  const t = useTranslations('conversation');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(props.message.content);

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(props.message.content);
  };

  const handleSaveEdit = () => {
    if (isStringEmpty(editContent)) {
      handleCancelEdit();
      return;
    }

    void props.onMessageEditSave(props.message.id, editContent.trim());
    setIsEditing(false);
  };

  return (
    <div className="group relative max-w-[70%] rounded-md bg-primary p-4 text-primary-foreground">
      {!props.isLoading && !isEditing && (
        <div className="absolute -left-12 top-5 hidden rounded-full bg-muted p-2 text-muted-foreground group-hover:block">
          <Pencil className="h-4 w-4" />
        </div>
      )}

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void handleSaveEdit();
              } else if (e.key === 'Escape') {
                handleCancelEdit();
              }
            }}
            className="min-h-[100px] resize-none bg-background text-primary"
            disabled={props.isLoading}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancelEdit}
              disabled={props.isLoading}
            >
              <X className="h-4 w-4" />
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void handleSaveEdit()}
              disabled={props.isLoading}
            >
              <Send className="h-4 w-4" />
              {t('save')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="cursor-pointer" onClick={() => setIsEditing(true)}>
          <p>{props.message.content}</p>
          <p className="mt-2 text-xs opacity-70">
            {props.formatDate(new Date(props.message.updatedAt))}
          </p>
        </div>
      )}
    </div>
  );
}

function AIMessage({message, formatDate}: ChatMessageProps) {
  return (
    <div className="max-w-[70%] rounded-md bg-muted p-4">
      <p>{message.content}</p>
      <p className="mt-2 text-xs opacity-70">
        {formatDate(new Date(message.updatedAt))}
      </p>
    </div>
  );
}

export function ChatMessage(props: ChatMessageProps) {
  const {message} = props;

  return (
    <div
      className={`flex ${message.author === AUTHOR.AI ? 'justify-start' : 'justify-end'}`}
    >
      {message.author === AUTHOR.AI ? (
        <AIMessage {...props} />
      ) : (
        <UserMessage {...props} />
      )}
    </div>
  );
}
