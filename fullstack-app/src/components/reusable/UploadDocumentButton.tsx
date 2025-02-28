import {Button} from '@/components/shadcn-ui/button';
import {Upload} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useRouter} from 'next/router';

interface UploadDocumentButtonProps {
  uploadIconProps?: React.ComponentProps<typeof Upload>;
  buttonProps?: React.ComponentPropsWithRef<typeof Button>;
  textProps?: React.ComponentProps<'p'>;
}

export function UploadDocumentButton(props: UploadDocumentButtonProps) {
  const router = useRouter();
  const t = useTranslations('document-manager');

  return (
    <Button
      onClick={() =>
        void router.push('/?uploadingDocument=true', undefined, {
          shallow: true,
        })
      }
      {...props.buttonProps}
    >
      <Upload size={16} {...props.uploadIconProps} />
      <p {...props.textProps}>{t('header.upload')}</p>
    </Button>
  );
}
