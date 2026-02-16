import { PrismaClient } from '@prisma/client';

// The real Prisma client instance (swappable for multi-book support)
let realPrisma: PrismaClient | null = null;

// Track current database URL
let currentDbUrl: string | null = null;

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
  }
}
