import {Button} from '@/components/shadcn-ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn-ui/dialog';
import {Input} from '@/components/shadcn-ui/input';
import type {UploadDocumentPayload} from '@/types/UploadDocumentPayload';
import ISO6391 from 'iso-639-1';
import {useTranslations} from 'next-intl';
import {type SubmitHandler, useForm, type UseFormReturn} from 'react-hook-form';
import {Label} from '../shadcn-ui/label';
import {Textarea} from '../shadcn-ui/textarea';

// Seems that on the frontend the type for the file picker must be
// FileList, while on the backend we want to use File.
export type UploadFormInputs = Omit<UploadDocumentPayload, 'file'> & {
  file: FileList;
};

interface UploadNewDocumentModalProps {
  isOpen: boolean;
  onSubmit: (
    data: UploadFormInputs,
    form: UseFormReturn<UploadFormInputs>
  ) => Promise<void>;
  onClose?: (form: UseFormReturn<UploadFormInputs>) => Promise<void>;
}

export function UploadNewDocumentModal(props: UploadNewDocumentModalProps) {
  const t = useTranslations('upload-new-document-modal');
  const form = useForm<UploadFormInputs>();

  const onSubmit: SubmitHandler<UploadFormInputs> = (data) => {
    void props.onSubmit(data, form);
  };

  function handleCloseButtonClick() {
    void props.onClose?.(form);
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
          <DialogTitle>{t('upload')}</DialogTitle>
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
              />
              {form.formState.errors.description && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="lang">{t('language-label')}</Label>
              <select
                id="lang"
                {...form.register('language', {
                  required: {
                    value: true,
                    message: t('form-errors.language-required'),
                  },
                })}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                {ISO6391.getAllCodes()
                  .sort((a, b) =>
                    ISO6391.getNativeName(a).localeCompare(
                      ISO6391.getNativeName(b)
                    )
                  )
                  .map((code) => (
                    <option key={code} value={code}>
                      {ISO6391.getNativeName(code)}
                    </option>
                  ))}
              </select>
              {form.formState.errors.language && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.language.message}
                </p>
              )}
            </div>

            <div className="relative space-y-1">
              <Label htmlFor="file">{t('file-input-label')}</Label>
              <Input
                id="file"
                type="file"
                {...form.register('file', {
                  required: {
                    value: true,
                    message: t('form-errors.file-required'),
                  },
                  validate: (value): string | boolean => {
                    const file = value?.[0];

                    if (file == null) {
                      return false;
                    }

                    if (
                      !file.name.toLowerCase().endsWith('.pdf') ||
                      file.type !== 'application/pdf'
                    ) {
                      return t('form-errors.file-must-be-pdf');
                    }

                    // Protecting against the guy who tries to upload the
                    // entire Wikipedia as a PDF.
                    // This should be checked on the backend too, but
                    // checking here first to avoid unnecessary processing.
                    const MAX_FILE_SIZE_MB = 800;
                    const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1000 * 1000;
                    const errorFileSizeMessage = t(
                      'form-errors.file-max-size',
                      {
                        maxSizeInMB: Math.floor(MAX_FILE_SIZE_MB),
                      }
                    );

                    if (file.size > MAX_FILE_SIZE_BYTES) {
                      return errorFileSizeMessage;
                    }

                    return true;
                  },
                })}
                accept=".pdf,application/pdf"
                multiple={false}
              />
              {form.formState.errors.file && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.file.message}
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
            <Button type="submit">{t('upload')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
