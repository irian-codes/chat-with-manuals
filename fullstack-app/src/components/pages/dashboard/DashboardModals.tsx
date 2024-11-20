import {EditDocumentModal} from '@/components/reusable/EditDocumentModal';
import {UploadNewDocumentModal} from '@/components/reusable/UploadNewDocumentModal';
import type {Document} from '@/types/Document';
import {useRouter} from 'next/router';
import {Fragment, useMemo} from 'react';

interface DashboardModalsProps {
  documents: Document[];
}

export function DashboardModals({documents}: DashboardModalsProps) {
  const router = useRouter();

  const documentId = router.query.documentId as string;
  // TODO: If we used a map instead of an array, we could prevent the useMemo hook because the performance would be negligible.
  const document = useMemo(() => {
    return documentId
      ? (documents.find((d) => d.id === documentId) ?? null)
      : null;
  }, [documentId, documents]);
  const uploadingDocument = router.query.uploadingDocument === 'true';

  return (
    <Fragment>
      <EditDocumentModal
        // Each modal is for a different document, so we need a unique key to avoid a shared state.
        key={document?.id}
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
        isOpen={uploadingDocument}
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
