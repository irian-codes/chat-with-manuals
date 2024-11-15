/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import './src/env.js';

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,

  i18n: {
    locales: ['en', 'es'],
    defaultLocale: 'en',
  },
  transpilePackages: ['geist'],
  images: {
    // TODO Issue #4: Update this to the current API
    domains: ['picsum.photos'],
  },
};

export default config;
