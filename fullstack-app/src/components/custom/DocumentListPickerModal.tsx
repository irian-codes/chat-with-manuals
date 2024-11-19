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
import {useEffect, useState} from 'react';

interface DocumentPickerModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSelect?: (document: Document) => void;
}

export function DocumentPickerModal({
  isOpen,
  onClose,
  onSelect,
}: DocumentPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const format = useFormatter();
  const t = useTranslations('document-list-picker-modal');

  useEffect(() => {
    fetchDocuments().then(setDocuments).catch(console.error);
  }, []);

  async function fetchDocuments() {
    // TODO: Replace with actual API calls
    return mockDocuments;
  }

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-2xl"
        onPointerDownOutside={(ev) => {
          // Prevent the dialog from closing when clicking on the backdrop
          ev.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('search-placeholder')}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <ScrollArea className="h-[400px]">
          <div className="flex flex-col items-start gap-2">
            {filteredDocuments.map((doc) => (
              // TODO: Replace with actual conversation creation
              <Link href={`/conversation`} key={doc.id} className="w-full">
                <Button
                  variant="outline"
                  className="w-full justify-start py-8"
                  onClick={() => {
                    onSelect?.(doc);
                    onClose?.();
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

const mockDocuments: Document[] = [
  {
    id: '2',
    title: 'Business report',
    date: '2024-10-12T21:21:00.000Z',
    languageCode: 'en',
  },
  {
    id: '3',
    title: 'Bitcoin whitepaper',
    date: '2023-03-07T10:14:00.000Z',
    languageCode: 'en',
  },
  {
    id: '4',
    title: 'Savage Worlds RPG',
    date: '2022-11-23T00:20:54.000Z',
    languageCode: 'en',
  },
  {
    id: '5',
    title: 'Urban mobility report',
    date: '2022-10-05T02:08:00.000Z',
    languageCode: 'en',
  },
  {
    id: '6',
    title: 'Fridge manual model X459 fasd sdad fasd asdf asdf sa d',
    date: '2021-03-10T00:24:00Z',
    languageCode: 'en',
  },
  {
    id: '7',
    title: 'Car manual model Ferrari F8 Tributo',
    date: '2020-01-04T13:45:00Z',
    languageCode: 'en',
  },
  {
    id: '8',
    title: 'Annual Financial Overview 2023',
    date: '2023-12-15T09:00:00.000Z',
    languageCode: 'en',
  },
  {
    id: '9',
    title: 'AI in Healthcare: Trends and Predictions',
    date: '2023-05-20T14:30:00.000Z',
    languageCode: 'en',
  },
];
