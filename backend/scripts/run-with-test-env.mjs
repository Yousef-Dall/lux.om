import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const envPath = fileURLToPath(
  new URL('../.env.test', import.meta.url)
);

const testEnv = dotenv.parse(readFileSync(envPath, 'utf8'));
const databaseUrl = new URL(testEnv.DATABASE_URL);
const databaseName = databaseUrl.pathname.replace(/^\/+/, '');

if (!databaseName.endsWith('_test')) {
  throw new Error(
    `Refusing to run against non-test database: ${databaseName}`
  );
}

const command = process.argv.slice(2).join(' ');

if (!command) {
  throw new Error('A command is required');
}

const result = spawnSync(command, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    ...testEnv
  },
  stdio: 'inherit',
  shell: true
});

process.exit(result.status ?? 1);
