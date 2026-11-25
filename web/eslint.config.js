// ESLint flat config for the ORBITAL web workspace (ADR-0007).
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const noDangerousHtml = {
  selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
  message: 'dangerouslySetInnerHTML is banned (requirements WA-E7).',
};

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/.lighthouseci/**',
      '**/.wrangler/**',
      'spikes/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: [
          './packages/engine/tsconfig.test.json',
          './apps/web/tsconfig.json',
          './apps/web/tsconfig.node.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-syntax': ['error', noDangerousHtml],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: globals.node,
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
    languageOptions: { globals: globals.browser },
  },
  {
    // Engine boundary (ADR-0003): no React, three, DOM-facing or app imports; no packages at all.
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.{1,2}/)',
              message:
                '@orbital/engine may import only its own files (ADR-0003). No React, three, app code or packages.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'navigator', 'self', 'globalThis', 'fetch', 'postMessage'].map(
          (name) => ({
            name,
            message: `@orbital/engine must not touch the host environment (${name}).`,
          }),
        ),
      ],
    },
  },
);
