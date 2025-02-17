import {Button} from '@/components/shadcn-ui/button';
import {Textarea} from '@/components/shadcn-ui/textarea';
import {type Message} from '@/types/Message';
import {isStringEmpty} from '@/utils/strings';
import {AUTHOR} from '@prisma/client';
import {Pencil, Send, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {type ClassAttributes, type HTMLAttributes, useState} from 'react';
import Markdown, {type ExtraProps} from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
    <div className="user-message group bg-primary text-primary-foreground relative max-w-[70%] rounded-md p-4">
      {!props.isLoading && !isEditing && (
        <div className="bg-muted text-muted-foreground absolute top-5 -left-12 hidden rounded-full p-2 group-hover:block">
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
            className="bg-background text-primary min-h-[100px] resize-none"
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
  function NonSemanticHeading(
    props: ClassAttributes<HTMLHeadingElement> &
      HTMLAttributes<HTMLHeadingElement> &
      ExtraProps
  ) {
    const {node, ...rest} = props;
    return <div className="my-2 text-xl font-bold" {...rest} />;
  }

  function ListWithBullets(
    props: ClassAttributes<HTMLUListElement> &
      HTMLAttributes<HTMLUListElement> &
      ExtraProps
  ) {
    const {node, ...rest} = props;
    return <ul className="list-disc pl-5" {...rest} />;
  }

  function ListWithNumbers(
    props: ClassAttributes<HTMLOListElement> &
      HTMLAttributes<HTMLOListElement> &
      ExtraProps
  ) {
    const {node, ...rest} = props;
    return <ol className="list-decimal pl-5" {...rest} />;
  }

  function InlineCodeBlock(
    props: ClassAttributes<HTMLElement> &
      HTMLAttributes<HTMLElement> &
      ExtraProps
  ) {
    const {node, ...rest} = props;
    return <code className="block py-2 pl-2 text-purple-900" {...rest} />;
  }

  function BlockCodeBlock(
    props: ClassAttributes<HTMLPreElement> &
      HTMLAttributes<HTMLPreElement> &
      ExtraProps
  ) {
    const {node, ...rest} = props;
    return <pre className="block py-2 pl-2 text-purple-900" {...rest} />;
  }

  function Blockquote(
    props: ClassAttributes<HTMLQuoteElement> &
      HTMLAttributes<HTMLQuoteElement> &
      ExtraProps
  ) {
    const {node, ...rest} = props;
    return (
      <blockquote
        className="border-muted-foreground my-2 ml-4 border-l-2 pl-2 italic"
        {...rest}
      />
    );
  }

  function Link(
    props: ClassAttributes<HTMLAnchorElement> &
      HTMLAttributes<HTMLAnchorElement> &
      ExtraProps
  ) {
    const {node, ...rest} = props;
    return (
      <a
        target="_blank"
        rel="noopener noreferrer nofollow external"
        className="text-blue-500 underline-offset-4 hover:italic hover:underline"
        {...rest}
      />
    );
  }

  function Table(
    props: ClassAttributes<HTMLTableElement> &
      HTMLAttributes<HTMLTableElement> &
      ExtraProps
  ) {
    const {node, ...rest} = props;
    return <table className="table-auto" {...rest} />;
  }

  function TableHeader(
    props: ClassAttributes<HTMLTableCellElement> &
      HTMLAttributes<HTMLTableCellElement> &
      ExtraProps
  ) {
    const {node, ...rest} = props;

    delete rest.style;

    return (
      <th className="border-muted-foreground border px-2 text-left" {...rest} />
    );
  }

  function TableData(
    props: ClassAttributes<HTMLTableCellElement> &
      HTMLAttributes<HTMLTableCellElement> &
      ExtraProps
  ) {
    const {node, ...rest} = props;

    delete rest.style;

    return (
      <td className="border-muted-foreground border px-2 text-left" {...rest} />
    );
  }

  return (
    <div className="ai-message bg-muted max-w-[70%] rounded-md p-4">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          ul: ListWithBullets,
          ol: ListWithNumbers,
          h1: NonSemanticHeading,
          h2: NonSemanticHeading,
          h3: NonSemanticHeading,
          h4: NonSemanticHeading,
          h5: NonSemanticHeading,
          h6: NonSemanticHeading,
          code: InlineCodeBlock,
          pre: BlockCodeBlock,
          blockquote: Blockquote,
          a: Link,
          table: Table,
          th: TableHeader,
          td: TableData,
        }}
      >
        {message.content}
      </Markdown>
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
