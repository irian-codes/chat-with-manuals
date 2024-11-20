import type {Document} from '@/types/Document';

export type UploadingDocument = Document & {
  isUploading: boolean;
};
