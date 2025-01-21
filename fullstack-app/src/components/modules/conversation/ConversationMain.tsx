import {Header} from '@/components/reusable/Header';
import {Button} from '@/components/shadcn-ui/button';
import {ScrollArea} from '@/components/shadcn-ui/scroll-area';
import {Textarea} from '@/components/shadcn-ui/textarea';
import {useIsMacOs, useIsTouchDevice} from '@/hooks/os-utils';
import {type Message} from '@/types/Message';
import {api} from '@/utils/api';
import {isStringEmpty} from '@/utils/strings';
import {AUTHOR} from '@prisma/client';
import {AlertTriangle, Send} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import {useRouter} from 'next/router';
import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {ChatMessage} from './ChatMessage';

export function ConversationMain() {
  const t = useTranslations('conversation');
  const format = useFormatter();
  const [messageInput, setMessageInput] = useState('');
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isTouchDevice = useIsTouchDevice();
  const isMacOs = useIsMacOs();
  const router = useRouter();
  const conversationQuery = api.conversations.getConversation.useQuery(
    {
      id: router.query.id as string,
    },
    {enabled: router.query.id != null}
  );
  const utils = api.useUtils();
  const sendMessageMutation = api.conversations.sendMessage.useMutation({
    // New way of Tanstack Query of doing optimistic updates
    // @see https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates
    onSettled: async () => {
      return await utils.conversations.getConversation.invalidate({
        id: conversationQuery.data?.id ?? '',
      });
    },
  });

  const editMessageMutation = api.conversations.editMessage.useMutation({
    onSuccess: async () => {
      return await utils.conversations.getConversation.invalidate({
        id: conversationQuery.data?.id ?? '',
      });
    },
  });

  const isLoading =
    sendMessageMutation.isPending ||
    conversationQuery.isPending ||
    editMessageMutation.isPending;

  const conversation = conversationQuery.data;
  const messages = conversation?.messages ?? [];

  const generateTitleMutation = api.conversations.generateTitle.useMutation({
    onSuccess: async () => {
      void utils.conversations.getConversation.invalidate({
        id: conversationQuery.data?.id ?? '',
      });
      void utils.conversations.getConversations.invalidate();
    },
  });

  useEffect(() => {
    // Focus the input when the loading state changes
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading, inputRef]);

  useLayoutEffect(() => {
    setTimeout(() => {
      scrollAnchorRef.current?.scrollIntoView({behavior: 'instant'});
    }, 150);
  }, []);

  useLayoutEffect(() => {
    // Scroll to the bottom of the conversation when a new message is added
    scrollAnchorRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [
    sendMessageMutation.variables?.message,
    messages.length,
    scrollAnchorRef,
  ]);

  async function handleSendMessage() {
    const _inputMessage = messageInput.trim();

    if (_inputMessage) {
      setMessageInput('');

      try {
        await sendMessageMutation.mutateAsync({
          conversationId: conversation!.id,
          message: _inputMessage,
        });
      } catch (error) {
        console.error('Could not send message', error);
        setMessageInput(_inputMessage);
      }

      // Generate title if this is the first message
      if (messages.length === 0) {
        generateTitleMutation.mutate({
          conversationId: conversation!.id,
        });
      }
    }
  }

  async function handleSaveMsgEdit(messageId: string, content: string) {
    if (isStringEmpty(content)) {
      return;
    }

    const _content = content.trim();

    const editedMessage = conversation!.messages.find(
      (message) => message.id === messageId
    );

    if (editedMessage == null) {
      return;
    }

    editedMessage.content = _content;
    editedMessage.updatedAt = new Date();

    // Update the conversation in the cache to reflect the edited message immediately
    utils.conversations.getConversation.setData(
      {id: conversation!.id},
      (oldData) => {
        if (oldData == null) return oldData;

        return {
          ...oldData,
          messages: oldData.messages
            .filter((msg) => msg.createdAt <= editedMessage.createdAt)
            .map((msg) => (msg.id === messageId ? {...editedMessage} : msg)),
        };
      }
    );

    try {
      await editMessageMutation.mutateAsync({
        messageId,
        content: _content,
      });
    } catch (error) {
      console.error('Could not edit message', error);
    }
  }

  // RENDERING

  if (conversation == null) {
    if (typeof window !== 'undefined') {
      return router.push('/404');
    } else {
      return null;
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <Header>
        <h1 className="line-clamp-2 text-2xl font-semibold">
          {t('title', {
            title: conversation.title,
          })}
        </h1>
      </Header>

      <ScrollArea className="flex-1 p-4">
        {messages.length > 0 || sendMessageMutation.isPending ? (
          <div className="space-y-4">
            {(sendMessageMutation.isPending
              ? ([
                  ...messages,
                  // Optimistic update message
                  {
                    id: crypto.randomUUID(),
                    conversationId: conversation.id,
                    author: AUTHOR.USER,
                    content: sendMessageMutation.variables?.message ?? '',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                ] satisfies Message[])
              : messages
            ).map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isLoading={isLoading}
                onMessageEditSave={handleSaveMsgEdit}
                formatDate={(date) => format.dateTime(date, 'full')}
              />
            ))}

            {/* Loading animation */}
            {isLoading && (
              <div className="w-24">
                <div className="rounded-md bg-muted p-4">
                  <div className="flex items-center justify-evenly gap-2">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary"></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary delay-150"></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-primary delay-300"></div>
                  </div>
                </div>
              </div>
            )}

            <div
              className="invisible h-[1px] w-full pt-6 sm:pt-4 md:pt-0"
              ref={scrollAnchorRef}
            />
          </div>
        ) : (
          <div className="flex flex-row items-start justify-around gap-2 pr-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-6 w-6 flex-shrink-0" />
            <div>
              <p>
                {t('language-alert', {
                  locale: conversationQuery.data.documents[0]!.locale,
                })}
              </p>
              <br />
              <p>{t('hallucination-alert')}</p>
            </div>
          </div>
        )}
      </ScrollArea>

      <footer className="border-t p-4">
        <div className="mx-auto flex min-w-[250px] max-w-[750px] flex-col gap-2 lg:w-[calc(100%-12rem)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (isLoading) return;
              void handleSendMessage();
            }}
            className="flex items-start space-x-2"
          >
            <Textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={t('input-placeholder')}
              className="flex-1 resize-none"
              disabled={isLoading}
              autoFocus
              ref={inputRef}
              draggable={false}
              onKeyDown={(e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                  void handleSendMessage();
                }
              }}
            />
            <div className="flex flex-col items-center justify-center gap-1">
              <Button type="submit" disabled={isLoading}>
                <Send className="mr-2 h-4 w-4" />
                {t('send')}
              </Button>
              {!isTouchDevice && (
                <div className="text-sm">
                  {isMacOs ? '⌘ + Enter' : 'Ctrl + Enter'}
                </div>
              )}
            </div>
          </form>
          <p className="flex items-center justify-start gap-2 pr-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-6 w-6" />{' '}
            {t('language-alert-brief', {
              locale: conversationQuery.data.documents[0]!.locale,
            })}
          </p>
        </div>
      </footer>
    </div>
  );
}
