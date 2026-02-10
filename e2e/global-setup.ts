import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from '@playwright/test';

const execAsync = promisify(exec);

async function globalSetup() {
  console.log('Setting up E2E test environment...');

  try {
    // Try to delete the database file to start fresh
    // If locked (API server running), skip DB setup and use existing data
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
    let dbLocked = false;

    if (fs.existsSync(dbPath)) {
      try {
        // Try to open the file exclusively to check if it's locked
        const fd = fs.openSync(dbPath, 'r+');
        fs.closeSync(fd);
        // If we get here, file is not locked - we can delete and reseed
        fs.unlinkSync(dbPath);
        console.log('✓ Deleted existing database');
      } catch (err: any) {
        if (err.code === 'EBUSY' || err.code === 'EACCES') {
          console.log('⚠ Database locked (API server running) - using existing data');
          dbLocked = true;
        } else {
          throw err;
        }
      }
    }

    if (!dbLocked) {
      // Run database migrations (creates tables if needed)
      await execAsync('npm run db:migrate');
      console.log('✓ Database migrations completed');

      // Seed with test data (resets and repopulates)
      await execAsync('npm run db:seed');
      console.log('✓ Database seeded with test data');
    } else {
      console.log('⚠ Skipping DB reset - tests will use existing data');
    }

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
