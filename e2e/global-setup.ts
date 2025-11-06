import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from '@playwright/test';

const execAsync = promisify(exec);

async function globalSetup() {
  console.log('Setting up E2E test environment...');

  try {
    // Delete the database file to start fresh
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('✓ Deleted existing database');
    }

    // Run database migrations
    await execAsync('npm run db:migrate');
    console.log('✓ Database migrations completed');

    // Seed with test data
    await execAsync('npm run db:seed');
    console.log('✓ Database seeded with test data');

    // Create a book in localStorage to skip onboarding
    // We need to save this to a storage state file that tests can use
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to localhost (required for localStorage to work on the same origin)
    await page.goto('http://localhost:1420');

    // Create a default book
    await page.evaluate(() => {
      const book = {
        id: 'test-book-1',
        name: 'Test Book',
        ownerName: 'Test User',
        description: 'E2E Test Book',
        databasePath: 'prisma/dev.db',
        backupPath: 'ledgerhound-backups/test-book-1',
        fiscalYearStart: '07-01',
        currency: 'AUD',
        dateFormat: 'DD/MM/YYYY',
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        isActive: true,
      };

      // Store book
      localStorage.setItem('ledgerhound-books', JSON.stringify([book]));
      // Set as active book
      localStorage.setItem('ledgerhound-active-book', book.id);
    });

    // Save storage state to file
    const storageStatePath = path.join(process.cwd(), '.playwright', 'storage-state.json');
    const storageStateDir = path.dirname(storageStatePath);
    if (!fs.existsSync(storageStateDir)) {
      fs.mkdirSync(storageStateDir, { recursive: true });
    }
    await context.storageState({ path: storageStatePath });

    await browser.close();
    console.log('✓ Created test book in localStorage');
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
}

export default globalSetup;
