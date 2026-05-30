import { isPrimaryStoreUnavailable } from './fallback';

describe('isPrimaryStoreUnavailable', () => {
  it('allows fallback for connectivity and timeout failures', () => {
    expect(isPrimaryStoreUnavailable(new Error('Primary store timeout'))).toBe(
      true,
    );

    const connectionError = Object.assign(
      new Error("Can't reach database server at localhost:5432"),
      { name: 'PrismaClientInitializationError' },
    );
    expect(isPrimaryStoreUnavailable(connectionError)).toBe(true);
  });

  it('does not allow fallback for Prisma constraint errors', () => {
    const constraintError = Object.assign(
      new Error('Foreign key constraint failed'),
      { code: 'P2003' },
    );

    expect(isPrimaryStoreUnavailable(constraintError)).toBe(false);
  });
});
