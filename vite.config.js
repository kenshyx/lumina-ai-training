import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    wasm(),
    topLevelAwait(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      include: ['path', 'util', 'stream', 'buffer', 'process'],
      exclude: ['module'],
      protocolImports: true,
    }),
  ],
  optimizeDeps: {
    exclude: ['@huggingface/transformers', '@xenova/transformers', 'voy-search'],
    include: ['p-queue'],
    esbuildOptions: {
      alias: {
        'node:module': path.resolve(__dirname, './src/polyfills/node-module.js'),
      },
      mainFields: ['module', 'main'],
    },
  },
  resolve: {
    alias: {
      'node:module': path.resolve(__dirname, './src/polyfills/node-module.js'),
    },
    mainFields: ['module', 'main'],
  },
  build: {
    target: 'es2022',
    commonjsOptions: {
      include: [/p-queue/, /node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        format: 'es',
      },
    },
  },
  worker: {
    format: 'es',
    plugins: () => [
      wasm(),
      topLevelAwait(),
      nodePolyfills({
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
        include: ['path', 'util', 'stream', 'buffer', 'process'],
        exclude: ['module'],
        protocolImports: true,
      }),
    ],
  },
  server: {
    fs: {
      allow: ['..'],
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  },
  preview: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  }
})
