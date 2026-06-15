import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const envPath = fileURLToPath(
  new URL('../../.env.test', import.meta.url)
);

const testEnvironment = dotenv.parse(
  readFileSync(envPath, 'utf8')
);

const databaseUrl = new URL(testEnvironment.DATABASE_URL);
const databaseName = databaseUrl.pathname.replace(/^\/+/, '');

if (!databaseName.endsWith('_test')) {
  throw new Error(
    `Refusing to run integration tests against non-test database: ${databaseName}`
  );
}

Object.assign(process.env, testEnvironment);
