import { defineConfig } from 'eslint/config'
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

const tsconfigRootDir = toFileDirectoryPath(import.meta.url)

export default defineConfig([
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/artifacts',
      '**/.tmp',
      '**/tmp',
      '**/.kisaki',
      'extensions/**'
    ]
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,js,mjs,cjs}'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir
      }
    },
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ]
    }
  },
  prettier
])

function toFileDirectoryPath(url: string): string {
  return decodeURIComponent(url)
    .replace(/^file:\/\/\/([A-Za-z]:)/, '$1')
    .replace(/^file:\/\//, '')
    .replace(/\/[^/]*$/, '')
}
