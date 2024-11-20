import {Button} from '@/components/ui/button';
import {Card, CardContent} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import type {Document} from '@/types/Document';
import {type UploadingDocument} from '@/types/UploadingDocument';
import {UserButton} from '@clerk/nextjs';
import {FilePenLine, Search, Upload, X} from 'lucide-react';
import {useFormatter, useTranslations} from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import {Fragment, useState} from 'react';
import LocaleSwitcher from './custom/LanguageSwitcher';
import {UploadNewDocumentModal} from './custom/UploadNewDocumentModal';

interface DashboardProps {
  documents: Document[];
}

export function Dashboard({documents}: DashboardProps) {
  const t = useTranslations('document-manager');
  const [isUploadNewDocumentModalOpen, setIsUploadNewDocumentModalOpen] =
    useState(false);

  return (
    <Fragment>
      <div className="flex-1">
        <header className="border-b">
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('header.search')} className="pl-8" />
            </div>
            <div className="flex items-center gap-4">
              <Button onClick={() => setIsUploadNewDocumentModalOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                {t('header.upload')}
              </Button>
              <UserButton />
              <LocaleSwitcher />
            </div>
          </div>
        </header>

        <main className="p-4">
          <div className="flex flex-row flex-wrap gap-4">
            {[
              {
                id: '1',
                title: t('uploading-document'),
                date: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                isUploading: true,
              } as UploadingDocument,
              ...documents,
            ].map((doc) =>
              // TODO: Add the conversation id to the url
              'isUploading' in doc && doc.isUploading ? (
                <DocumentCard doc={doc} key={doc.id} />
              ) : (
                <Link href={`/conversation`} key={doc.id}>
                  <DocumentCard doc={doc} />
                </Link>
              )
            )}
          </div>
        </main>
      </div>
      <UploadNewDocumentModal
        isOpen={isUploadNewDocumentModalOpen}
        onClose={() => setIsUploadNewDocumentModalOpen(false)}
        onUpload={(data) => {
          console.log(data);
        }}
      />
    </Fragment>
  );
}

function DocumentCard({doc}: {doc: Document | UploadingDocument}) {
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
            <div>
              <h3 className="line-clamp-2 font-medium">{doc.title}</h3>
              <p className="text-sm text-muted-foreground">
                {'isUploading' in doc && doc.isUploading
                  ? format.relativeTime(new Date(doc.date), Date.now())
                  : format.dateTime(new Date(doc.date), 'full')}
              </p>
            </div>
            {'isUploading' in doc && doc.isUploading ? (
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon">
                <FilePenLine className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
