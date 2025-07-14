const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'script',
      globals: globals.node,
    },
    ignores: ['node_modules', 'package-lock.json'],
    rules: {
      ...js.configs.recommended.rules,
      'no-empty': 'off',
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
    },
  },
];
