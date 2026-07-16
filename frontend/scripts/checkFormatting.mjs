import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import prettier from 'prettier';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../..');
const manifestPath = path.join(repositoryRoot, 'frontend/format-baseline.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const shouldWrite = process.argv.includes('--write');
const changedFiles = [];

if (!Array.isArray(manifest.files) || manifest.files.some((file) => typeof file !== 'string')) {
  throw new Error('frontend/format-baseline.json must contain a string files array.');
}

for (const relativePath of manifest.files) {
  const absolutePath = path.resolve(repositoryRoot, relativePath);
  const relativeToRepository = path.relative(repositoryRoot, absolutePath);

  if (relativeToRepository.startsWith('..') || path.isAbsolute(relativeToRepository)) {
    throw new Error(`Formatting baseline path escapes the repository: ${relativePath}`);
  }

  const source = await readFile(absolutePath, 'utf8');
  const options = (await prettier.resolveConfig(absolutePath)) ?? {};
  const formatted = await prettier.format(source, { ...options, filepath: absolutePath });

  if (source === formatted) continue;
  changedFiles.push(relativePath);
  if (shouldWrite) await writeFile(absolutePath, formatted, 'utf8');
}

if (changedFiles.length === 0) {
  console.log('[lux.om] Controlled frontend formatting baseline is current.');
} else if (shouldWrite) {
  console.log(`[lux.om] Formatted ${changedFiles.length} controlled baseline file(s).`);
} else {
  console.error('[lux.om] Formatting is required for:');
  for (const file of changedFiles) console.error(`  - ${file}`);
  console.error('Run npm run format to update the controlled baseline.');
  process.exitCode = 1;
}
