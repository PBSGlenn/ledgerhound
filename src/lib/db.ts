import { PrismaClient } from '@prisma/client';

// The real Prisma client instance (swappable for multi-book support)
let realPrisma: PrismaClient | null = null;

// Track current database URL
let currentDbUrl: string | null = null;

// Track whether PRAGMAs have been applied to the current connection
let pragmasApplied = false;

/**
 * Apply SQLite PRAGMAs for performance and integrity.
 * Called once per connection.
 */
async function applyPragmas(client: PrismaClient): Promise<void> {
  try {
    await client.$executeRawUnsafe('PRAGMA journal_mode=WAL');
    await client.$executeRawUnsafe('PRAGMA busy_timeout=5000');
    await client.$executeRawUnsafe('PRAGMA foreign_keys=ON');
  } catch (error) {
    console.error('Failed to apply SQLite PRAGMAs:', error);
  }
}

/**
 * Proxy that always delegates to the current real PrismaClient.
 * Services that store getPrismaClient() at construction time will
 * automatically use the new client after switchDatabase() is called.
 */
const prismaProxy = new Proxy({} as PrismaClient, {
  get(_, prop) {
    if (!realPrisma) {
      realPrisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      });
      // Apply PRAGMAs on first use (async, but WAL mode is sticky after first call)
      if (!pragmasApplied) {
        pragmasApplied = true;
        applyPragmas(realPrisma);
      }
    }
    return (realPrisma as any)[prop];
  },
});

export function getPrismaClient(): PrismaClient {
  return prismaProxy;
}

// Export the proxy as the default singleton
export const prisma = prismaProxy;

/**
 * Switch the database to a different SQLite file.
 * All services holding a reference from getPrismaClient() will
 * automatically use the new database after this call.
 */
export async function switchDatabase(dbUrl: string): Promise<void> {
  if (currentDbUrl === dbUrl && realPrisma) return; // Already connected

  if (realPrisma) {
    await realPrisma.$disconnect();
  }

  currentDbUrl = dbUrl;
  process.env.DATABASE_URL = dbUrl;

  realPrisma = new PrismaClient({
    datasourceUrl: dbUrl,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  // Apply PRAGMAs to the new connection
  await applyPragmas(realPrisma);
}

/**
 * Get the current database URL
 */
export function getCurrentDbUrl(): string | null {
  return currentDbUrl;
}

export async function disconnectPrisma(): Promise<void> {
  if (realPrisma) {
    await realPrisma.$disconnect();
    realPrisma = null;
    currentDbUrl = null;
    pragmasApplied = false;
  }
}
