import path from 'path';
import fs from 'fs';
import type { PrismaClient as GeneratedPrismaClient } from '../generated/prisma';

function resolveGeneratedPrismaPath() {
  const candidates = [
    path.resolve(process.cwd(), 'src/generated/prisma'),
    path.resolve(process.cwd(), 'apps/api/src/generated/prisma'),
  ];

  const match = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, 'index.js')),
  );

  if (!match) {
    throw new Error('Generated Prisma client not found');
  }

  return match;
}

const { PrismaClient } = require(resolveGeneratedPrismaPath()) as {
  PrismaClient: typeof GeneratedPrismaClient;
};

export { PrismaClient };
