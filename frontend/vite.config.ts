import path from 'path';
import { createRequire } from 'module';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// CesiumJS loads its web workers and a few textures at run time, so they are served from /cesium.
const cesiumBuild = path.join(
  path.dirname(createRequire(import.meta.url).resolve('cesium/package.json')),
  'Build/Cesium'
);
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    return {
      define: {
        // This is just generic value for the GEMINI API key.
        // This is not used at all, and can be ignored!
        'process.env.API_KEY' : JSON.stringify('api-key-this-is-not-used-can-be-ignored!'),
        CESIUM_BASE_URL: JSON.stringify('/cesium'),
      },
      server: {
        proxy: {
          //Target your Node.js backend
          '/api-proxy': 'http://localhost:5000',
          '/api/': 'http://localhost:5000',
          '/ws-proxy': {target: 'ws://localhost:5000', ws: true},
        },
      },
      plugins: [
        react(),
        viteStaticCopy({
          targets: ['Workers', 'ThirdParty', 'Assets'].map(dir => ({
            src: `${cesiumBuild.replace(/\\/g, '/')}/${dir}`,
            dest: 'cesium',
            // keep Workers/, ThirdParty/ and Assets/ directly under /cesium
            rename: { stripBase: 4 },
          })),
        }),
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
