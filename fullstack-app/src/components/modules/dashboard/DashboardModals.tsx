import {
  UpdateDocumentModal,
  type UpdateDocumentFormInputs,
} from '@/components/reusable/UpdateDocumentModal';
import {
  UploadNewDocumentModal,
  type UploadFormInputs,
} from '@/components/reusable/UploadNewDocumentModal';
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
  const utils = api.useUtils();
  const deleteDocumentMutation = api.documents.deleteDocument.useMutation({
    onSuccess: async () => {
      // Note: We cannot invalidate the whole documents router because it
      // would invalidate the recently deleted document too and then new
      // requests would trigger and fail with a 404. And it doesn't really
      // matter if we don't invalidate the document since we cannot select
      // it anyway in the UI.
      await utils.documents.getDocuments.invalidate();
      await utils.conversations.getConversations.invalidate();
    },
  });

  const document = documentQuery.data;
  const uploadingDocument = router.query.uploadingDocument === 'true';
  const tUpdateDocModal = useTranslations('update-document-modal');

  async function handleUploadNewDocument(
    form: UseFormReturn<UploadFormInputs>,
    htmlForm: HTMLFormElement
  ) {
    if (!form.getValues().file?.[0]) {
      throw new Error('No file provided');
    }

    // TRPC is incompatible with File objects, so we need to use fetch to
    // send the form data and then the server will call TRPC.
    //
    // @see https://github.com/trpc/trpc/issues/1937
    await fetch('/api/uploadDocument', {
      method: 'POST',
      body: new FormData(htmlForm),
    });

    await handleCloseDocumentModal(form);
  }

  async function handleUpdateDocument(
    form: UseFormReturn<UpdateDocumentFormInputs>,
    htmlForm: HTMLFormElement
  ) {
    const formData = new FormData(htmlForm);
    formData.append('id', document!.id);

    await fetch('/api/updateDocument', {
      method: 'PATCH',
      body: formData,
    });

    await utils.documents.invalidate();
    await handleCloseDocumentModal(form);

    // TODO: Show notification (error and success) to the user
  }

  async function handleDeleteDocument(
    form: UseFormReturn<UpdateDocumentFormInputs>
  ) {
    if (!document) {
      return;
    }

    if (!window.confirm(tUpdateDocModal('delete-confirmation'))) {
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
      <UpdateDocumentModal
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
