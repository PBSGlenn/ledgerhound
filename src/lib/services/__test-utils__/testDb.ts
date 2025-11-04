import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { unlinkSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Test database utilities
 *
 * Uses a separate test.db file for testing to avoid polluting dev.db
 */

const TEST_DATABASE_PATH = './prisma/test.db';
const TEST_DATABASE_URL = `file:${TEST_DATABASE_PATH}`;

let prismaInstance: PrismaClient | null = null;
let dbInitialized = false;

/**
 * Create and initialize a test database
 * - Creates new Prisma client pointing to test.db
 * - Runs migrations if needed
 * - Returns connected client
 */
export async function createTestDb(): Promise<PrismaClient> {
  // Ensure prisma directory exists
  const dbDir = dirname(TEST_DATABASE_PATH);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // Run migrations to create database schema (only once)
  if (!dbInitialized) {
    // Delete existing test database to start fresh
    if (existsSync(TEST_DATABASE_PATH)) {
      try {
        unlinkSync(TEST_DATABASE_PATH);
      } catch (error) {
        // Ignore if can't delete (might be in use)
      }
    }

    try {
      execSync(`npx prisma migrate deploy`, {
        env: {
          ...process.env,
          DATABASE_URL: TEST_DATABASE_URL,
        },
        stdio: 'pipe',
      });
      dbInitialized = true;
    } catch (error) {
      console.error('Failed to run migrations:', error);
      throw error;
    }
  }

  // Create Prisma client with test database
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: TEST_DATABASE_URL,
      },
    },
    log: process.env.DEBUG_TESTS ? ['query', 'error', 'warn'] : ['error'],
  });

  // Connect
  await prisma.$connect();

  // Store instance for cleanup
  prismaInstance = prisma;

  return prisma;
}

/**
 * Reset the test database
 * - Deletes all data
 * - Re-runs migrations
 */
export async function resetTestDb(prisma: PrismaClient): Promise<void> {
  // Delete all data in reverse order of foreign key dependencies
  await prisma.posting.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.memorizedRule.deleteMany();
  await prisma.reconciliation.deleteMany();
  await prisma.importBatch.deleteMany();

  // Delete accounts in order of hierarchy (children first)
  // Repeat until no more accounts (handles multiple levels of nesting)
  let accountsDeleted = 0;
  do {
    // Delete accounts that have no children (leaf nodes)
    const allAccounts = await prisma.account.findMany({
      select: { id: true, parentId: true },
    });
    const parentIds = new Set(allAccounts.map(a => a.parentId).filter(Boolean));
    const leafAccountIds = allAccounts
      .filter(a => !parentIds.has(a.id))
      .map(a => a.id);

    if (leafAccountIds.length === 0) break;

    await prisma.account.deleteMany({
      where: { id: { in: leafAccountIds } },
    });

    accountsDeleted = leafAccountIds.length;
  } while (accountsDeleted > 0);

  await prisma.settings.deleteMany();
}

/**
 * Cleanup and disconnect from test database
 */
export async function cleanupTestDb(prisma?: PrismaClient): Promise<void> {
  const client = prisma || prismaInstance;
  if (client) {
    await client.$disconnect();
    prismaInstance = null;
  }
}

/**
 * Delete the test database file
 * Use this to start completely fresh
 */
export function deleteTestDb(): void {
  try {
    unlinkSync('./prisma/test.db');
  } catch (error) {
    // File doesn't exist, that's fine
  }
}

/**
 * Run Prisma migrations on test database
 */
export function runTestMigrations(): void {
  execSync('npx prisma migrate deploy', {
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
    },
    stdio: 'pipe', // Suppress output unless debugging
  });
}

/**
 * Helper to create a fresh database for each test suite
 *
 * Usage:
 * ```
 * import { beforeEach, afterAll } from 'vitest';
 *
 * describe('MyService', () => {
 *   let prisma: PrismaClient;
 *
 *   beforeEach(async () => {
 *     prisma = await createTestDb();
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
