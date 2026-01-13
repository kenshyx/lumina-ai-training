import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Plugin to generate client-metadata.json dynamically from environment variables
 */
function clientMetadataPlugin(env) {
  return {
    name: 'client-metadata',
    configureServer(server) {
      server.middlewares.use('/client-metadata.json', (req, res, next) => {
        const clientId = env.VITE_ATPROTO_CLIENT_ID || 'https://lumina-rag.app/client-metadata.json';
        const clientUri = env.VITE_ATPROTO_CLIENT_URI || 'https://lumina-rag.app';
        const redirectOrigin = req.headers.host 
          ? `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`
          : 'http://127.0.0.1:5173';
        
        const metadata = {
          client_id: clientId,
          client_name: 'Lumina RAG',
          client_uri: clientUri,
          redirect_uris: [
            `${redirectOrigin}${req.url.includes('?') ? req.url.split('?')[0] : '/'}`
          ],
          scope: 'atproto',
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none',
          application_type: 'web',
          dpop_bound_access_tokens: true,
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(metadata, null, 2));
      });
    },
    buildStart() {
      // Generate static file for build
      const clientId = env.VITE_ATPROTO_CLIENT_ID || 'https://lumina-rag.app/client-metadata.json';
      const clientUri = env.VITE_ATPROTO_CLIENT_URI || 'https://lumina-rag.app';
      
      const metadata = {
        client_id: clientId,
        client_name: 'Lumina RAG',
        client_uri: clientUri,
        redirect_uris: ['http://127.0.0.1:5173/'],
        scope: 'atproto',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        application_type: 'web',
        dpop_bound_access_tokens: true,
      };

      const publicDir = path.resolve(__dirname, 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(publicDir, 'client-metadata.json'),
        JSON.stringify(metadata, null, 2)
      );
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
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
      clientMetadataPlugin(env),
    ],
  optimizeDeps: {
    exclude: ['@huggingface/transformers', '@xenova/transformers', '@duckdb/duckdb-wasm'],
    include: ['p-queue', 'apache-arrow'],
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
      allowedHosts: (() => {
        const hosts = ['localhost', '127.0.0.1', 'anymore-thing-dressed-hospital.trycloudflare.com'];
        // Add hostname from VITE_ATPROTO_CLIENT_URI if set
        if (env.VITE_ATPROTO_CLIENT_URI) {
          try {
            const clientUriHost = new URL(env.VITE_ATPROTO_CLIENT_URI).hostname;
            if (!hosts.includes(clientUriHost)) {
              hosts.push(clientUriHost);
            }
          } catch (err) {
            // Invalid URL, skip
          }
        }
        return hosts;
      })(),
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
    },
  };
});
