import {type RouterOutputs} from '@/utils/api';

export type UploadingDocument =
  RouterOutputs['documents']['getDocumentsIncludingPending']['pendingDocuments'][number];
