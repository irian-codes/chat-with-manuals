import {EditDocumentModal} from '@/components/reusable/EditDocumentModal';
import {UploadNewDocumentModal} from '@/components/reusable/UploadNewDocumentModal';
import type {Document} from '@/types/Document';
import {useRouter} from 'next/router';
import {Fragment, useEffect, useState} from 'react';

interface DashboardModalsProps {
  documents: Document[];
}

export function DashboardModals({documents}: DashboardModalsProps) {
  const [isUploadNewDocumentModalOpen, setIsUploadNewDocumentModalOpen] =
    useState(false);
  const [document, setDocument] = useState<Document | null>(null);
  const router = useRouter();

  useEffect(() => {
    const documentId = router.query.documentId as string;
    const uploadingDocument = Boolean(router.query.uploadingDocument);

    if (documentId) {
      setDocument(documents.find((d) => d.id === documentId) ?? null);
    } else {
      setDocument(null);
    }

    if (uploadingDocument) {
      setIsUploadNewDocumentModalOpen(true);
    } else {
      setIsUploadNewDocumentModalOpen(false);
    }
  }, [router.query.documentId, router.query.uploadingDocument, documents]);

  return (
    <Fragment>
      <EditDocumentModal
        isOpen={document !== null}
        document={document}
        onSubmit={(payload) => {
          console.log('document saved! with ID:', payload);
        }}
        onDelete={(doc) => {
          console.log('document deleted! with ID:', doc.id);
        }}
        onClose={() => {
          void router.push('/', undefined, {shallow: true});
        }}
      />

      <UploadNewDocumentModal
        isOpen={isUploadNewDocumentModalOpen}
        onClose={() => {
          void router.push('/');
        }}
        onSubmit={(data) => {
          console.log(data);
        }}
      />
    </Fragment>
  );
}
