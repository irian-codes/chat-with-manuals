import {Header} from '@/components/reusable/Header';
import {Button} from '@/components/shadcn-ui/button';
import {ScrollArea} from '@/components/shadcn-ui/scroll-area';
import {Textarea} from '@/components/shadcn-ui/textarea';
import {useIsMacOs, useIsTouchDevice} from '@/hooks/os-utils';
import {api} from '@/utils/api';
import {AlertTriangle, Send} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import {useRouter} from 'next/router';
import {useEffect, useRef, useState} from 'react';

export function ConversationMain() {
  const t = useTranslations('conversation');
  const format = useFormatter();
  const [messageInput, setMessageInput] = useState('');
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isTouchDevice = useIsTouchDevice();
  const isMacOs = useIsMacOs();
  const router = useRouter();
  const conversationQuery = api.conversations.getConversation.useQuery({
    id: router.query.id as string,
  });
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
  const isLoading =
    sendMessageMutation.isPending || conversationQuery.isPending;
  const conversation = conversationQuery.data!;
  const messages = conversation.messages ?? [];

  useEffect(() => {
    // Focus the input when the loading state changes
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading, inputRef]);

  useEffect(() => {
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
          conversationId: conversation.id,
          message: _inputMessage,
        });
      } catch (error) {
        console.error('Could not send message', error);
        setMessageInput(_inputMessage);
        return;
      }

      await conversationQuery.refetch();
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <Header>
        <h1 className="text-2xl font-semibold">
          {t('title', {
            documentTitle: conversation.document.title,
          })}
        </h1>
      </Header>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {(sendMessageMutation.isPending
            ? [
                ...messages,
                // Optimistic update message
                {
                  id: String(messages.length + 1),
                  // TODO: Replace with actual user ID
                  author: 'userId',
                  content: sendMessageMutation.variables?.message,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ]
            : messages
          ).map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.author === 'ai' ? 'justify-start' : 'justify-end'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-md p-4 ${
                  message.author === 'ai'
                    ? 'bg-muted'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                <p>{message.content}</p>
                <p className="mt-2 text-xs opacity-70">
                  {format.dateTime(new Date(message.updatedAt), 'full')}
                </p>
              </div>
            </div>
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

          <div className="invisible h-[1px] w-full" ref={scrollAnchorRef} />
        </div>
      </ScrollArea>

      <footer className="border-t p-4">
        <div className="mx-auto flex min-w-[250px] max-w-[750px] flex-col gap-2 lg:w-[calc(100%-12rem)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
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
            {t('language-alert', {
              language: conversationQuery.data?.document.languageCode,
            })}
          </p>
        </div>
      </footer>
    </div>
  );
}
