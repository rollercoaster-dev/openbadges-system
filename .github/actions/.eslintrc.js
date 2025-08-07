module.exports = {
  env: {
    node: true,
    es2021: true,
    commonjs: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script',
  },
  globals: {
    require: 'readonly',
    process: 'readonly',
    console: 'readonly',
    __dirname: 'readonly',
    __filename: 'readonly',
    module: 'readonly',
    exports: 'readonly',
    Buffer: 'readonly',
    global: 'readonly',
  },
  rules: {
    'no-undef': 'error',
    'no-console': 'off',
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
  },
}
