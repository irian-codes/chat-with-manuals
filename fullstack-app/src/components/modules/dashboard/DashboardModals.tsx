import {
  type EditDocumentFormInputs,
  EditDocumentModal,
} from '@/components/reusable/EditDocumentModal';
import {UploadNewDocumentModal} from '@/components/reusable/UploadNewDocumentModal';
import type {UploadDocumentPayload} from '@/types/UploadDocumentPayload';
import {api} from '@/utils/api';
import {useTranslations} from 'next-intl';
import {useRouter} from 'next/router';
import {Fragment} from 'react';
import {type UseFormReturn} from 'react-hook-form';

export function DashboardModals() {
  const router = useRouter();
  const documentQuery = api.documents.getDocument.useQuery(
    {
      id: router.query.documentId as string,
    },
    {
      enabled: !!router.query.documentId,
    }
  );
  const uploadDocumentMutation = api.documents.uploadDocument.useMutation();
  const updateDocumentMutation = api.documents.updateDocument.useMutation();
  const deleteDocumentMutation = api.documents.deleteDocument.useMutation();

  const document = documentQuery.data;
  const uploadingDocument = router.query.uploadingDocument === 'true';
  const tEditDocModal = useTranslations('edit-document-modal');

  async function handleUploadDocument(data: UploadDocumentPayload) {
    const formData = new FormData();

    // Add all fields to FormData to send it to TRPC (only supported way to send files)
    formData.set('title', data.title);
    formData.set('language', data.language);
    if (data.description) {
      formData.set('description', data.description);
    }
    formData.set('file', data.file);

    await uploadDocumentMutation.mutateAsync(formData);

    // TODO: Show notification (error and success) to the user
  }

  async function handleUpdateDocument(
    formData: EditDocumentFormInputs,
    form: UseFormReturn<EditDocumentFormInputs>
  ) {
    await updateDocumentMutation.mutateAsync({
      ...formData,
      id: document!.id,
    });

    await handleCloseDocumentModal(form);

    // TODO: Show notification (error and success) to the user
  }

  async function handleDeleteDocument(
    form: UseFormReturn<EditDocumentFormInputs>
  ) {
    if (!document) {
      return;
    }

    if (!window.confirm(tEditDocModal('delete-confirmation'))) {
      return;
    }

    await deleteDocumentMutation.mutateAsync({
      id: document.id,
    });

    await handleCloseDocumentModal(form);

    // TODO: Show notification (error and success) to the user
  }

  async function handleCloseDocumentModal(
    form: UseFormReturn<EditDocumentFormInputs>
  ) {
    form.reset();
    form.clearErrors();
    void router.push('/', undefined, {shallow: true});
  }

  return (
    <Fragment>
      <EditDocumentModal
        // Each modal is for a different document, so we need a unique key to avoid a shared state.
        key={document?.id}
        isOpen={document != null}
        document={document}
        onSubmit={handleUpdateDocument}
        onDelete={handleDeleteDocument}
        onClose={handleCloseDocumentModal}
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
