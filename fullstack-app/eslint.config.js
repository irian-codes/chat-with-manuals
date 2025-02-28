import {FlatCompat} from '@eslint/eslintrc';
import tseslint from 'typescript-eslint';
import noHeeeyConsoleRule from './eslint-rules/no-heeey-console.js';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.config({
    extends: ['next/core-web-vitals', 'next/typescript', 'prettier'],
    ignorePatterns: ['*.config.*', 'tsconfig.json'],
  }),
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...compat.config({
    rules: {
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],
    },
  }),
  // Custom rule to prevent `console.log('heeey ...');` so this way lint-staged can catch it
  {
    // Load local plugins. Here, we create a plugin namespace "custom" that contains our rule(s)
    plugins: {
      custom: {
        rules: {
          'no-heeey-console': noHeeeyConsoleRule,
        },
      },
    },
    // Enable the custom rule
    rules: {
      'custom/no-heeey-console': 'error',
    },
  },
];

export default eslintConfig;
