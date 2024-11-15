import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {ScrollArea} from '@/components/ui/scroll-area';
import type {Conversation} from '@/types/Conversation';
import type {Message} from '@/types/Message';
import {AlertTriangle, Send} from 'lucide-react';
import {useFormatter} from 'next-intl';
import {useEffect, useRef, useState} from 'react';
import LanguageSwitcher from './custom/LanguageSwitcher';

interface ConversationProps {
  conversation: Conversation;
}

export default function Component({conversation}: ConversationProps) {
  const format = useFormatter();
  const [messages, setMessages] = useState<Message[]>(conversation.messages);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input when the loading state changes
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading, inputRef]);

  useEffect(() => {
    // Scroll to the bottom of the conversation when a new message is added
    scrollAnchorRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages, scrollAnchorRef]);

  function handleSendMessage() {
    if (inputMessage.trim()) {
      setIsLoading(true);

      const newMessage: Message = {
        id: String(messages.length + 1),
        author: 'userId',
        content: inputMessage.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setMessages([...messages, newMessage]);
      setInputMessage('');

      // Simulate AI response (replace with actual API call)
      setTimeout(() => {
        const aiResponse: Message = {
          id: String(messages.length + 2),
          author: 'ai',
          content: "Thank you for your message. I'm processing your request.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setMessages((prevMessages) => [...prevMessages, aiResponse]);
        setIsLoading(false);
      }, 1000);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b p-4">
        <h1 className="text-2xl font-semibold">Chat with AI</h1>
        <LanguageSwitcher />
      </header>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
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

      <footer className="flex flex-col gap-2 border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center space-x-2"
        >
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1"
            disabled={isLoading}
            autoFocus
            ref={inputRef}
          />
          <Button type="submit" disabled={isLoading}>
            <Send className="mr-2 h-4 w-4" />
            Send
          </Button>
        </form>
        {conversation.document && (
          <p className="flex items-center justify-start gap-2 pr-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-6 w-6" /> Please use{' '}
            {conversation.document.languageCode} in this conversation as the
            document is indexed in this language.
          </p>
        )}
      </footer>
    </div>
  );
}
