import {Button} from '@/components/shadcn-ui/button';
import {Card, CardContent} from '@/components/shadcn-ui/card';
import type {Document} from '@/types/Document';
import {type UploadingDocument} from '@/types/UploadingDocument';
import {cn} from '@/utils/ui/utils';
import {FilePenLine, X} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import Image from 'next/image';

type UploadingDocumentCardProps = {
  doc: UploadingDocument;
  onCancelButtonClick: (ev: React.MouseEvent<HTMLButtonElement>) => void;
};

type UploadedDocumentCardProps = {
  doc: Document;
  onEditButtonClick: (ev: React.MouseEvent<HTMLButtonElement>) => void;
};

type DocumentCardProps = UploadingDocumentCardProps | UploadedDocumentCardProps;

export function DocumentCard(props: DocumentCardProps) {
  const t = useTranslations('document-manager');
  const format = useFormatter();
  const docIsUploading = 'onCancelButtonClick' in props;

  return (
    <Card className={cn('max-w-[14rem]', docIsUploading && 'animate-pulse')}>
      <CardContent className="p-0">
        <Image
          src="https://picsum.photos/400"
          alt={t('image-alt')}
          className="aspect-[1/1] rounded-t-xl object-cover"
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
          <div className="flex items-start justify-between">
            <div className="min-h-[4rem]">
              <h3 className="line-clamp-1 font-medium">{props.doc.title}</h3>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {docIsUploading
                  ? format.relativeTime(props.doc.createdAt, Date.now())
                  : format.dateTime(props.doc.createdAt, 'full')}
              </p>
            </div>
            {docIsUploading ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={props.onCancelButtonClick}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={props.onEditButtonClick}
              >
                <FilePenLine className="h-4 w-4" />
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
