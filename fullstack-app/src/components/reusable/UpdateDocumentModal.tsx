import {Button} from '@/components/shadcn-ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn-ui/dialog';
import {Input} from '@/components/shadcn-ui/input';
import type {Document} from '@/types/Document';
import {
  acceptedImageTypes,
  type UpdateDocumentPayload,
} from '@/types/UpdateDocumentPayload';
import {} from '@/types/UploadNewDocumentPayload';
import {useTranslations} from 'next-intl';
import {useRef} from 'react';
import {type SubmitHandler, useForm, type UseFormReturn} from 'react-hook-form';
import {Label} from '../shadcn-ui/label';
import {Textarea} from '../shadcn-ui/textarea';

export type UpdateDocumentFormInputs = Omit<
  UpdateDocumentPayload,
  'id' | 'image'
> & {
  image?: FileList;
};

interface UpdateDocumentModalProps {
  isOpen: boolean;
  document?: Document | null;
  isLoading?: boolean;
  onSubmit: (
    form: UseFormReturn<UpdateDocumentFormInputs>,
    htmlForm: HTMLFormElement
  ) => Promise<void>;
  onDelete: (form: UseFormReturn<UpdateDocumentFormInputs>) => Promise<void>;
  onClose?: (form: UseFormReturn<UpdateDocumentFormInputs>) => Promise<void>;
}

export function UpdateDocumentModal(props: UpdateDocumentModalProps) {
  const t = useTranslations('update-document-modal');
  const form = useForm<UpdateDocumentFormInputs>({
    defaultValues: {
      title: props.document?.title ?? '',
      description: props.document?.description ?? '',
    },
  });
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit: SubmitHandler<UpdateDocumentFormInputs> = () => {
    if (props.isLoading) {
      return;
    }

    void props.onSubmit(form, formRef.current!);
  };

  function handleCloseButtonClick() {
    void props.onClose?.(form);
  }

  function handleDeleteButtonClick() {
    if (props.isLoading) {
      return;
    }

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
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          ref={formRef}
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="title">{t('document-title')}</Label>
              <Input
                id="title"
                disabled={props.isLoading}
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
                  disabled: props.isLoading,
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
                disabled={props.isLoading}
                {...form.register('description', {
                  required: false,
                  maxLength: 2000,
                  disabled: props.isLoading,
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

            <div className="relative space-y-1">
              <Label htmlFor="image">{t('image-input-label')}</Label>
              <Input
                id="image"
                type="file"
                disabled={props.isLoading}
                {...form.register('image', {
                  required: false,
                  disabled: props.isLoading,
                  validate: (value): string | boolean => {
                    const file = value?.[0];

                    if (file == null) {
                      return true; // Optional field
                    }

                    if (!acceptedImageTypes.includes(file.type)) {
                      return t('form-errors.image-must-be-valid');
                    }

                    const MAX_IMAGE_SIZE_MB = 1;
                    const MAX_IMAGE_SIZE_BYTES =
                      MAX_IMAGE_SIZE_MB * 1024 * 1024;

                    if (file.size > MAX_IMAGE_SIZE_BYTES) {
                      return t('form-errors.image-max-size', {
                        maxSizeInMB: Math.floor(MAX_IMAGE_SIZE_MB),
                      });
                    }

                    return true;
                  },
                })}
                accept={acceptedImageTypes.join(',')}
                multiple={false}
              />
              {form.formState.errors.image && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.image.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="reset"
              variant="outline"
              disabled={props.isLoading}
              onClick={handleCloseButtonClick}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={props.isLoading}>
              {t('save')}
            </Button>
          </div>

          <div className="mt-4 border-t pt-4">
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              disabled={props.isLoading}
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
