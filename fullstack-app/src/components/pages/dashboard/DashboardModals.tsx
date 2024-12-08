import {
  type EditDocumentFormInputs,
  EditDocumentModal,
} from '@/components/reusable/EditDocumentModal';
import {UploadNewDocumentModal} from '@/components/reusable/UploadNewDocumentModal';
import type {Document} from '@/types/Document';
import type {UploadDocumentPayload} from '@/types/UploadDocumentPayload';
import {api} from '@/utils/api';
import {useRouter} from 'next/router';
import {Fragment, useMemo} from 'react';

interface DashboardModalsProps {
  documents: Document[];
}

export function DashboardModals({documents}: DashboardModalsProps) {
  const router = useRouter();
  const uploadDocumentMutation = api.documents.uploadDocument.useMutation();
  const updateDocumentMutation = api.documents.updateDocument.useMutation();

  const documentId = router.query.documentId as string;
  // TODO: If we used a map instead of an array, we could prevent the useMemo hook because the performance would be negligible.
  const document = useMemo(() => {
    return documentId
      ? (documents.find((d) => d.id === documentId) ?? null)
      : null;
  }, [documentId, documents]);

  const uploadingDocument = router.query.uploadingDocument === 'true';

  function handleUploadDocument(data: UploadDocumentPayload) {
    const formData = new FormData();

    // Add all fields to FormData to send it to TRPC (only supported way to send files)
    formData.set('title', data.title);
    formData.set('language', data.language);
    if (data.description) {
      formData.set('description', data.description);
    }
    formData.set('file', data.file);

    uploadDocumentMutation.mutate(formData);
  }

  function handleUpdateDocument(formData: EditDocumentFormInputs) {
    updateDocumentMutation.mutate({
      ...formData,
      id: document!.id,
    });

    // TODO: Show notification (error and success) to the user
  }

  return (
    <Fragment>
      <EditDocumentModal
        // Each modal is for a different document, so we need a unique key to avoid a shared state.
        key={document?.id}
        isOpen={document !== null}
        document={document}
        onSubmit={handleUpdateDocument}
        onDelete={() => {
          console.log('document deleted! with ID:', document!.id);
        }}
        onClose={() => {
          void router.push('/', undefined, {shallow: true});
        }}
      />

      <UploadNewDocumentModal
        isOpen={uploadingDocument}
        onClose={() => {
          void router.push('/', undefined, {shallow: true});
        }}
        onSubmit={handleUploadDocument}
      />
    </Fragment>
  );
}
