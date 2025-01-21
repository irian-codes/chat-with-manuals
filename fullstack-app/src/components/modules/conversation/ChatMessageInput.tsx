import {Button} from '@/components/shadcn-ui/button';
import {Textarea} from '@/components/shadcn-ui/textarea';
import {useIsMacOs, useIsTouchDevice} from '@/hooks/os-utils';
import {AlertTriangle, Send} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {forwardRef, type FormEventHandler} from 'react';

type Props = {
  conversationLocale: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  textAreaProps?: Omit<React.ComponentProps<'textarea'>, 'ref'>;
  sendButtonProps?: Omit<React.ComponentProps<'button'>, 'type'>;
};

export const ChatMessageInput = forwardRef<HTMLTextAreaElement, Props>(
  function ChatMessageInput(props, ref) {
    const isTouchDevice = useIsTouchDevice();
    const isMacOs = useIsMacOs();
    const t = useTranslations('conversation');

    return (
      <div className="border-t p-4">
        <div className="mx-auto flex min-w-[250px] max-w-[750px] flex-col gap-2 lg:w-[calc(100%-12rem)]">
          <form
            onSubmit={props.onSubmit}
            className="flex items-start space-x-2"
          >
            <Textarea
              placeholder={t('input-placeholder')}
              className="flex-1 resize-none"
              ref={ref}
              {...props.textAreaProps}
            />
            <div className="flex flex-col items-center justify-center gap-1">
              <Button type="submit" {...props.sendButtonProps}>
                <Send className="mr-2 h-4 w-4" />
                {t('send')}
              </Button>
              {!isTouchDevice && (
                <div className="text-sm">
                  {isMacOs ? '⌘ + Enter' : 'Ctrl + Enter'}
                </div>
              )}
            </div>
          </form>
          <p className="flex items-center justify-start gap-2 pr-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-6 w-6" />{' '}
            {t('language-alert-brief', {
              locale: props.conversationLocale,
            })}
          </p>
        </div>
      </div>
    );
  }
);
