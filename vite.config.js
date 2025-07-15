import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import VueRouter from 'unplugin-vue-router/vite';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { VueRouterAutoImports } from 'unplugin-vue-router';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    root: __dirname,
    publicDir: resolve(__dirname, 'public'),
    base: isProduction ? '/openbadges/' : '/',

    // Development server configuration
    server: {
      port: parseInt(process.env.VITE_PORT || '7777'),
      strictPort: false, // Allow Vite to try the next available port
      open: true,
      proxy: {
        '/api': {
          target: `http://localhost:${process.env.PORT || '8888'}`,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path,
        },
      },
    },

    // Build configuration
    build: {
      outDir: 'dist/client',
      emptyOutDir: true,
      sourcemap: !isProduction,
      target: 'esnext',
      minify: isProduction ? 'esbuild' : false,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
        output: {
          manualChunks: {
            vue: ['vue', 'vue-router', 'pinia'],
            vendor: ['@vueuse/core'],
          },
        },
      },
    },

    // Resolve configuration
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/client'),
        '@server': resolve(__dirname, 'src/server'),
      },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
    },

    // Dependencies optimization
    optimizeDeps: {
      include: [
        'vue',
        'vue-router',
        'pinia',
        '@vueuse/core',
        'openbadges-ui',
        // 'openbadges-types',
      ],
    },

    // Plugins
    plugins: [
      VueRouter({
        routesFolder: 'src/client/pages',
        dts: 'src/client/typed-router.d.ts',
        importMode: 'async',
      }),
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag.startsWith('ob-'),
          },
        },
      }),
      AutoImport({
        imports: ['vue', 'vue-router', '@vueuse/core', VueRouterAutoImports],
        dts: 'src/client/auto-imports.d.ts',
        dirs: ['src/client/composables', 'src/client/stores'],
        vueTemplate: true,
      }),
      Components({
        dirs: ['src/client/components'],
        dts: 'src/client/components.d.ts',
        resolvers: [
          // Auto import components from openbadges-ui
          (componentName) => {
            if (componentName.startsWith('Ob')) {
              return { name: componentName, from: 'openbadges-ui' };
            }
          },
        ],
      }),
    ],

    // CSS configuration
    css: {
      postcss: {
        plugins: [
          require('tailwindcss'),
          require('autoprefixer'),
        ],
      },
    },
  };
});
