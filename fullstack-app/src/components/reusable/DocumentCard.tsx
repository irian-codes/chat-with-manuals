import {Button} from '@/components/ui/button';
import {Card, CardContent} from '@/components/ui/card';
import type {Document} from '@/types/Document';
import {type UploadingDocument} from '@/types/UploadingDocument';
import {FilePenLine, X} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import Image from 'next/image';

type DocumentCardProps = {
  doc: Document | UploadingDocument;
  onCancelButtonClick?: (ev: React.MouseEvent<HTMLButtonElement>) => void;
  onEditButtonClick?: (ev: React.MouseEvent<HTMLButtonElement>) => void;
};

export function DocumentCard(props: DocumentCardProps) {
  const t = useTranslations('document-manager');
  const format = useFormatter();

  return (
    <Card className="max-w-[14rem]">
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
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="min-h-[4rem]">
              <h3 className="line-clamp-1 font-medium">{props.doc.title}</h3>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {'isUploading' in props.doc && props.doc.isUploading
                  ? format.relativeTime(new Date(props.doc.date), Date.now())
                  : format.dateTime(new Date(props.doc.date), 'full')}
              </p>
            </div>
            {'isUploading' in props.doc && props.doc.isUploading ? (
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
        </div>
      </CardContent>
    </Card>
  );
}
