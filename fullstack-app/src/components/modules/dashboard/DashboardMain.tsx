import {DocumentCard} from '@/components/reusable/DocumentCard';
import {Header} from '@/components/reusable/Header';
import {Button} from '@/components/shadcn-ui/button';
import {Input} from '@/components/shadcn-ui/input';
import type {Document} from '@/types/Document';
import {type UploadingDocument} from '@/types/UploadingDocument';
import {api} from '@/utils/api';
import {UserButton} from '@clerk/nextjs';
import {Search, Upload} from 'lucide-react';
import {useTranslations} from 'next-intl';
import Link from 'next/link';
import {useRouter} from 'next/router';

export function DashboardMain() {
  const t = useTranslations('document-manager');
  const router = useRouter();
  const documentsQuery = api.documents.getDocuments.useQuery();
  const documents = documentsQuery.data ?? [];
  const cancelDocumentParsingMutation =
    api.documents.cancelDocumentParsing.useMutation();

  function handleCancelDocumentParsing(doc: Document) {
    cancelDocumentParsingMutation.mutate({
      id: doc.id,
    });

    // TODO: Show notification (error and success) to the user
  }

  return (
    <div className="flex-1">
      <Header>
        <div className="relative min-w-[250px] max-w-md flex-1">
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
        </div>
      </Header>

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
              <DocumentCard
                doc={doc}
                key={doc.id}
                onCancelButtonClick={() => handleCancelDocumentParsing(doc)}
              />
            ) : (
              <Link href={`/conversation/${doc.id}`} key={doc.id}>
                <DocumentCard
                  doc={doc}
                  onEditButtonClick={(ev) => {
                    ev.preventDefault();
                    void router.push(`/?documentId=${doc.id}`, undefined, {
                      shallow: true,
                    });
                  }}
                />
              </Link>
            )
          )}
        </div>
      </main>
    </div>
  );
}
