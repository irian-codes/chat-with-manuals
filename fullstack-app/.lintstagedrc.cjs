const path = require('path');

const buildEslintCommand = (filenames) =>
  `next lint --file ${filenames
    .map((f) => path.relative(process.cwd(), f))
    .join(' --file ')}`;

module.exports = {
  '*.{ts,js,tsx,jsx,mdx}': ['prettier --write --cache', buildEslintCommand],
  '*.json': ['prettier --write --cache'],
};
