import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),

  // Plain TypeScript files.
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },

  // Svelte components. eslint-plugin-svelte installs svelte-eslint-parser,
  // which is what lets unused-vars see template usage, so it must not be
  // overridden by the TypeScript parser above.
  {
    files: ['**/*.svelte'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      ...svelte.configs['flat/recommended'],
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      // Without this, svelte-eslint-parser parses <script lang="ts"> as plain
      // JS and chokes on TypeScript-only syntax like `as const`.
      parserOptions: { parser: tseslint.parser },
    },
    rules: {
      /**
       * svelte-eslint-parser does not expose template references through the
       * TypeScript scope manager, so this rule reports every variable used only
       * in the markup. `svelte-check` (`bun run check`) catches genuinely unused
       * variables in .svelte files through `noUnusedLocals`, so nothing is lost.
       */
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  prettier,
])
