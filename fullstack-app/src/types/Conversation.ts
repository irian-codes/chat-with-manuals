import type {Document} from './Document';
import type {Message} from './Message';

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  document: Document;
}
export type ConversationSimplified = Omit<
  Conversation,
  'messages' | 'document'
>;
