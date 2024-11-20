import type en from './src/i18n/messages/en.json';

// Telling next-intl that the messages are in the en.json file so we have type safety
// https://next-intl-docs.vercel.app/docs/workflows/typescript
declare global {
  // Use type safe message keys with `next-intl`
  type IntlMessages = typeof en;
}
