import { defineConfig } from 'vite';
import { resolve } from 'path';

// Build configuration for popup and offscreen HTML pages
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyDirFirst: false,
    minify: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup.html'),
        offscreen: resolve(__dirname, 'src/offscreen.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  publicDir: 'public',
});
