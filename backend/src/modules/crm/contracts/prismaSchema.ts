import { readFile } from 'node:fs/promises';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractPrismaEnumValues(schema: string, enumName: string) {
  const match = schema.match(
    new RegExp(`enum\\s+${escapeRegExp(enumName)}\\s*\\{([\\s\\S]*?)\\}`)
  );

  if (!match) {
    throw new Error(`Prisma enum ${enumName} was not found.`);
  }

  const values = match[1]
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[0])
    .filter((value) => /^[A-Z][A-Z0-9_]*$/.test(value));

  if (values.length === 0) {
    throw new Error(`Prisma enum ${enumName} does not define any values.`);
  }

  return values;
}

export function normalizeTextLineEndings(value: string) {
  return value.replace(/\r\n?/g, '\n');
}

export async function readPrismaEnumValues(schemaPath: string, enumName: string) {
  const schema = await readFile(schemaPath, 'utf8');
  return extractPrismaEnumValues(schema, enumName);
}
