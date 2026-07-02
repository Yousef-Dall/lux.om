import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();

const requiredRootScripts = [
  'verify:production',
  'verify:deployment-checklist',
  'verify:release-candidate',
  'verify:db-safety',
  'verify:seo',
  'verify:frontend-polish',
  'verify:frontend-cache',
  'test:smoke',
  'test:marketplace-smoke',
  'test:integration',
  'build'
];

const requiredReleaseDocSections = [
  '# Release candidate launch readiness report',
  '## Release candidate scope',
  '## Production hardening completed',
  '## Automated verification commands',
  '## Go/no-go checklist',
  '## Deployment sign-off sequence',
  '## Known limitations and deferred post-launch items',
  '## Launch decision'
];

const completedHardeningItems = [
  'AR — production HTTP security headers and cache hardening',
  'AS — CORS, trusted proxy, HTTPS, and secure cookie hardening',
  'AT — API payload limits, request validation, and error response hardening',
  'AU — static uploads/media serving security and cache policy',
  'AV — frontend production cache/versioning safety',
  'AW — production logging, request IDs, and sensitive data redaction',
  'AX — Prisma migration, database backup, and deploy rollback safety',
  'AY — payment/webhook integrity re-audit',
  'AZ — admin authorization and role-permission regression audit',
  'BA — critical auth/account/verification/trust notification flow smoke tests',
  'BB — critical marketplace booking/payment/reporting flow smoke tests',
  'BC — accessibility, mobile, empty/error/loading final polish',
  'BD — environment validation and production deployment checklist'
];

const requiredCommands = [
  'npm run verify:production',
  'npm run verify:deployment-checklist',
  'npm run verify:release-candidate',
  'npm run test:smoke',
  'npm run test:marketplace-smoke',
  'npm run verify:frontend-cache',
  'npm run verify:frontend-polish',
  'npm run db:migrate:status -w backend',
  'npm run ops:db:backup -w backend',
  'npm run db:migrate:deploy'
];

const requiredGoNoGoTokens = [
  'GO',
  'NO-GO',
  '/api/ready',
  'production SMTP',
  'Cloudinary',
  'Thawani',
  'Google OAuth',
  'rollback owner',
  'database backup'
];

function read(relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[release-candidate] ${message}`);
    process.exitCode = 1;
  }
}

function assertFileExists(relativePath) {
  assert(existsSync(join(repoRoot, relativePath)), `${relativePath} must exist`);
}

assertFileExists('README.md');
assertFileExists('docs/production-deployment-checklist.md');
assertFileExists('docs/production-operations-runbook.md');
assertFileExists('docs/admin-health-checklist.md');
assertFileExists('docs/release-candidate-launch-readiness.md');
assertFileExists('scripts/verifyDeploymentChecklist.mjs');
assertFileExists('scripts/verifyReleaseCandidate.mjs');
assertFileExists('frontend/scripts/verifyFrontendPolish.ts');
assertFileExists('frontend/scripts/verifyBuildCachePolicy.ts');
assertFileExists('frontend/scripts/verifyPublicSeo.ts');
assertFileExists('backend/scripts/verifyProductionEnv.ts');
assertFileExists('backend/scripts/verifyMigrationSafety.ts');
assertFileExists('backend/scripts/backupDatabase.ts');

const rootPackage = readJson('package.json');
const rootScripts = rootPackage.scripts ?? {};

for (const scriptName of requiredRootScripts) {
  assert(Boolean(rootScripts[scriptName]), `root package.json must define ${scriptName}`);
}

const verifyProduction = rootScripts['verify:production'] ?? '';
for (const step of [
  'verify:deployment-checklist',
  'verify:release-candidate',
  'verify:db-safety',
  'typecheck',
  'verify:seo',
  'verify:frontend-polish',
  'test:integration',
  'build',
  'verify:frontend-cache'
]) {
  assert(verifyProduction.includes(step), `verify:production must include ${step}`);
}

const backendPackage = readJson('backend/package.json');
assert(
  (backendPackage.scripts?.['test:smoke'] ?? '').includes('critical-launch-smoke'),
  'backend test:smoke must target critical-launch-smoke tests'
);
assert(
  (backendPackage.scripts?.['test:marketplace-smoke'] ?? '').includes('critical-marketplace-smoke'),
  'backend test:marketplace-smoke must target critical-marketplace-smoke tests'
);

const releaseDoc = read('docs/release-candidate-launch-readiness.md');
for (const section of requiredReleaseDocSections) {
  assert(releaseDoc.includes(section), `release candidate document must include ${section}`);
}
for (const item of completedHardeningItems) {
  assert(releaseDoc.includes(item), `release candidate document must include ${item}`);
}
for (const command of requiredCommands) {
  assert(releaseDoc.includes(command), `release candidate document must include ${command}`);
}
for (const token of requiredGoNoGoTokens) {
  assert(releaseDoc.includes(token), `release candidate document must mention ${token}`);
}

const readme = read('README.md');
assert(
  readme.includes('docs/release-candidate-launch-readiness.md'),
  'README.md must link to the release candidate launch readiness report'
);
assert(
  readme.includes('npm run verify:release-candidate'),
  'README.md must document the release candidate verifier'
);

const deploymentDoc = read('docs/production-deployment-checklist.md');
assert(
  deploymentDoc.includes('npm run verify:release-candidate'),
  'production deployment checklist must include the release candidate verifier'
);

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('[lux.om] Release candidate launch readiness verification passed.');
