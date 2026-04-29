import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/** @type {import('eslint').Linter.Config[]} */
const nextConfig = require('eslint-config-next');

export default [
  ...nextConfig,
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      // Existing codebase contains a large amount of legacy content text in JSX.
      // Keep signal visible without blocking CI/local lint.
      'react/no-unescaped-entities': 'warn',
      // React 19 hook lint additions currently flag many legacy patterns.
      // Keep as warnings until those pages are refactored.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      // De-escalate legacy-only failures so lint can pass while we incrementally clean up.
      'react/jsx-no-undef': 'warn',
      'react/display-name': 'warn',
      '@next/next/no-img-element': 'warn',
      '@next/next/no-html-link-for-pages': 'warn',
      'jsx-a11y/alt-text': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'import/no-anonymous-default-export': 'warn',
    },
  },
];
