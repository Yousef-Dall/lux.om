import { prisma } from '../../src/lib/prisma';

export async function clearIntegrationTestDatabase() {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost/lux_om_test');
  const databaseName = databaseUrl.pathname.replace(/^\/+/, '');

  if (!databaseName.endsWith('_test')) {
    throw new Error(`Refusing destructive cleanup for database: ${databaseName}`);
  }

  const tables = await prisma.$queryRaw<Array<{ tableName: string }>>`
    SELECT tablename AS "tableName"
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `;

  if (tables.length === 0) return;

  const identifiers = tables
    .map(({ tableName }) => `"public"."${tableName.replaceAll('\"', '\"\"')}"`)
    .join(', ');

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE`);

  // The shared-workspace migration seeds this platform workspace. Integration
  // cleanup must restore migration-owned baseline data after truncation so
  // general contact inquiries continue to route into the platform CRM.
  await prisma.workspace.upsert({
    where: { platformKey: 'CRM' },
    update: { type: 'PLATFORM', name: 'lux.om Platform CRM', active: true },
    create: {
      id: 'workspace_platform_crm',
      type: 'PLATFORM',
      name: 'lux.om Platform CRM',
      platformKey: 'CRM'
    }
  });
}
