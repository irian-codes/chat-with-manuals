import {DocumentCard} from '@/components/reusable/DocumentCard';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import type {Document} from '@/types/Document';
import {type UploadingDocument} from '@/types/UploadingDocument';
import {UserButton} from '@clerk/nextjs';
import {Search, Upload} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useRouter} from 'next/router';
import {LanguageSwitcher} from '../../reusable/LanguageSwitcher';

interface DashboardProps {
  documents: Document[];
}

export function DashboardMain({documents}: DashboardProps) {
  const t = useTranslations('document-manager');
  const router = useRouter();

  return (
    <div className="flex-1">
      <header className="border-b">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t('header.search')} className="pl-8" />
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={() =>
                void router.push('/?uploadingDocument=true', undefined, {
                  shallow: true,
                })
              }
            >
              <Upload className="mr-2 h-4 w-4" />
              {t('header.upload')}
            </Button>
            <UserButton />
            <LanguageSwitcher />
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
  );
}
