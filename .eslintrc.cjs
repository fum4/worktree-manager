/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: ['@repo/eslint-config/remix'],
  parserOptions: {
    project: true,
  },
  ignorePatterns: ['*.config.js', '*.config.ts', 'dist/**'],
  rules: {
    'no-restricted-imports': 'off',
  },
};
