import {Button} from '@/components/shadcn-ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn-ui/dialog';
import {Input} from '@/components/shadcn-ui/input';
import {ScrollArea} from '@/components/shadcn-ui/scroll-area';
import type {Document} from '@/types/Document';
import {Search} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import {Fragment, useEffect, useState} from 'react';
import {useDebounceValue} from 'usehooks-ts';
import {UploadDocumentButton} from './UploadDocumentButton';

interface DocumentPickerModalProps {
  isOpen: boolean;
  documents: Document[];
  onClose?: () => void;
  onDocumentClick?: (document: Document) => void;
  onSearchQueryChangeDebounced?: (newSearchQuery: string) => void;
  onUploadDocumentButtonClick?: () => void;
  debounceTimeInMs?: number;
  isLoading?: boolean;
}

export function DocumentListPickerModal(props: DocumentPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebounceValue(
    searchQuery,
    props.debounceTimeInMs ?? 1000
  );
  const format = useFormatter();
  const t = useTranslations('document-list-picker-modal');

  useEffect(() => {
    props.onSearchQueryChangeDebounced?.(debouncedSearchQuery);
  }, [debouncedSearchQuery]);

  function DialogOuter({children}: {children: React.ReactNode}) {
    return (
      <Dialog
        open={props.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSearchQuery('');
            props.onClose?.();
          }
        }}
      >
        <DialogContent className="w-[90vw] max-w-2xl sm:w-full">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  if (props.documents.length === 0) {
    return (
      <DialogOuter>
        <div className="mt-4 flex flex-col items-start justify-center gap-8">
          <p>{t('no-documents-body')}</p>
          <UploadDocumentButton
            buttonProps={{
              onClick: props.onUploadDocumentButtonClick,
              className: 'self-center',
            }}
          />
        </div>
      </DialogOuter>
    );
  }

  return (
    <DialogOuter>
      <Fragment>
        {props.onSearchQueryChangeDebounced && (
          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input
              placeholder={t('search-placeholder')}
              className="pl-8"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
            />
          </div>
        )}

        <ScrollArea className="h-[400px]">
          <div className="flex flex-col items-start gap-2">
            {props.documents.map((doc) => (
              <Button
                key={doc.id}
                variant="outline"
                className="w-full justify-start py-8"
                onClick={() => {
                  if (props.isLoading) {
                    return;
                  }

                  props.onDocumentClick?.(doc);
                  props.onClose?.();
                }}
                disabled={props.isLoading}
              >
                <div className="flex flex-col items-start gap-1">
                  <p className="truncate font-medium">{doc.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {format.dateTime(doc.updatedAt, 'short')}
                  </p>
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </Fragment>
    </DialogOuter>
  );
}
