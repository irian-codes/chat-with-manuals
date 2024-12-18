import {type RouterOutputs} from '@/utils/api';

export type Message =
  RouterOutputs['conversations']['getConversation']['messages'][number];
