// Deliberately lightweight Node/ESM lint; correctness is exercised by tests.
export default [{
  files: ['**/*.{js,mjs}'],
  ignores: ['node_modules/**', 'coverage/**', 'vendor/**', '.cache/**'],
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-constant-condition': 'error',
    'no-unreachable': 'error',
    'no-unsafe-finally': 'error'
  }
}];
