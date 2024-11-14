import {ClerkProvider} from '@clerk/nextjs';
import {GeistSans} from 'geist/font/sans';
import {type AppType} from 'next/app';

import {api} from '@/utils/api';

import '@/styles/globals.css';

const MyApp: AppType = ({Component, pageProps}) => {
  return (
    <ClerkProvider
      appearance={{variables: {fontFamily: GeistSans.style.fontFamily}}}
    >
      <div className={GeistSans.className}>
        <Component {...pageProps} />
      </div>
    </ClerkProvider>
  );
};

export default api.withTRPC(MyApp);
