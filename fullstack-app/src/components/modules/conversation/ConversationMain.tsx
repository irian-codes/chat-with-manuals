import {Header} from '@/components/reusable/Header';
import {InfiniteScrollAnchor} from '@/components/reusable/InfiniteScrollAnchor';
import {ScrollArea} from '@/components/shadcn-ui/scroll-area';
import {type Message} from '@/types/Message';
import {api} from '@/utils/api';
import {isStringEmpty} from '@/utils/strings';
import {AUTHOR} from '@prisma/client';
import {AlertTriangle, Loader2} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import {useRouter} from 'next/router';
import {useCallback, useEffect, useRef} from 'react';
import {useIsomorphicLayoutEffect} from 'usehooks-ts';
import {z} from 'zod';
import {ChatMessage} from './ChatMessage';
import {ChatMessageInput} from './ChatMessageInput';
import {ChatMessageLoadAnimation} from './ChatMessageLoadAnimation';

// TODO #54: This should be a default setting in the database and load it on a global app settings.
export const DEFAULT_MESSAGES_LIMIT = 8;

export function ConversationMain() {
  const t = useTranslations('conversation');
  const format = useFormatter();
  const scrollTopAnchorRef = useRef<HTMLDivElement>(null);
  const scrollBottomAnchorRef = useRef<HTMLDivElement>(null);
  const msgInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesListUpdateReasonRef = useRef<'edit' | 'send' | 'scroll' | null>(
    null
  );
  const router = useRouter();
  const utils = api.useUtils();

  const conversationQuery = api.conversations.getConversation.useQuery(
    {
      id: router.query.id as string,
      withDocuments: true,
      withMessages: false,
    },
    {
      enabled: router.query.id != null,
    }
  );

  const messagesQuery =
    api.conversations.getConversationMessages.useInfiniteQuery(
      {
        conversationId: router.query.id as string,
        limit: DEFAULT_MESSAGES_LIMIT,
      },
      {
        enabled: router.query.id != null,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        // Getting the messages correctly ordered, since each page now gets prepended in the array, as a chat is inverse order.
        select(data) {
          const messages: Message[] = [];

          (data?.pages ?? []).forEach((page) =>
            messages.unshift(...page.messages)
          );

          return messages;
        },
      }
    );

  const conversation = conversationQuery.data;
  const messages = messagesQuery.data ?? [];

  const sendMessageMutation = api.conversations.sendMessage.useMutation({
    onMutate: async (newPayload) => {
      // Cancel any outgoing refetches
      await utils.conversations.getConversationMessages.cancel({
        conversationId: newPayload.conversationId,
        limit: DEFAULT_MESSAGES_LIMIT,
      });

      // Snapshot the previous value in case we have an error and we need to rollback
      const previousReturnPayload =
        utils.conversations.getConversationMessages.getInfiniteData({
          conversationId: newPayload.conversationId,
          limit: DEFAULT_MESSAGES_LIMIT,
        });

      // Optimistically update messages
      utils.conversations.getConversationMessages.setInfiniteData(
        {
          conversationId: newPayload.conversationId,
          limit: DEFAULT_MESSAGES_LIMIT,
        },
        (oldData) => {
          if (!oldData) return oldData;

          const optimisticMessage = {
            id: crypto.randomUUID(),
            conversationId: newPayload.conversationId,
            author: AUTHOR.USER,
            content: newPayload.message,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const newPages = oldData.pages.slice();

          if (newPages[0]?.messages) {
            newPages[0].messages = [...newPages[0].messages, optimisticMessage];
          }

          return {
            ...oldData,
            pages: newPages,
          };
        }
      );

      messagesListUpdateReasonRef.current = 'send';

      // Return a context with the previous messages
      return {previousReturnPayload};
    },
    onError: (err, newPayload, context) => {
      // If the mutation fails, roll back to the previous value
      if (context?.previousReturnPayload) {
        utils.conversations.getConversationMessages.setInfiniteData(
          {
            conversationId: newPayload.conversationId,
            limit: DEFAULT_MESSAGES_LIMIT,
          },
          context.previousReturnPayload
        );
      }
    },
    onSettled: async () => {
      // Always refetch after error or success
      await utils.conversations.getConversationMessages.invalidate();

      messagesListUpdateReasonRef.current = 'send';
    },
  });

  const editMessageMutation = api.conversations.editMessage.useMutation({
    onMutate: async (newPayload) => {
      if (!conversation?.id) return;

      // Cancel any outgoing refetches
      await utils.conversations.getConversationMessages.cancel({
        conversationId: conversation.id,
        limit: DEFAULT_MESSAGES_LIMIT,
      });

      // Snapshot the previous value in case we have an error and we need to rollback
      const previousReturnPayload =
        utils.conversations.getConversationMessages.getInfiniteData({
          conversationId: conversation.id,
          limit: DEFAULT_MESSAGES_LIMIT,
        });

      const editedMessage = messages.find(
        (message) => message.id === newPayload.messageId
      );

      if (editedMessage == null) {
        return;
      }

      // Optimistically update messages
      utils.conversations.getConversationMessages.setInfiniteData(
        {conversationId: conversation.id, limit: DEFAULT_MESSAGES_LIMIT},
        (oldData) => {
          if (!oldData || oldData.pages.length === 0) return oldData;

          const newPages = oldData.pages.slice();

          // Filter out messages that come after the edited message
          newPages.forEach((page) => {
            page.messages = page.messages.filter(
              (msg) => msg.createdAt <= editedMessage.createdAt
            );
          });

          // Update the edited message
          const lastPage = newPages[newPages.length - 1]!;
          const lastMessage = lastPage.messages[lastPage.messages.length - 1]!;

          if (lastMessage.id !== newPayload.messageId) {
            return oldData;
          }

          lastMessage.content = newPayload.content;
          lastMessage.updatedAt = new Date();

          return {
            ...oldData,
            pages: newPages,
          };
        }
      );

      messagesListUpdateReasonRef.current = 'edit';

      // Return a context with the previous messages
      return {previousReturnPayload};
    },
    onError: (err, newPayload, context) => {
      // If the mutation fails, roll back to the previous value
      if (context?.previousReturnPayload && conversation?.id) {
        utils.conversations.getConversationMessages.setInfiniteData(
          {
            conversationId: conversation.id,
            limit: DEFAULT_MESSAGES_LIMIT,
          },
          context.previousReturnPayload
        );
      }
    },
    onSettled: async () => {
      // Always refetch after error or success
      await utils.conversations.getConversationMessages.invalidate();

      messagesListUpdateReasonRef.current = 'edit';
    },
  });

  const isLoadingMessages = messagesQuery.isFetching;

  const isLoading =
    sendMessageMutation.isPending ||
    conversationQuery.isPending ||
    editMessageMutation.isPending ||
    messagesQuery.isPending;

  const generateTitleMutation = api.conversations.generateTitle.useMutation({
    onSuccess: async () => {
      if (conversation?.id) {
        await utils.conversations.getConversation.invalidate();
        void utils.conversations.getConversations.invalidate();
      }
    },
  });

  useEffect(() => {
    // Focus the input when the loading state changes
    if (!isLoading) {
      msgInputRef.current?.focus();
    }
  }, [isLoading]);

  // Scroll to the corresponding anchor when messages list changes, even on first page load
  useIsomorphicLayoutEffect(() => {
    const anchor =
      messagesListUpdateReasonRef.current === 'scroll'
        ? scrollTopAnchorRef
        : scrollBottomAnchorRef;

    setTimeout(() => {
      anchor.current?.scrollIntoView({behavior: 'smooth'});
    }, 300);

    messagesListUpdateReasonRef.current = null;
  }, [messages.length]);

  async function handleSendMessage(inputMessage: string) {
    const _inputMessage = z.string().trim().parse(inputMessage);

    if (_inputMessage) {
      msgInputRef.current?.form?.reset();

      try {
        await sendMessageMutation.mutateAsync({
          conversationId: conversation!.id,
          message: _inputMessage,
        });
      } catch (error) {
        console.error('Could not send message', error);

        if (msgInputRef.current) {
          msgInputRef.current.value = _inputMessage;
        }
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

    try {
      await editMessageMutation.mutateAsync({
        messageId,
        content: content.trim(),
      });
    } catch (error) {
      console.error('Could not edit message', error);
    }
  }

  // Memoize the onChange callback
  const handleIntersectionChange = useCallback(
    async (isIntersecting: boolean, entry: IntersectionObserverEntry) => {
      if (isIntersecting) {
        await messagesQuery.fetchNextPage();
        messagesListUpdateReasonRef.current = 'scroll';
      }
    },
    []
  );

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
        {messages.length > 0 ? (
          <div className="space-y-4">
            <InfiniteScrollAnchor
              hasMoreItems={messagesQuery.hasNextPage}
              isLoading={isLoadingMessages}
              runOnClientOnly
              observerOptions={{
                threshold: 0.5,
                initialIsIntersecting: false,
              }}
              memoizedOnChange={handleIntersectionChange}
              debounceInMs={1_000}
            >
              {messagesQuery.hasNextPage && (
                <Loader2 className="mx-auto mb-2 mt-4 h-8 w-8 animate-spin" />
              )}
            </InfiniteScrollAnchor>

            <div
              className="invisible h-[1px] w-full pt-6 sm:pt-4"
              ref={scrollTopAnchorRef}
            />

            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isLoading={isLoading}
                onMessageEditSave={handleSaveMsgEdit}
                formatDate={(date) => format.dateTime(date, 'full')}
              />
            ))}

            {/* AI answer loading animation */}
            <ChatMessageLoadAnimation isLoading={isLoading} />

            <div
              className="invisible h-[1px] w-full pt-6 sm:pt-4 md:pt-0"
              ref={scrollBottomAnchorRef}
            />
          </div>
        ) : (
          <div className="flex flex-row items-start justify-around gap-2 pr-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-6 w-6 flex-shrink-0" />
            <div>
              <p>
                {t('language-alert', {
                  locale: conversation.documents[0]!.locale,
                })}
              </p>
              <br />
              <p>{t('hallucination-alert')}</p>
            </div>
          </div>
        )}
      </ScrollArea>

      <footer>
        <ChatMessageInput
          ref={msgInputRef}
          conversationLocale={conversation.documents[0]!.locale}
          onSubmit={(e) => {
            e.preventDefault();

            const inputMessage = msgInputRef.current?.value ?? '';
            void handleSendMessage(inputMessage);
          }}
          textAreaProps={{
            disabled: isLoading,
            autoFocus: true,
            draggable: false,
            onKeyDown: (e) => {
              if (e.ctrlKey && e.key === 'Enter') {
                const inputMessage = msgInputRef.current?.value ?? '';
                void handleSendMessage(inputMessage);
              }
            },
          }}
          sendButtonProps={{
            disabled: isLoading,
          }}
        />
      </footer>
    </div>
  );
}
