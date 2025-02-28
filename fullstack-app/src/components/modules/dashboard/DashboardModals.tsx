import {
  UpdateDocumentModal,
  type UpdateDocumentFormInputs,
} from '@/components/reusable/UpdateDocumentModal';
import {
  UploadNewDocumentModal,
  type UploadFormInputs,
} from '@/components/reusable/UploadNewDocumentModal';
import {useErrorToast, type ToastErrorType} from '@/hooks/useErrorToast';
import {api} from '@/utils/api';
import {useTranslations} from 'next-intl';
import {useRouter} from 'next/router';
import {Fragment, useState} from 'react';
import {type UseFormReturn} from 'react-hook-form';

export function DashboardModals() {
  const router = useRouter();
  const utils = api.useUtils();
  const [apiRouteLoading, setApiRouteLoading] = useState(false);
  const tUpdateDocModal = useTranslations('update-document-modal');
  const updateDocumentErrorToast = useErrorToast(
    'update-document-modal.errors'
  );
  const uploadDocumentErrorToast = useErrorToast(
    'upload-new-document-modal.errors'
  );

  const documentQuery = api.documents.getDocument.useQuery(
    {
      id: router.query.documentId as string,
    },
    {
      enabled: !!router.query.documentId,
    }
  );

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
    onError: updateDocumentErrorToast,
  });

  const document = documentQuery.data;
  const uploadingDocument = router.query.uploadingDocument === 'true';
  const isLoading =
    documentQuery.isLoading ||
    deleteDocumentMutation.isPending ||
    apiRouteLoading;

  async function handleUploadNewDocument(
    form: UseFormReturn<UploadFormInputs>,
    htmlForm: HTMLFormElement
  ) {
    if (isLoading) {
      return;
    }

    if (!form.getValues().file?.[0]) {
      throw new Error('No file provided');
    }

    setApiRouteLoading(true);

    // TRPC is incompatible with File objects, so we need to use fetch to
    // send the form data and then the server will call TRPC.
    //
    // @see https://github.com/trpc/trpc/issues/1937
    try {
      const res = await fetch('/api/uploadDocument', {
        method: 'POST',
        body: new FormData(htmlForm),
        signal: AbortSignal.timeout(10 * 60 * 1_000),
      });

      if (!res.ok) {
        try {
          const errorJson = await res.json();
          uploadDocumentErrorToast(errorJson);
        } catch (error) {
          uploadDocumentErrorToast({
            data: {
              code: 'UNKNOWN_ERROR',
            },
          } satisfies ToastErrorType);
        }
      }

      await handleCloseDocumentModal(form);
    } catch (error) {
      uploadDocumentErrorToast(error);
    } finally {
      setApiRouteLoading(false);
    }
  }

  async function handleUpdateDocument(
    form: UseFormReturn<UpdateDocumentFormInputs>,
    htmlForm: HTMLFormElement
  ) {
    if (isLoading) {
      return;
    }

    setApiRouteLoading(true);

    const formData = new FormData(htmlForm);
    formData.append('id', document!.id);

    try {
      const res = await fetch('/api/updateDocument', {
        method: 'PATCH',
        body: formData,
        signal: AbortSignal.timeout(10 * 60 * 1_000),
      });

      if (!res.ok) {
        try {
          const errorJson = await res.json();
          updateDocumentErrorToast(errorJson);
        } catch (error) {
          updateDocumentErrorToast({
            data: {
              code: 'UNKNOWN_ERROR',
            },
          } satisfies ToastErrorType);
        }
      }

      await utils.documents.invalidate();
      await handleCloseDocumentModal(form);
    } catch (error) {
      updateDocumentErrorToast(error);
    } finally {
      setApiRouteLoading(false);
    }
  }

  async function handleDeleteDocument(
    form: UseFormReturn<UpdateDocumentFormInputs>
  ) {
    if (isLoading || !document) {
      return;
    }

    if (!window.confirm(tUpdateDocModal('delete-confirmation'))) {
      return;
    }

    try {
      await deleteDocumentMutation.mutateAsync({
        id: document.id,
      });
    } catch (error) {
      // We already show the error to the user on the mutation
      // declaration, so we don't need to show it again here.
    }

    await handleCloseDocumentModal(form);
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
        isLoading={isLoading}
      />

      <UploadNewDocumentModal
        isOpen={uploadingDocument}
        onSubmit={handleUploadNewDocument}
        onClose={(form) => handleCloseDocumentModal(form)}
        isLoading={isLoading}
      />
    </Fragment>
  );
}
