import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite';
import path from 'node:path';

export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    // 预编译 locales 下的消息为 AST，并使用 runtime-only 版 vue-i18n（去掉运行时编译器）
    VueI18nPlugin({
      include: [path.resolve(__dirname, 'src/locales/**')],
    }),
  ],
  clearScreen: false,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: '127.0.0.1',
  },
  // 生产构建去掉 console/debugger；dev 环境保留以便调试
  esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : undefined,
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia', 'vue-i18n', 'vue-sonner'],
          'vendor-ui': ['reka-ui', 'lucide-vue-next', '@vueuse/core'],
          'vendor-editor': ['codemirror', 'codemirror-editor-vue3'],
          'vendor-utils': ['lodash-es', 'js-yaml', 'uuid', 'vue-draggable-plus'],
        },
      },
    },
  },
}));
