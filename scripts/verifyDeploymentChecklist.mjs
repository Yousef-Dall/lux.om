import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();

const requiredRootScripts = [
  'verify:production',
  'verify:db-safety',
  'verify:deployment-checklist',
  'verify:seo',
  'verify:frontend-polish',
  'verify:frontend-cache',
  'test:smoke',
  'test:marketplace-smoke',
  'test:integration',
  'build',
  'db:migrate:deploy',
  'ops:db:backup'
];

const requiredProductionEnvChecks = [
  'weak production JWT secret',
  'missing production frontend URL',
  'localhost production CORS origin',
  'development email mode in production',
  'missing production SMTP config',
  'disabled production trust proxy hops',
  'production database points to test database',
  'missing production Thawani credentials',
  'missing production Thawani URLs',
  'localhost production Thawani checkout URL'
];

const requiredRuntimeEnvTokens = [
  'JWT_SECRET must be at least 48 characters long in production',
  'FRONTEND_URL is required in production',
  'EMAIL_DELIVERY_MODE must be smtp in production',
  'RATE_LIMIT_TRUST_PROXY_HOPS must be at least 1 in production',
  'DATABASE_URL must not point to a test database in production',
  'Thawani payment credentials are required in production',
  'Thawani payment URLs are required in production',
  'Cloudinary credentials are required when STORAGE_DRIVER=cloudinary'
];

const requiredDeploymentDocSections = [
  '# Production deployment checklist',
  '## Required production environment variables',
  '## Pre-deployment verification sequence',
  '## Database migration and backup sequence',
  '## Deployment order',
  '## Post-deployment smoke verification',
  '## Rollback checklist',
  '## Hosting and integration notes'
];

function read(relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[deployment-checklist] ${message}`);
    process.exitCode = 1;
  }
}

function assertFileExists(relativePath) {
  assert(existsSync(join(repoRoot, relativePath)), `${relativePath} must exist`);
}

assertFileExists('README.md');
assertFileExists('docs/production-deployment-checklist.md');
assertFileExists('backend/scripts/verifyProductionEnv.ts');
assertFileExists('backend/scripts/verifyMigrationSafety.ts');
assertFileExists('backend/scripts/backupDatabase.ts');
assertFileExists('frontend/scripts/verifyPublicSeo.ts');
assertFileExists('frontend/scripts/verifyBuildCachePolicy.ts');
assertFileExists('frontend/scripts/verifyFrontendPolish.ts');
assertFileExists('frontend/public/_headers');
assertFileExists('backend/prisma/migrations/migration_lock.toml');

const rootPackage = readJson('package.json');
const rootScripts = rootPackage.scripts ?? {};

for (const scriptName of requiredRootScripts) {
  assert(Boolean(rootScripts[scriptName]), `root package.json must define ${scriptName}`);
}

const verifyProduction = rootScripts['verify:production'] ?? '';
const requiredVerifyProductionSteps = [
  'verify:db-safety',
  'verify:deployment-checklist',
  'typecheck',
  'verify:seo',
  'verify:frontend-polish',
  'test:integration',
  'build',
  'verify:frontend-cache'
];

for (const step of requiredVerifyProductionSteps) {
  assert(
    verifyProduction.includes(step),
    `verify:production must include ${step}`
  );
}

const backendPackage = readJson('backend/package.json');
assert(
  (backendPackage.scripts?.['db:migrate:deploy'] ?? '').includes('prisma migrate deploy'),
  'backend db:migrate:deploy must use prisma migrate deploy'
);
assert(
  (backendPackage.scripts?.['ops:db:backup'] ?? '').includes('backupDatabase.ts'),
  'backend ops:db:backup must run the database backup helper'
);

const frontendPackage = readJson('frontend/package.json');
assert(
  (frontendPackage.scripts?.['verify:cache'] ?? '').includes('verifyBuildCachePolicy.ts'),
  'frontend verify:cache must run verifyBuildCachePolicy.ts'
);
assert(
  (frontendPackage.scripts?.['verify:polish'] ?? '').includes('verifyFrontendPolish.ts'),
  'frontend verify:polish must run verifyFrontendPolish.ts'
);
assert(
  (frontendPackage.scripts?.['verify:seo'] ?? '').includes('verifyPublicSeo.ts'),
  'frontend verify:seo must run verifyPublicSeo.ts'
);

const envSource = read('backend/src/config/env.ts');
for (const token of requiredRuntimeEnvTokens) {
  assert(envSource.includes(token), `backend env validation must include: ${token}`);
}

const verifyEnvSource = read('backend/scripts/verifyProductionEnv.ts');
for (const token of requiredProductionEnvChecks) {
  assert(verifyEnvSource.includes(token), `verifyProductionEnv.ts must cover: ${token}`);
}

const migrationSafetySource = read('backend/scripts/verifyMigrationSafety.ts');
assert(
  migrationSafetySource.includes('prisma migrate deploy'),
  'verifyMigrationSafety.ts must assert production migration deploy usage'
);
assert(
  migrationSafetySource.includes('prisma migrate reset') && migrationSafetySource.includes('db push --force-reset'),
  'verifyMigrationSafety.ts must guard against destructive Prisma reset commands'
);

const backupSource = read('backend/scripts/backupDatabase.ts');
assert(
  backupSource.includes('pg_dump'),
  'backupDatabase.ts must use pg_dump for production backups'
);
assert(
  backupSource.includes('PG_DUMP_PATH'),
  'backupDatabase.ts must document/support PG_DUMP_PATH for Windows and managed workstations'
);
assert(
  backupSource.includes('--format=custom'),
  'backupDatabase.ts must create custom-format PostgreSQL dumps'
);

const headersSource = read('frontend/public/_headers');
assert(
  headersSource.includes('/index.html') && headersSource.includes('must-revalidate'),
  'frontend _headers must force index.html revalidation'
);
assert(
  headersSource.includes('/assets/*') && headersSource.includes('immutable'),
  'frontend _headers must cache hashed assets immutably'
);

const readme = read('README.md');
assert(
  readme.includes('docs/production-deployment-checklist.md'),
  'README.md must link to the production deployment checklist'
);
assert(
  readme.includes('npm run verify:deployment-checklist'),
  'README.md must document the deployment checklist verifier'
);
assert(
  readme.includes('Post-deployment smoke verification'),
  'README.md must document post-deployment smoke verification'
);

const deploymentDoc = read('docs/production-deployment-checklist.md');
for (const section of requiredDeploymentDocSections) {
  assert(deploymentDoc.includes(section), `production deployment checklist must include ${section}`);
}

for (const command of [
  'npm run verify:production',
  'npm run db:migrate:status -w backend',
  'npm run ops:db:backup -w backend',
  'npm run db:migrate:deploy',
  'npm run test:smoke',
  'npm run test:marketplace-smoke',
  'npm run verify:frontend-cache'
]) {
  assert(deploymentDoc.includes(command), `production deployment checklist must include ${command}`);
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('[lux.om] Production deployment checklist verification passed.');
