module.exports = {
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  rules: {
    // Fix for 'prefer-const' error
    'prefer-const': 'error',
    
    // Customize TypeScript rules
    '@typescript-eslint/no-unused-vars': ['error', {
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_',
    }],
    
    // You can either enforce strict 'no-explicit-any' or disable it
    '@typescript-eslint/no-explicit-any': 'warn', // Set to 'off' if you need to use 'any' temporarily
    
    // Additional recommended rules
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-function': 'warn',
  },
  settings: {
    next: {
      rootDir: ['./'],
    },
  },
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'out/',
    'public/',
    '*.config.js',
    '*.config.ts',
  ],
} 