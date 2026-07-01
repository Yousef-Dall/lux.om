import path from 'node:path';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

type PackageJson = {
  version?: string;
};

function readPackageVersion() {
  const packageJson = JSON.parse(
    readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')
  ) as PackageJson;

  return packageJson.version ?? '0.0.0';
}

function createBuildMetadata(mode: string) {
  const env = loadEnv(mode, process.cwd(), '');
  const appVersion = env.VITE_APP_VERSION || readPackageVersion();
  const buildId =
    env.VITE_BUILD_ID ||
    process.env.GITHUB_SHA?.slice(0, 12) ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
    process.env.CF_PAGES_COMMIT_SHA?.slice(0, 12) ||
    'local';
  const buildTime = env.VITE_BUILD_TIME || new Date().toISOString();

  return {
    apiUrl: env.VITE_API_PROXY_TARGET || 'http://localhost:4000',
    appVersion,
    buildId,
    buildTime
  };
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function luxBuildMetadataPlugin(metadata: {
  appVersion: string;
  buildId: string;
  buildTime: string;
}): Plugin {
  return {
    name: 'lux-build-metadata',
    transformIndexHtml(html) {
      const appVersion = escapeHtmlAttribute(metadata.appVersion);
      const buildId = escapeHtmlAttribute(metadata.buildId);
      const buildTime = escapeHtmlAttribute(metadata.buildTime);

      const tags = [
        `<meta name="lux:app-version" content="${appVersion}" />`,
        `<meta name="lux:build-id" content="${buildId}" />`,
        `<meta name="lux:build-time" content="${buildTime}" />`,
        '<meta name="lux:cache-policy" content="index-revalidate-assets-immutable" />'
      ].join('\n    ');

      return html.replace('</head>', `    ${tags}\n  </head>`);
    }
  };
}

export default defineConfig(({ mode }) => {
  const metadata = createBuildMetadata(mode);

  return {
    plugins: [react(), luxBuildMetadataPlugin(metadata)],
    define: {
      __LUX_APP_VERSION__: JSON.stringify(metadata.appVersion),
      __LUX_BUILD_ID__: JSON.stringify(metadata.buildId),
      __LUX_BUILD_TIME__: JSON.stringify(metadata.buildTime)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      open: true,
      proxy: {
        '/api': metadata.apiUrl,
        '/uploads': metadata.apiUrl,
        '/health': metadata.apiUrl
      }
    },
    preview: {
      port: 4173,
      host: '0.0.0.0'
    },
    build: {
      sourcemap: false,
      target: 'es2020',
      cssCodeSplit: true,
      assetsInlineLimit: 4096,
      manifest: true,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
          manualChunks(id: string) {
            if (id.includes('node_modules/react')) return 'react';
            if (id.includes('node_modules/react-dom')) return 'react';
            if (id.includes('node_modules/react-router-dom')) return 'react';
            if (id.includes('node_modules/lucide-react')) return 'icons';

            return undefined;
          }
        }
      }
    }
  };
});
