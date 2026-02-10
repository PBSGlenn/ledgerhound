import { PrismaClient } from '@prisma/client';
import { resolve } from 'path';

/**
 * Test database utilities
 *
 * Uses a separate test.db file for testing to avoid polluting dev.db
 *
 * IMPORTANT: This module uses a singleton pattern for the PrismaClient.
 * All tests share the same client to avoid SQLite file locking issues.
 *
 * Database initialization is handled by globalSetup.ts which runs before all tests.
 */

// Use absolute path to avoid path resolution issues
const TEST_DATABASE_PATH = resolve(process.cwd(), 'prisma', 'test.db');
const TEST_DATABASE_URL = `file:${TEST_DATABASE_PATH}`;

let prismaInstance: PrismaClient | null = null;

/**
 * Get the singleton test database client
 * - Creates client on first call
 * - Returns existing client on subsequent calls
 * - Database is already initialized by globalSetup.ts
 */
export async function getTestDb(): Promise<PrismaClient> {
  // If we already have a connected client, return it
  if (prismaInstance) {
    return prismaInstance;
  }

  // Create Prisma client with test database
  prismaInstance = new PrismaClient({
    datasources: {
      db: {
        url: TEST_DATABASE_URL,
      },
    },
    log: process.env.DEBUG_TESTS ? ['query', 'error', 'warn'] : ['error'],
  });

  // Connect
  await prismaInstance.$connect();

  return prismaInstance;
}

/**
 * Alias for backwards compatibility
 * @deprecated Use getTestDb() instead
 */
export async function createTestDb(): Promise<PrismaClient> {
  return getTestDb();
}

/**
 * Reset the test database
 * - Deletes all data
 * - Does NOT recreate the client (reuses singleton)
 */
export async function resetTestDb(prisma?: PrismaClient): Promise<void> {
  const client = prisma || prismaInstance;
  if (!client) {
    throw new Error('No database client available. Call getTestDb() first.');
  }

  // Delete all data in reverse order of foreign key dependencies
  await client.posting.deleteMany();
  await client.transaction.deleteMany();
  await client.memorizedRule.deleteMany();
  await client.reconciliation.deleteMany();
  await client.importBatch.deleteMany();

  // Delete accounts in order of hierarchy (children first)
  // Repeat until no more accounts (handles multiple levels of nesting)
  let accountsDeleted = 0;
  do {
    // Delete accounts that have no children (leaf nodes)
    const allAccounts = await client.account.findMany({
      select: { id: true, parentId: true },
    });
    const parentIds = new Set(allAccounts.map(a => a.parentId).filter(Boolean));
    const leafAccountIds = allAccounts
      .filter(a => !parentIds.has(a.id))
      .map(a => a.id);

    if (leafAccountIds.length === 0) break;

    await client.account.deleteMany({
      where: { id: { in: leafAccountIds } },
    });

    accountsDeleted = leafAccountIds.length;
  } while (accountsDeleted > 0);

  await client.settings.deleteMany();
}

/**
 * Cleanup and disconnect from test database
 * Call this in afterAll() of your test file
 *
 * NOTE: With singleton pattern, we don't actually disconnect -
 * we just clear the local reference. The client stays alive for other test files.
 */
export async function cleanupTestDb(_prisma?: PrismaClient): Promise<void> {
  // Don't disconnect - let the client be reused by other test files
  // The process will clean up when tests finish
}

/**
 * Force disconnect from test database
 * Only call this at the very end of all tests (in globalTeardown)
 */
export async function forceDisconnect(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

/**
 * Get the test database path (for services like BackupService that need it)
 */
export function getTestDbPath(): string {
  return TEST_DATABASE_PATH;
}

/**
 * Helper documentation for test setup pattern:
 *
 * ```
 * import { beforeAll, beforeEach, afterAll } from 'vitest';
 * import { getTestDb, resetTestDb, cleanupTestDb } from '../__test-utils__/testDb';
 *
 * describe('MyService', () => {
 *   let prisma: PrismaClient;
 *
 *   beforeAll(async () => {
 *     prisma = await getTestDb();
 *   });
 *
 *   beforeEach(async () => {
 *     await resetTestDb(prisma);
 *   });
 *
 *   afterAll(async () => {
 *     await cleanupTestDb(prisma);
 *   });
 *
 *   it('should do something', async () => {
 *     // test code
 *   });
 * });
 * ```
 */
