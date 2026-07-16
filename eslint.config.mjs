import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

function asWarnings(rules) {
  return Object.fromEntries(
    Object.entries(rules).map(([name, setting]) => {
      if (setting === 0 || setting === 'off') return [name, setting];
      if (Array.isArray(setting)) return [name, ['warn', ...setting.slice(1)]];
      return [name, 'warn'];
    })
  );
}

const typescriptRecommendedRules = Object.assign(
  {},
  ...tseslint.configs.recommended.map((config) => config.rules ?? {})
);

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'frontend/src/generated/**',
      'frontend/project-structure.txt'
    ]
  },
  {
    files: ['frontend/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./frontend/tsconfig.lint.json'],
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'warn'
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'jsx-a11y': jsxA11y,
      react,
      'react-hooks': reactHooks
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      ...asWarnings(js.configs.recommended.rules),
      ...asWarnings(typescriptRecommendedRules),
      ...asWarnings(react.configs.flat.recommended.rules),
      ...asWarnings(react.configs.flat['jsx-runtime'].rules),
      ...asWarnings(jsxA11y.flatConfigs.recommended.rules),
      ...eslintConfigPrettier.rules,
      'no-undef': 'off',
      'react/prop-types': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      '@typescript-eslint/await-thenable': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { fixStyle: 'inline-type-imports', prefer: 'type-imports' }
      ],
      '@typescript-eslint/no-floating-promises': ['warn', { ignoreVoid: true }],
      '@typescript-eslint/no-misused-promises': [
        'warn',
        { checksVoidReturn: { attributes: false } }
      ]
    }
  }
];
