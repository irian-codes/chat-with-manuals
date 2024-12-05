import {Button} from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {ScrollArea} from '@/components/ui/scroll-area';
import type {Document} from '@/types/Document';
import {Search} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import Link from 'next/link';
import {useState} from 'react';

interface DocumentPickerModalProps {
  isOpen: boolean;
  documents: Document[];
  onClose?: () => void;
  onSelect?: (document: Document) => void;
  searchFunction?: (searchQuery: string) => Document[];
}

export function DocumentPickerModal(props: DocumentPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const format = useFormatter();
  const t = useTranslations('document-list-picker-modal');

  const filteredDocuments =
    props.searchFunction?.(searchQuery) ?? props.documents;

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

        {props.searchFunction && (
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('search-placeholder')}
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        <ScrollArea className="h-[400px]">
          <div className="flex flex-col items-start gap-2">
            {filteredDocuments.map((doc) => (
              // TODO: Replace with actual conversation creation
              <Link href={`/conversation`} key={doc.id} className="w-full">
                <Button
                  variant="outline"
                  className="w-full justify-start py-8"
                  onClick={() => {
                    props.onSelect?.(doc);
                    props.onClose?.();
                  }}
                >
                  <div className="flex flex-col items-start gap-1">
                    <p className="truncate font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format.dateTime(new Date(doc.date), 'short')}
                    </p>
                  </div>
                </Button>
              </Link>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
