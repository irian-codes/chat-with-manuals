import Head from 'next/head';
import React from 'react';

export default function MainLayout({children}: {children: React.ReactNode}) {
  return (
    <React.Fragment>
      <Head>
        <title>Chat With Manuals</title>
        <meta
          name="description"
          content="App to chat via AI chatbot with structured documents like product manuals"
        />
        <link rel="icon" href="/favicon.ico" />
        {/* TODO issue #2: Add Open Graph tags and other important tags */}
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c]">
        {children}
      </main>
    </React.Fragment>
  );
}
