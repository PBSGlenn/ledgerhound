/**
 * Global setup for vitest
 * Runs once before all test files
 */

import { execSync } from 'child_process';
import { unlinkSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

const TEST_DATABASE_PATH = resolve(process.cwd(), 'prisma', 'test.db');
const TEST_DATABASE_URL = `file:${TEST_DATABASE_PATH}`;

export default async function globalSetup() {
  console.log('Global setup: Initializing test database...');

  // Ensure prisma directory exists
  const dbDir = dirname(TEST_DATABASE_PATH);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // Delete existing test database to start fresh
  if (existsSync(TEST_DATABASE_PATH)) {
    try {
      unlinkSync(TEST_DATABASE_PATH);
      console.log('Global setup: Deleted existing test.db');
    } catch (error) {
      console.warn('Global setup: Could not delete test.db (might be in use)');
    }
  }

  // Run migrations to create database schema
  try {
    execSync(`npx prisma migrate deploy`, {
      env: {
        ...process.env,
        DATABASE_URL: TEST_DATABASE_URL,
      },
      stdio: 'pipe',
      cwd: process.cwd(),
    });
    console.log('Global setup: Migrations applied successfully');
  } catch (error) {
    console.error('Global setup: Failed to run migrations:', error);
    throw error;
  }

  // Return a cleanup function
  return async () => {
    console.log('Global teardown: Cleanup complete');
  };
}
