import CountContextWrapper from '@/components/CountContext';
import type {Metadata} from 'next';
import {Inter} from 'next/font/google';
import './globals.css';

const inter = Inter({subsets: ['latin']});

export const metadata: Metadata = {
  title: 'LLM RAG TEST',
  description: 'Test app to quickly test an LLM RAG',
  generator: 'Next.js',
  creator: 'irian-codes',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <CountContextWrapper>{children}</CountContextWrapper>
      </body>
    </html>
  );
}
