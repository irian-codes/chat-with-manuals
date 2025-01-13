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
import {useEffect, useState} from 'react';
import {useDebounce} from 'use-debounce';

interface DocumentPickerModalProps {
  isOpen: boolean;
  documents: Document[];
  onClose?: () => void;
  onDocumentClick?: (document: Document) => void;
  onSearchQueryChangeDebounced?: (newSearchQuery: string) => void;
  debounceTimeInMs?: number;
}

export function DocumentListPickerModal(props: DocumentPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebounce(
    searchQuery,
    props.debounceTimeInMs ?? 1000
  );
  const format = useFormatter();
  const t = useTranslations('document-list-picker-modal');

  useEffect(() => {
    props.onSearchQueryChangeDebounced?.(debouncedSearchQuery);
  }, [debouncedSearchQuery]);

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

        {props.onSearchQueryChangeDebounced && (
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
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
                  props.onDocumentClick?.(doc);
                  props.onClose?.();
                }}
              >
                <div className="flex flex-col items-start gap-1">
                  <p className="truncate font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format.dateTime(doc.updatedAt, 'short')}
                  </p>
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
