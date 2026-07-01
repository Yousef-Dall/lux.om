import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const indexPath = path.join(distDir, 'index.html');
const assetsDir = path.join(distDir, 'assets');
const headersPath = path.join(distDir, '_headers');

function fail(message: string): never {
  console.error(`[lux.om] Frontend cache/versioning verification failed: ${message}`);
  process.exit(1);
}

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return listFiles(fullPath);
    }

    return fullPath;
  });
}

if (!existsSync(indexPath)) {
  fail('frontend/dist/index.html was not found. Run npm run build -w frontend first.');
}

if (!existsSync(assetsDir)) {
  fail('frontend/dist/assets was not found. Vite hashed assets are missing.');
}

const indexHtml = readFileSync(indexPath, 'utf8');
const assetFiles = listFiles(assetsDir).map((filePath) =>
  path.relative(distDir, filePath).replace(/\\/g, '/')
);
const hashedAssetPattern = /^assets\/[\w.-]+-[A-Za-z0-9_-]{6,}\.(?:js|css|svg|png|jpg|jpeg|webp|gif|woff2?)$/;
const hashedJsPattern = /^assets\/[\w.-]+-[A-Za-z0-9_-]{6,}\.js$/;
const hashedCssPattern = /^assets\/[\w.-]+-[A-Za-z0-9_-]{6,}\.css$/;

if (indexHtml.includes('/src/main.tsx')) {
  fail('index.html still points at the development /src/main.tsx entry.');
}

if (!indexHtml.includes('name="lux:app-version"')) {
  fail('index.html is missing lux:app-version build metadata.');
}

if (!indexHtml.includes('name="lux:build-id"')) {
  fail('index.html is missing lux:build-id build metadata.');
}

if (!indexHtml.includes('name="lux:cache-policy"')) {
  fail('index.html is missing lux:cache-policy metadata.');
}

if (!assetFiles.some((file) => hashedJsPattern.test(file))) {
  fail('no hashed JavaScript assets were emitted.');
}

if (!assetFiles.some((file) => hashedCssPattern.test(file))) {
  fail('no hashed CSS assets were emitted.');
}

const unhashedCacheableAssets = assetFiles.filter((file) => {
  const extension = path.extname(file).toLowerCase();
  const shouldBeHashed = ['.js', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.woff', '.woff2'].includes(extension);

  return shouldBeHashed && !hashedAssetPattern.test(file);
});

if (unhashedCacheableAssets.length > 0) {
  fail(`cacheable assets must include a content hash: ${unhashedCacheableAssets.join(', ')}`);
}

const sourceMaps = assetFiles.filter((file) => file.endsWith('.map'));

if (sourceMaps.length > 0) {
  fail(`production sourcemaps must not be emitted by default: ${sourceMaps.join(', ')}`);
}

if (!existsSync(headersPath)) {
  fail('dist/_headers was not emitted. Static-host cache rules are missing.');
}

const headersFile = readFileSync(headersPath, 'utf8');

if (!headersFile.includes('/assets/*') || !headersFile.includes('immutable')) {
  fail('dist/_headers must cache hashed assets as immutable.');
}

if (!headersFile.includes('/index.html') || !headersFile.includes('must-revalidate')) {
  fail('dist/_headers must force index.html revalidation.');
}

console.log('[lux.om] Frontend cache/versioning verification passed.');
