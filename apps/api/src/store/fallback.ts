const TRANSIENT_PRISMA_CODES = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1008',
  'P1017',
]);

export function isPrimaryStoreUnavailable(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.message === 'Primary store timeout') {
    return true;
  }

  const maybePrismaError = error as Error & { code?: string };
  if (
    error.name === 'PrismaClientInitializationError' ||
    error.name === 'PrismaClientRustPanicError' ||
    (maybePrismaError.code && TRANSIENT_PRISMA_CODES.has(maybePrismaError.code))
  ) {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('connect econnrefused') ||
    message.includes('connection refused') ||
    message.includes("can't reach database server") ||
    message.includes('connection terminated')
  );
}
