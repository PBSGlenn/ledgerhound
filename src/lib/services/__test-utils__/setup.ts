/**
 * Vitest setup file
 * Runs before all tests
 *
 * IMPORTANT: This file is executed BEFORE test files are imported.
 * Setting DATABASE_URL here ensures all Prisma clients use the test database.
 */

import { resolve } from 'path';

// Set test environment
process.env.NODE_ENV = 'test';

// CRITICAL: Set DATABASE_URL to test database BEFORE any Prisma clients are created
// This ensures all singleton services (like memorizedRuleService) use the test database
const TEST_DATABASE_PATH = resolve(process.cwd(), 'prisma', 'test.db');
process.env.DATABASE_URL = `file:${TEST_DATABASE_PATH}`;

// Suppress console logs during tests (comment out for debugging)
// global.console = {
//   ...console,
//   log: vi.fn(),
//   debug: vi.fn(),
//   info: vi.fn(),
//   warn: vi.fn(),
// };
