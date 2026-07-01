import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import 'dotenv/config';

type ParsedArgs = {
  output?: string;
  overwrite: boolean;
  dryRun: boolean;
  allowTest: boolean;
};

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    overwrite: false,
    dryRun: false,
    allowTest: false
  };

  for (const arg of args) {
    if (arg === '--overwrite') {
      parsed.overwrite = true;
      continue;
    }

    if (arg === '--dry-run') {
      parsed.dryRun = true;
      continue;
    }

    if (arg === '--allow-test') {
      parsed.allowTest = true;
      continue;
    }

    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }

    if (arg.startsWith('--output=')) {
      parsed.output = arg.slice('--output='.length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: npm run ops:db:backup -w backend -- --output=../backups/lux-om.dump

Options:
  --output=<path>   Backup file path. Defaults to ../backups/lux-om-<timestamp>.dump.
  --overwrite       Allow replacing an existing backup file.
  --dry-run         Print the pg_dump command plan without running it.
  --allow-test      Allow backing up a database whose name ends with _test.
`);
}

function getDefaultOutputPath() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .replace('Z', 'Z');

  return `../backups/lux-om-${timestamp}.dump`;
}

function parseDatabaseUrl(value: string) {
  let databaseUrl: URL;

  try {
    databaseUrl = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }

  if (!['postgresql:', 'postgres:'].includes(databaseUrl.protocol)) {
    throw new Error('DATABASE_URL must use the postgresql:// protocol.');
  }

  const databaseName = databaseUrl.pathname.replace(/^\/+/, '');

  if (!databaseName) {
    throw new Error('DATABASE_URL must include a database name.');
  }

  return {
    host: databaseUrl.hostname,
    port: databaseUrl.port || '5432',
    databaseName,
    username: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    sslMode: databaseUrl.searchParams.get('sslmode') ?? undefined
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to create a database backup.');
  }

  const database = parseDatabaseUrl(databaseUrl);

  if (database.databaseName.endsWith('_test') && !args.allowTest) {
    throw new Error(
      `Refusing to back up test database ${database.databaseName}. Pass --allow-test only for local test maintenance.`
    );
  }

  const outputPath = resolve(process.cwd(), args.output ?? getDefaultOutputPath());

  if (existsSync(outputPath) && !args.overwrite) {
    throw new Error(
      `Backup file already exists: ${outputPath}. Pass --overwrite to replace it.`
    );
  }

  mkdirSync(dirname(outputPath), { recursive: true });

  const pgDumpArgs = [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--file',
    outputPath,
    database.databaseName
  ];

  const safeCommand = [
    'pg_dump',
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--file',
    outputPath,
    database.databaseName
  ].join(' ');

  console.log(
    `[lux.om] Preparing database backup for ${database.databaseName} at ${database.host}:${database.port}.`
  );
  console.log(`[lux.om] Backup output: ${outputPath}`);

  if (args.dryRun) {
    console.log(`[lux.om] Dry run only. Command plan: ${safeCommand}`);
    return;
  }

  const pgDumpBinary = process.env.PG_DUMP_PATH || 'pg_dump';

  const result = spawnSync(pgDumpBinary, pgDumpArgs, {
    env: {
      ...process.env,
      PGHOST: database.host,
      PGPORT: database.port,
      PGDATABASE: database.databaseName,
      PGUSER: database.username,
      PGPASSWORD: database.password,
      ...(database.sslMode ? { PGSSLMODE: database.sslMode } : {})
    },
    stdio: 'inherit'
  });

  if (result.error) {
    if ('code' in result.error && result.error.code === 'ENOENT') {
      throw new Error(
        `pg_dump was not found. Install PostgreSQL client tools and add pg_dump to PATH, or set PG_DUMP_PATH to the full pg_dump executable path. Attempted command: ${pgDumpBinary}`
      );
    }

    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`pg_dump failed with exit code ${result.status ?? 'unknown'}.`);
  }

  console.log(`[lux.om] Database backup completed: ${outputPath}`);
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
