import {Button} from '@/components/shadcn-ui/button';
import {Checkbox} from '@/components/shadcn-ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn-ui/dialog';
import {Label} from '@/components/shadcn-ui/label';
import {ScrollArea} from '@/components/shadcn-ui/scroll-area';
import {addDays} from '@/utils/date';
import {AlertTriangle} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useEffect, useId, useState} from 'react';

const DISCLAIMER_STORAGE_KEY = 'disclaimer_accepted';
const EXPIRATION_DAYS = 14;

interface DisclaimerStorage {
  accepted: boolean;
  timestamp: number;
}

export function DisclaimerModal() {
  const t = useTranslations('disclaimer-modal');
  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const dontShowAgainId = useId();

  // Check localStorage on mount
  useEffect(() => {
    try {
      const storedValue = localStorage.getItem(DISCLAIMER_STORAGE_KEY);

      if (storedValue == null) {
        setIsOpen(true);
        return;
      }

      const parsedValue = JSON.parse(storedValue) as DisclaimerStorage;
      const expirationTime = addDays(
        new Date(parsedValue.timestamp),
        EXPIRATION_DAYS
      ).getTime();

      // Check if the stored value has expired
      if (!parsedValue.accepted || Date.now() > expirationTime) {
        setIsOpen(true);
        return;
      }
    } catch (error) {
      // If there's any error reading from localStorage, show the modal
      console.error(
        'Error reading disclaimer acceptance from localStorage:',
        error
      );

      setIsOpen(true);
    }
  }, []);

  const handleAcceptButtonClick = (ev: React.MouseEvent<HTMLButtonElement>) => {
    setIsOpen(false);

    try {
      const disclaimerData: DisclaimerStorage = {
        accepted: dontShowAgain,
        timestamp: Date.now(),
      };

      localStorage.setItem(
        DISCLAIMER_STORAGE_KEY,
        JSON.stringify(disclaimerData)
      );
    } catch (error) {
      console.error(
        'Error saving disclaimer acceptance to localStorage:',
        error
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="max-h-[90vh] w-[90vw] max-w-lg sm:w-full"
        showCloseButton={false}
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking outside
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-bold">
            {t('title')}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center gap-8">
              <div className="flex-shrink-0 rounded-md bg-orange-400 p-1">
                <AlertTriangle size={24} color="black" />
              </div>
              <p className="text-center text-lg font-bold">
                {t('warning-title')}
              </p>
              <div className="flex-shrink-0 rounded-md bg-orange-400 p-1">
                <AlertTriangle size={24} color="black" />
              </div>
            </div>
            <p>{t('warning-text')}</p>

            <div className="space-y-2">
              <p className="font-semibold">{t('please-note')}</p>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  <strong>{t('warning-items.no-sensitive-documents')}</strong>
                </li>
                <li>
                  <strong>{t('warning-items.no-sensitive-info')}</strong>
                </li>
                <li>
                  <strong>{t('warning-items.data-exposure')}</strong>
                </li>
              </ul>
            </div>

            <p>{t('acknowledgment')}</p>

            <p className="italic">{t('thank-you')}</p>
          </div>
        </ScrollArea>

        <div className="mt-4 flex flex-col space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={dontShowAgainId}
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(checked === true)}
            />
            <Label htmlFor={dontShowAgainId}>{t('dont-show-again')}</Label>
          </div>

          <Button className="w-full" onClick={handleAcceptButtonClick}>
            {t('understand-button')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
