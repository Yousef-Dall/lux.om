import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type PackageJson = {
  scripts?: Record<string, string>;
};

type CheckResult = {
  name: string;
  ok: boolean;
  message: string;
};

type WarningResult = {
  name: string;
  message: string;
};

const backendRoot = process.cwd();
const repositoryRoot = join(backendRoot, '..');
const prismaDir = join(backendRoot, 'prisma');
const migrationsDir = join(prismaDir, 'migrations');
const migrationNamePattern = /^\d{14}_[a-z0-9_]+$/;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function addCheck(results: CheckResult[], name: string, ok: boolean, message: string) {
  results.push({ name, ok, message });
}

function addWarning(warnings: WarningResult[], name: string, message: string) {
  warnings.push({ name, message });
}

function getScripts(packagePath: string) {
  const packageJson = readJson<PackageJson>(packagePath);
  return packageJson.scripts ?? {};
}

function scriptIncludes(scripts: Record<string, string>, scriptName: string, expected: string) {
  return Boolean(scripts[scriptName]?.includes(expected));
}

function listMigrationDirectories() {
  if (!existsSync(migrationsDir)) {
    return [];
  }

  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function main() {
  const checks: CheckResult[] = [];
  const warnings: WarningResult[] = [];

  const rootPackagePath = join(repositoryRoot, 'package.json');
  const backendPackagePath = join(backendRoot, 'package.json');
  const schemaPath = join(prismaDir, 'schema.prisma');
  const migrationLockPath = join(migrationsDir, 'migration_lock.toml');

  const rootScripts = existsSync(rootPackagePath) ? getScripts(rootPackagePath) : {};
  const backendScripts = existsSync(backendPackagePath) ? getScripts(backendPackagePath) : {};

  addCheck(
    checks,
    'Prisma schema exists',
    existsSync(schemaPath),
    'backend/prisma/schema.prisma must be present.'
  );

  addCheck(
    checks,
    'Prisma migrations directory exists',
    existsSync(migrationsDir),
    'backend/prisma/migrations must be present and committed.'
  );

  if (existsSync(schemaPath)) {
    const schema = readFileSync(schemaPath, 'utf8');
    addCheck(
      checks,
      'Prisma datasource uses PostgreSQL',
      /datasource\s+db\s*{[\s\S]*provider\s*=\s*"postgresql"/.test(schema),
      'Production deploy safety expects the Prisma datasource provider to stay PostgreSQL.'
    );
  }

  if (existsSync(migrationLockPath)) {
    const migrationLock = readFileSync(migrationLockPath, 'utf8');
    addCheck(
      checks,
      'Prisma migration lock uses PostgreSQL',
      /provider\s*=\s*"postgresql"/.test(migrationLock),
      'migration_lock.toml must match the production PostgreSQL provider.'
    );
  } else {
    addCheck(
      checks,
      'Prisma migration lock exists',
      false,
      'backend/prisma/migrations/migration_lock.toml must be committed.'
    );
  }

  const migrationDirectories = listMigrationDirectories();

  addCheck(
    checks,
    'At least one Prisma migration is committed',
    migrationDirectories.length > 0,
    `${migrationDirectories.length} migration director${migrationDirectories.length === 1 ? 'y' : 'ies'} found.`
  );

  const invalidMigrationNames = migrationDirectories.filter(
    (name) => !migrationNamePattern.test(name)
  );
  addCheck(
    checks,
    'Migration directory names are timestamped and deterministic',
    invalidMigrationNames.length === 0,
    invalidMigrationNames.length === 0
      ? 'All migration directory names match the expected timestamp_name format.'
      : `Invalid migration directory names: ${invalidMigrationNames.join(', ')}`
  );

  const migrationsMissingSql = migrationDirectories.filter((name) => {
    const migrationSqlPath = join(migrationsDir, name, 'migration.sql');
    return !existsSync(migrationSqlPath) || readFileSync(migrationSqlPath, 'utf8').trim().length === 0;
  });
  addCheck(
    checks,
    'Every migration has a non-empty migration.sql file',
    migrationsMissingSql.length === 0,
    migrationsMissingSql.length === 0
      ? 'All migration directories contain non-empty migration.sql files.'
      : `Missing or empty migration.sql files: ${migrationsMissingSql.join(', ')}`
  );

  addCheck(
    checks,
    'Backend production migration script uses migrate deploy',
    scriptIncludes(backendScripts, 'db:migrate:deploy', 'prisma migrate deploy'),
    'backend package db:migrate:deploy must use prisma migrate deploy, not db push or migrate dev.'
  );

  addCheck(
    checks,
    'Root production migration script delegates to backend migrate deploy',
    scriptIncludes(rootScripts, 'db:migrate:deploy', 'db:migrate:deploy -w backend'),
    'root package db:migrate:deploy must delegate to the backend production migration script.'
  );

  addCheck(
    checks,
    'Production verification includes database safety checks',
    scriptIncludes(rootScripts, 'verify:production', 'verify:db-safety'),
    'npm run verify:production must include npm run verify:db-safety.'
  );

  const resetScripts = Object.entries({ ...rootScripts, ...backendScripts }).filter(([, command]) =>
    /prisma\s+migrate\s+reset|prisma\s+db\s+push\s+--force-reset/.test(command)
  );
  addCheck(
    checks,
    'No package script performs destructive Prisma reset',
    resetScripts.length === 0,
    resetScripts.length === 0
      ? 'No package scripts call prisma migrate reset or prisma db push --force-reset.'
      : `Destructive scripts found: ${resetScripts.map(([name]) => name).join(', ')}`
  );

  for (const [scriptName, command] of Object.entries({ ...rootScripts, ...backendScripts })) {
    if (/prisma\s+db\s+push/.test(command) && !/--force-reset/.test(command)) {
      addWarning(
        warnings,
        `Script ${scriptName} uses prisma db push`,
        'Use db:push only for local prototyping. Production deploys must use db:migrate:deploy after a verified backup.'
      );
    }

    if (/prisma\s+migrate\s+dev/.test(command)) {
      addWarning(
        warnings,
        `Script ${scriptName} uses prisma migrate dev`,
        'Use db:migrate only for local migration authoring. Production deploys must use db:migrate:deploy.'
      );
    }
  }

  const failedChecks = checks.filter((check) => !check.ok);

  for (const check of checks) {
    console.log(`${check.ok ? '✓' : '✕'} ${check.name}: ${check.message}`);
  }

  for (const warning of warnings) {
    console.warn(`! ${warning.name}: ${warning.message}`);
  }

  if (failedChecks.length > 0) {
    throw new Error(
      `Database migration safety verification failed with ${failedChecks.length} failed check(s).`
    );
  }

  console.log(
    `[lux.om] Database migration safety verification passed with ${migrationDirectories.length} committed migration(s).`
  );
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
