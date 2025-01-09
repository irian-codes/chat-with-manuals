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
  const utils = api.useUtils();
  const updateDocumentMutation = api.documents.updateDocument.useMutation({
    onSuccess: async () => {
      await utils.documents.invalidate();
    },
  });
  const deleteDocumentMutation = api.documents.deleteDocument.useMutation({
    onSuccess: async () => {
      // Note: We cannot invalidate the whole documents router because it
      // would invalidate the recently deleted document too and then new
      // requests would trigger and fail with a 404. And it doesn't really
      // matter if we don't invalidate the document since we cannot select
      // it anyway in the UI.
      await utils.documents.getDocuments.invalidate();
    },
  });

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

    const formData = new FormData();
    // TODO: Add real imageUrl, for now using default value so we aren't sending any
    formData.set('title', data.title);
    formData.set('locale', data.locale);
    if (data.description) {
      formData.set('description', data.description);
    }
    formData.set('file', originalFile, truncateFilename(originalFile.name));

    // TRPC is incompatible with File objects, so we need to use fetch to
    // send the form data and then the server will call TRPC.
    //
    // @see https://github.com/trpc/trpc/issues/1937
    await fetch('/api/uploadDocument', {
      method: 'POST',
      body: formData,
    });

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

  async function handleCloseDocumentModal(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form: UseFormReturn<any>
  ) {
    form.reset();
    form.clearErrors();

    await router.push('/', undefined, {shallow: true});
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
        onClose={(form) => handleCloseDocumentModal(form)}
      />

      <UploadNewDocumentModal
        isOpen={uploadingDocument}
        onSubmit={handleUploadNewDocument}
        onClose={(form) => handleCloseDocumentModal(form)}
      />
    </Fragment>
  );
}
