import {type RouterOutputs} from '@/utils/api';

export type Conversation =
  RouterOutputs['conversations']['getConversations'][number];
