import {Button} from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import type {Document} from '@/types/Document';
import {useTranslations} from 'next-intl';
import {type SubmitHandler, useForm} from 'react-hook-form';
import {Label} from '../ui/label';
import {Textarea} from '../ui/textarea';

interface EditDocumentFormInputs {
  title: string;
  description: string;
}

type FormData = EditDocumentFormInputs;

interface EditDocumentModalProps {
  isOpen: boolean;
  document: Document;
  onSave: (data: FormData) => void;
  onDelete: () => void;
  onClose?: () => void;
}

export function EditDocumentModal(props: EditDocumentModalProps) {
  const t = useTranslations('edit-document-modal');
  const form = useForm<EditDocumentFormInputs>({
    defaultValues: {
      title: props.document.title,
      description: props.document.description,
    },
  });

  const onSubmit: SubmitHandler<EditDocumentFormInputs> = (data) => {
    props.onSave(data);
    form.reset();
    form.clearErrors();
    props.onClose?.();
  };

  function handleCloseButtonClick() {
    form.reset();
    form.clearErrors();
    props.onClose?.();
  }

  function handleDeleteButtonClick() {
    if (window.confirm(t('delete-confirmation'))) {
      props.onDelete();
      form.reset();
      form.clearErrors();
      props.onClose?.();
    }
  }

  return (
    <Dialog open={props.isOpen} onOpenChange={props.onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        {/* TODO: This could be even nicer if we create the form with the Shacn/ui integration: https://ui.shadcn.com/docs/components/form */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="title">{t('name')}</Label>
              <Input
                id="title"
                {...form.register('title', {
                  required: {
                    value: true,
                    message: t('form-errors.name-required'),
                  },
                  minLength: {
                    value: 3,
                    message: t('form-errors.name-min-length'),
                  },
                  maxLength: {
                    value: 255,
                    message: t('form-errors.name-max-length'),
                  },
                })}
                placeholder={t('name')}
                defaultValue={props.document.title}
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
                defaultValue={props.document.description}
              />
              {form.formState.errors.description && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCloseButtonClick}>
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
