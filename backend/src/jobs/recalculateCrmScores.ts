import { prisma } from '../lib/prisma';
import { recalculateWorkspaceScores } from '../modules/crm/stage21h/scoring';

async function main() {
  const versionArg = process.argv.find((value) => value.startsWith('--version='));
  const version = versionArg?.slice('--version='.length) || undefined;
  const workspaceArg = process.argv.find((value) => value.startsWith('--workspace='));
  const workspaceId = workspaceArg?.slice('--workspace='.length);
  const workspaces = await prisma.workspace.findMany({
    where: { active: true, ...(workspaceId ? { id: workspaceId } : {}) },
    select: { id: true },
    orderBy: { id: 'asc' }
  });
  const summary = [];
  for (const workspace of workspaces) {
    const jobKey = `crm-score:${version ?? 'current'}:${workspace.id}:${new Date().toISOString().slice(0, 10)}`;
    const result = await prisma.$transaction((tx) => recalculateWorkspaceScores(tx, workspace.id, { version, jobKey }), {
      isolationLevel: 'Serializable'
    });
    summary.push({ workspaceId: workspace.id, ...result });
  }
  console.log('[lux.om] CRM score recalculation complete', summary);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
