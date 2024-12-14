import {
  type EditDocumentFormInputs,
  EditDocumentModal,
} from '@/components/reusable/EditDocumentModal';
import {
  type UploadFormInputs,
  UploadNewDocumentModal,
} from '@/components/reusable/UploadNewDocumentModal';
import {api} from '@/utils/api';
import {truncateFilename} from '@/utils/files';
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

  async function handleUploadNewDocument(
    data: UploadFormInputs,
    form: UseFormReturn<UploadFormInputs>
  ) {
    if (!data?.file?.[0]) {
      throw new Error('No file provided');
    }

    const originalFile = data.file[0];
    const file = new File([originalFile], truncateFilename(originalFile.name), {
      type: originalFile.type,
    });

    const formData = new FormData();
    // TODO: Add real imageUrl, for now using default value so we aren't sending any
    formData.set('title', data.title);
    formData.set('locale', data.locale);
    if (data.description) {
      formData.set('description', data.description);
    }
    formData.set('file', file);

    await uploadDocumentMutation.mutateAsync(formData);
    await handleCloseDocumentModal(form);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleCloseDocumentModal(form: UseFormReturn<any>) {
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
        onClose={handleCloseDocumentModal}
        onSubmit={handleUploadNewDocument}
      />
    </Fragment>
  );
}
