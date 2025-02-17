import path from 'node:path';

const buildEslintCommand = (filePaths) =>
  `next lint --file ${filePaths
    .map((filePath) => path.relative(process.cwd(), filePath))
    .join(' --file ')}`;

/**
 * @filename: lint-staged.config.js
 * @type {import('lint-staged').Configuration}
 */
const config = {
  '*.{ts,tsx,mdx}': ['prettier --write --cache', buildEslintCommand],
  '*.json': ['prettier --write --cache'],
};

export default config;
