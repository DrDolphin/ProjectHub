// @ts-check
import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

// Flat ESLint config (ESLint 9+). Baseline = JS + TypeScript recommended.
// React hooks rules are scoped to the renderer only.
//
// Type-checked linting (recommendedTypeChecked) and the full react-hooks v7
// rule set are intentionally NOT enabled yet — they're the next hardening pass
// once the baseline gate is green.
export default defineConfig([
  globalIgnores(['dist', 'out', 'build', 'node_modules', 'coverage']),

  // Base: JS + TypeScript recommended for all TS/TSX source (incl. config files).
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module'
    },
    rules: {
      // Allow intentionally-unused params/vars prefixed with `_`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ]
    }
  },

  // Electron main + preload: Node globals (process, __dirname, Buffer, ...).
  {
    files: ['src/main/**/*.{ts,tsx}', 'src/preload/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.node
    }
  },

  // Renderer: browser globals + React hooks rules (the two classic, low-noise
  // rules; the expanded v7 set lands in a later hardening pass).
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  }
])
