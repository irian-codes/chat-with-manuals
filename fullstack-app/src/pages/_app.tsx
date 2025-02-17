import {ClerkProvider} from '@clerk/nextjs';
import {GeistSans} from 'geist/font/sans';
import {NextIntlClientProvider} from 'next-intl';
import type {AppProps, AppType} from 'next/app';

import {api} from '@/utils/api';

import {Toaster} from '@/components/shadcn-ui/toaster';
import {SidebarProvider} from '@/contexts/ConversationsSidebarContext';
import '@/styles/globals.css';
import type {i18nMessages} from '@/types/i18nMessages';
import {cn} from '@/utils/ui/utils';
import {useRouter} from 'next/router';

const MyApp: AppType = ({Component, pageProps}: AppProps) => {
  const router = useRouter();

  return (
    <NextIntlClientProvider
      // eslint-disable-next-line
      messages={pageProps.messages as i18nMessages}
      locale={router.locale}
      timeZone="UTC"
      formats={{
        dateTime: {
          short: {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          },
          time: {
            hour: '2-digit',
            minute: '2-digit',
          },
          full: {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          },
        },
        number: {
          precise: {
            maximumFractionDigits: 3,
          },
        },
        list: {
          enumeration: {
            style: 'long',
            type: 'conjunction',
          },
        },
      }}
    >
      <ClerkProvider
        appearance={{variables: {fontFamily: GeistSans.style.fontFamily}}}
      >
        <SidebarProvider>
          <div
            className={cn(
              GeistSans.className,
              GeistSans.variable,
              'overflow-x-hidden'
            )}
          >
            <Component {...pageProps} />
          </div>
          <Toaster />
        </SidebarProvider>
      </ClerkProvider>
    </NextIntlClientProvider>
  );
};

export default api.withTRPC(MyApp);
