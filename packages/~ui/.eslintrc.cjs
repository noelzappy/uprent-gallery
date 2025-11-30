module.exports = {
  root: true,
  plugins: ['@uprent/custom'],
  extends: ['plugin:@uprent/custom/recommended', 'plugin:svelte/recommended'],
  parserOptions: {
    extraFileExtensions: ['.svelte', '.svelte.ts'],
  },
  env: {
    webextensions: true,
    browser: true,
  },
  ignorePatterns: ['dist/*'],
  overrides: [
    {
      files: ['**/*.svelte', '**/*.svelte.ts'],
      parser: 'svelte-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
      },
    },
  ],
  rules: {
    'svelte/no-at-html-tags': 'off',
  },
  globals: {
    Optional: 'readonly',
    VoidCallback: 'readonly',
    EventListener: 'readonly',
  },
}
