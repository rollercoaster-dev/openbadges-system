import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import ts from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import vueParser from 'vue-eslint-parser'

export default [
  // Base JavaScript rules
  js.configs.recommended,

  // Vue recommended rules
  ...vue.configs['flat/recommended'],

  // Global configuration for browser environment
  {
    files: ['src/client/**/*.{ts,js,vue}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        crypto: 'readonly',
        TextEncoder: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        ReadableStream: 'readonly',
        PublicKeyCredential: 'readonly',
        AuthenticatorTransport: 'readonly',
        PublicKeyCredentialParameters: 'readonly',
        AttestationConveyancePreference: 'readonly',
        PublicKeyCredentialDescriptor: 'readonly',
        AuthenticatorSelectionCriteria: 'readonly',
        UserVerificationRequirement: 'readonly',
        PublicKeyCredentialCreationOptions: 'readonly',
        AuthenticatorAttestationResponse: 'readonly',
        PublicKeyCredentialRequestOptions: 'readonly',
        AuthenticatorAssertionResponse: 'readonly',
        AuthenticatorAttachment: 'readonly',
        // Vue auto-imports
        ref: 'readonly',
        reactive: 'readonly',
        computed: 'readonly',
        watch: 'readonly',
        watchEffect: 'readonly',
        onMounted: 'readonly',
        onUnmounted: 'readonly',
        nextTick: 'readonly',
        useRoute: 'readonly',
        useRouter: 'readonly',
        RouterLink: 'readonly',
        RouterView: 'readonly',
      },
    },
  },

  // Node.js environment for server files
  {
    files: ['src/server/**/*.ts', 'database/**/*.ts', 'scripts/**/*.ts', '*.ts'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        URL: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        fetch: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        ReadableStream: 'readonly',
      },
    },
  },

  // Test environment
  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'src/test/**/*.ts'],
    languageOptions: {
      globals: {
        console: 'readonly',
        global: 'readonly',
        localStorage: 'readonly',
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        ReadableStream: 'readonly',
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },

  // TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': ts,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-unused-vars': 'off', // Turn off base rule as it can conflict with TypeScript rule
    },
  },

  // Vue files with TypeScript
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    plugins: {
      vue,
      '@typescript-eslint': ts,
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'warn',
      'vue/component-definition-name-casing': ['error', 'PascalCase'],
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/max-attributes-per-line': [
        'error',
        {
          singleline: { max: 3 },
          multiline: { max: 1 },
        },
      ],
      // Relax some Vue formatting rules for better development experience
      'vue/html-indent': ['warn', 2],
      'vue/singleline-html-element-content-newline': 'warn',
      'vue/html-self-closing': [
        'warn',
        {
          html: {
            void: 'always',
            normal: 'never',
            component: 'always',
          },
          svg: 'always',
          math: 'always',
        },
      ],
      'vue/attributes-order': 'warn',
      'vue/html-closing-bracket-newline': 'warn',
      'vue/first-attribute-linebreak': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
    },
  },

  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.nuxt/**',
      '*.min.js',
      'public/**',
      'coverage/**',
      '*.d.ts',
      'openbadges_server_data/**',
      'data/**',
      'eslint.config.js',
      'vite.config.js',
      'vitest.config.ts',
      'tailwind.config.js',
      'postcss.config.cjs',
      'commitlint.config.js',
    ],
  },
]
