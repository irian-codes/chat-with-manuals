/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
const config = {
  plugins: ['prettier-plugin-tailwindcss'],
  printWidth: 80,
  singleQuote: true,
  jsxSingleQuote: false,
  trailingComma: 'es5',
  useTabs: false,
  tabWidth: 2,
  endOfLine: 'lf',
  semi: true,
  arrowParens: 'always',
  bracketSpacing: false,
};

export default config;
