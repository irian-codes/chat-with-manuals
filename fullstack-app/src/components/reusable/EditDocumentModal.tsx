import {Button} from '@/components/shadcn-ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn-ui/dialog';
import {Input} from '@/components/shadcn-ui/input';
import type {Document} from '@/types/Document';
import {type RouterInputs} from '@/utils/api';
import {useTranslations} from 'next-intl';
import {type SubmitHandler, useForm, type UseFormReturn} from 'react-hook-form';
import {Label} from '../shadcn-ui/label';
import {Textarea} from '../shadcn-ui/textarea';

export type EditDocumentFormInputs = Omit<
  RouterInputs['documents']['updateDocument'],
  'id'
>;

interface EditDocumentModalProps {
  isOpen: boolean;
  document?: Document | null;
  onSubmit: (
    formData: EditDocumentFormInputs,
    form: UseFormReturn<EditDocumentFormInputs>
  ) => Promise<void>;
  onDelete: (form: UseFormReturn<EditDocumentFormInputs>) => Promise<void>;
  onClose?: (form: UseFormReturn<EditDocumentFormInputs>) => Promise<void>;
}

export function EditDocumentModal(props: EditDocumentModalProps) {
  const t = useTranslations('edit-document-modal');
  const form = useForm<EditDocumentFormInputs>({
    defaultValues: {
      title: props.document?.title ?? '',
      description: props.document?.description ?? '',
    },
  });

  const onSubmit: SubmitHandler<EditDocumentFormInputs> = (data) => {
    void props.onSubmit(data, form);
  };

  function handleCloseButtonClick() {
    void props.onClose?.(form);
  }

  function handleDeleteButtonClick() {
    void props.onDelete(form);
  }

  return (
    <Dialog
      open={props.isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleCloseButtonClick();
        }
      }}
    >
      <DialogContent className="w-[90vw] max-w-md sm:w-full">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        {/* TODO: This could be even nicer if we create the form with the Shacn/ui integration: https://ui.shadcn.com/docs/components/form */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="title">{t('document-title')}</Label>
              <Input
                id="title"
                {...form.register('title', {
                  required: {
                    value: true,
                    message: t('form-errors.title-required'),
                  },
                  minLength: {
                    value: 3,
                    message: t('form-errors.title-min-length'),
                  },
                  maxLength: {
                    value: 255,
                    message: t('form-errors.title-max-length'),
                  },
                })}
                placeholder={t('document-title')}
                defaultValue={props.document?.title ?? ''}
              />
              {form.formState.errors.title && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="description">{t('description')}</Label>
              <Textarea
                id="description"
                {...form.register('description', {
                  required: false,
                  maxLength: 2000,
                })}
                placeholder={t('description')}
                rows={3}
                defaultValue={props.document?.description ?? ''}
              />
              {form.formState.errors.description && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="reset"
              variant="outline"
              onClick={handleCloseButtonClick}
            >
              {t('cancel')}
            </Button>
            <Button type="submit">{t('save')}</Button>
          </div>

          <div className="mt-4 border-t pt-4">
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={handleDeleteButtonClick}
            >
              {t('delete')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
