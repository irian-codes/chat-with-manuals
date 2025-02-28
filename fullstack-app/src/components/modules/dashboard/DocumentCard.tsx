import {Button} from '@/components/shadcn-ui/button';
import {Card, CardContent} from '@/components/shadcn-ui/card';
import type {Document} from '@/types/Document';
import {type UploadingDocument} from '@/types/UploadingDocument';
import {isStringEmpty} from '@/utils/strings';
import {cn} from '@/utils/ui/utils';
import {FilePenLine, MessageSquarePlus, X} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import Image from 'next/image';

type UploadingDocumentCardProps = {
  doc: UploadingDocument;
  onCancelButtonClick: (ev: React.MouseEvent<HTMLButtonElement>) => void;
};

type UploadedDocumentCardProps = {
  doc: Document;
  onUpdateButtonClick: (ev: React.MouseEvent<HTMLButtonElement>) => void;
  onUpdateDocumentPreview?: (
    ev:
      | React.MouseEvent<HTMLButtonElement>
      | React.FocusEvent<HTMLButtonElement>,
    document: Document
  ) => void;
  onNewConversationButtonClick: (
    ev: React.MouseEvent<HTMLButtonElement>
  ) => void;
};

type DocumentCardProps = {isLoading?: boolean} & (
  | UploadingDocumentCardProps
  | UploadedDocumentCardProps
);

export function DocumentCard(props: DocumentCardProps) {
  const t = useTranslations('document-manager');
  const format = useFormatter();
  const docIsUploading = 'onCancelButtonClick' in props;
  const imageUrl = isStringEmpty(props.doc.imageUrl)
    ? 'public/default-doc-image.jpg'
    : props.doc.imageUrl;

  return (
    <Card className={cn('max-w-[16rem]', docIsUploading && 'animate-pulse')}>
      <CardContent className="p-0">
        <Image
          src={imageUrl}
          // We are optimizing the images ourselves because the image may
          // not be in the public folder at compile time, and thus Next.js
          // cannot retrieve it if it's passed as a relative url.
          loader={({src, width, quality}) =>
            `/api/serveImage?url=${src}&w=${width}&q=${quality ?? 75}`
          }
          alt={t('image-alt')}
          className="aspect-4/3 rounded-t-xl object-contain md:aspect-1/1"
          width={400}
          height={400}
          placeholder="blur"
          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mO8Ww8AAj8BXkQ+xPEAAAAASUVORK5CYII="
          loading="lazy"
          decoding="async"
          fetchPriority="auto"
          referrerPolicy="no-referrer"
        />
        <div className={'p-4'}>
          <div className="grid grid-cols-4 grid-rows-2 place-items-center gap-1">
            <h3 className="col-span-3 line-clamp-1 justify-self-start font-medium">
              {props.doc.title}
            </h3>
            <p className="text-muted-foreground col-span-3 col-start-1 row-start-2 line-clamp-2 justify-self-start text-sm">
              {docIsUploading
                ? format.relativeTime(props.doc.createdAt, Date.now())
                : format.dateTime(props.doc.createdAt, 'full')}
            </p>

            <Button
              variant="outline"
              size="icon"
              className="col-start-4 row-start-1"
              disabled={props.isLoading}
              onClick={
                docIsUploading
                  ? props.onCancelButtonClick
                  : props.onUpdateButtonClick
              }
              onMouseEnter={(ev) => {
                // Prefetching for the edit modal
                if ('onUpdateDocumentPreview' in props) {
                  props.onUpdateDocumentPreview?.(ev, props.doc);
                }
              }}
              onFocus={(ev) => {
                // Prefetching for the edit modal
                if ('onUpdateDocumentPreview' in props) {
                  props.onUpdateDocumentPreview?.(ev, props.doc);
                }
              }}
            >
              {docIsUploading ? (
                <X className="h-4 w-4" />
              ) : (
                <FilePenLine className="h-4 w-4" />
              )}
            </Button>
            {!docIsUploading && (
              <Button
                variant="outline"
                size="icon"
                className="col-start-4 row-start-2"
                disabled={props.isLoading}
                onClick={props.onNewConversationButtonClick}
              >
                <MessageSquarePlus size={32} />
              </Button>
            )}
          </div>
          {docIsUploading && (
            <div className="pb-2 text-sm font-semibold">
              {t('uploading-document')}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
