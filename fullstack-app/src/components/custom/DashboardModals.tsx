import {EditDocumentModal} from '@/components/custom/EditDocumentModal';
import {UploadNewDocumentModal} from '@/components/custom/UploadNewDocumentModal';
import type {Document} from '@/types/Document';
import {useRouter} from 'next/router';
import {Fragment, useEffect, useState} from 'react';

interface DashboardModalsProps {
  documents: Document[];
}

export function DashboardModals({documents}: DashboardModalsProps) {
  const [isEditDocumentModalOpen, setIsEditDocumentModalOpen] = useState(false);
  const [isUploadNewDocumentModalOpen, setIsUploadNewDocumentModalOpen] =
    useState(false);
  const [document, setDocument] = useState<Document | null>(null);
  const router = useRouter();

  useEffect(() => {
    const documentId = router.query.documentId as string;
    const uploadingDocument = Boolean(router.query.uploadingDocument);

    if (documentId) {
      setIsEditDocumentModalOpen(true);
      setDocument(documents.find((d) => d.id === documentId) ?? null);
    } else {
      setDocument(null);
      setIsEditDocumentModalOpen(false);
    }

    if (uploadingDocument) {
      setIsUploadNewDocumentModalOpen(true);
    } else {
      setIsUploadNewDocumentModalOpen(false);
    }
  }, [router.query.documentId, router.query.uploadingDocument, documents]);

  return (
    <Fragment>
      {document && (
        <EditDocumentModal
          isOpen={isEditDocumentModalOpen}
          document={document}
          onSave={(data) => {
            console.log('document saved! with ID:', document.id, data);
          }}
          onDelete={() => {
            console.log('document deleted! with ID:', document.id);
          }}
          onClose={() => {
            setIsEditDocumentModalOpen(false);

            // Allowing the close animation to finish before pushing the route
            setTimeout(() => {
              void router.push('/', undefined, {shallow: true});
            }, 0);
          }}
        />
      )}
      <UploadNewDocumentModal
        isOpen={isUploadNewDocumentModalOpen}
        onClose={() => {
          setIsUploadNewDocumentModalOpen(false);

          // Allowing the close animation to finish before pushing the route
          setTimeout(() => {
            void router.push('/');
          }, 0);
        }}
        onUpload={(data) => {
          console.log(data);
        }}
      />
    </Fragment>
  );
}
