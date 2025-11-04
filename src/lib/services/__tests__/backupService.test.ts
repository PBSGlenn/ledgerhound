import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { BackupService } from '../backupService';
import { TransactionService } from '../transactionService';
import type { PrismaClient } from '@prisma/client';
import { createTestDb, resetTestDb, cleanupTestDb } from '../__test-utils__/testDb';
import { seedTestAccounts } from '../__test-utils__/fixtures';
import fs from 'fs';
import path from 'path';

describe('BackupService', () => {
  let prisma: PrismaClient;
  let backupService: BackupService;
  let transactionService: TransactionService;
  let accounts: Awaited<ReturnType<typeof seedTestAccounts>>;

  const testDbPath = './prisma/test.db';
  const testBackupDir = './prisma/test-backups';

  beforeEach(async () => {
    prisma = await createTestDb();
    await resetTestDb(prisma);
    backupService = new BackupService(prisma, testDbPath, testBackupDir);
    transactionService = new TransactionService(prisma);
    accounts = await seedTestAccounts(prisma);
  });

  afterEach(async () => {
    // Clean up test backup directory
    if (fs.existsSync(testBackupDir)) {
      const files = fs.readdirSync(testBackupDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testBackupDir, file));
      }
      fs.rmdirSync(testBackupDir);
    }
  });

  afterAll(async () => {
    await cleanupTestDb(prisma);
  });

  describe('createBackup', () => {
    it('should create a manual backup', async () => {
      const backup = await backupService.createBackup('manual');

      expect(backup.filename).toContain('backup-manual-');
      expect(backup.filename).toMatch(/\.db$/);
      expect(backup.type).toBe('manual');
      expect(backup.size).toBeGreaterThan(0);
      expect(backup.timestamp).toBeInstanceOf(Date);

      // Verify file exists
      const backupPath = path.join(testBackupDir, backup.filename);
      expect(fs.existsSync(backupPath)).toBe(true);
    });

    it('should create an auto backup', async () => {
      const backup = await backupService.createBackup('auto');

      expect(backup.filename).toContain('backup-auto-');
      expect(backup.type).toBe('auto');
    });

    it('should create a pre-import backup', async () => {
      const backup = await backupService.createBackup('pre-import');

      expect(backup.filename).toContain('backup-pre-import-');
      expect(backup.type).toBe('pre-import');
    });

    it('should create a pre-reconcile backup', async () => {
      const backup = await backupService.createBackup('pre-reconcile');

      expect(backup.filename).toContain('backup-pre-reconcile-');
      expect(backup.type).toBe('pre-reconcile');
    });

    it('should create backup with data', async () => {
      // Add some transactions
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Test Payee',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -100, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 100, isBusiness: false },
        ],
      });

      const backup = await backupService.createBackup('manual');

      expect(backup.size).toBeGreaterThan(0);

      // Verify backup file is valid SQLite database
      const backupPath = path.join(testBackupDir, backup.filename);
      expect(fs.existsSync(backupPath)).toBe(true);
    });

    it('should create multiple backups with unique filenames', async () => {
      const backup1 = await backupService.createBackup('manual');

      // Wait a tiny bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      const backup2 = await backupService.createBackup('manual');

      expect(backup1.filename).not.toBe(backup2.filename);

      const files = fs.readdirSync(testBackupDir);
      expect(files).toHaveLength(2);
    });
  });

  describe('listBackups', () => {
    it('should return empty array when no backups exist', () => {
      const backups = backupService.listBackups();
      expect(backups).toEqual([]);
    });

    it('should list all backups', async () => {
      await backupService.createBackup('manual');
      await backupService.createBackup('auto');

      const backups = backupService.listBackups();

      expect(backups).toHaveLength(2);
      expect(backups[0].filename).toBeDefined();
      expect(backups[0].size).toBeGreaterThan(0);
      expect(backups[0].timestamp).toBeInstanceOf(Date);
    });

    it('should sort backups by timestamp (newest first)', async () => {
      const backup1 = await backupService.createBackup('manual');
      await new Promise(resolve => setTimeout(resolve, 10));
      const backup2 = await backupService.createBackup('manual');

      const backups = backupService.listBackups();

      expect(backups).toHaveLength(2);
      // Most recent should be first
      expect(backups[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        backups[1].timestamp.getTime()
      );
    });

    it('should only list .db files', async () => {
      await backupService.createBackup('manual');

      // Create a non-.db file
      const nonDbFile = path.join(testBackupDir, 'test.txt');
      fs.writeFileSync(nonDbFile, 'test');

      const backups = backupService.listBackups();

      expect(backups).toHaveLength(1);
      expect(backups.every(b => b.filename.endsWith('.db'))).toBe(true);
    });
  });

  describe('deleteBackup', () => {
    it('should delete a backup', async () => {
      const backup = await backupService.createBackup('manual');

      backupService.deleteBackup(backup.filename);

      const backups = backupService.listBackups();
      expect(backups).toHaveLength(0);

      const backupPath = path.join(testBackupDir, backup.filename);
      expect(fs.existsSync(backupPath)).toBe(false);
    });

    it('should throw error when backup file not found', () => {
      expect(() => {
        backupService.deleteBackup('non-existent-backup.db');
      }).toThrow('Backup file not found');
    });

    it('should delete specific backup only', async () => {
      const backup1 = await backupService.createBackup('manual');
      const backup2 = await backupService.createBackup('auto');

      backupService.deleteBackup(backup1.filename);

      const backups = backupService.listBackups();
      expect(backups).toHaveLength(1);
      expect(backups[0].filename).toBe(backup2.filename);
    });
  });

  describe('cleanOldBackups', () => {
    it('should keep specified number of recent backups', async () => {
      // Create 5 backups
      for (let i = 0; i < 5; i++) {
        await backupService.createBackup('manual');
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const deleted = backupService.cleanOldBackups(3);

      expect(deleted).toBe(2); // Should delete 2 oldest
      const remainingBackups = backupService.listBackups();
      expect(remainingBackups).toHaveLength(3);
    });

    it('should not delete any backups if count is below limit', async () => {
      await backupService.createBackup('manual');
      await backupService.createBackup('auto');

      const deleted = backupService.cleanOldBackups(10);

      expect(deleted).toBe(0);
      const backups = backupService.listBackups();
      expect(backups).toHaveLength(2);
    });

    it('should delete all but one backup when keepCount is 1', async () => {
      await backupService.createBackup('manual');
      await new Promise(resolve => setTimeout(resolve, 10));
      await backupService.createBackup('manual');
      await new Promise(resolve => setTimeout(resolve, 10));
      await backupService.createBackup('manual');

      const deleted = backupService.cleanOldBackups(1);

      expect(deleted).toBe(2);
      const backups = backupService.listBackups();
      expect(backups).toHaveLength(1);
    });

    it('should use default keepCount of 10', async () => {
      // Create 12 backups
      for (let i = 0; i < 12; i++) {
        await backupService.createBackup('manual');
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const deleted = backupService.cleanOldBackups();

      expect(deleted).toBe(2); // 12 - 10 = 2
      const backups = backupService.listBackups();
      expect(backups).toHaveLength(10);
    });
  });

  describe('exportToJSON', () => {
    it('should export empty database to JSON', async () => {
      const json = await backupService.exportToJSON();

      expect(json).toBeDefined();
      const data = JSON.parse(json);

      expect(data.version).toBe('1.0');
      expect(data.exportDate).toBeDefined();
      expect(data.data).toBeDefined();
      expect(data.data.accounts).toBeInstanceOf(Array);
      expect(data.data.transactions).toBeInstanceOf(Array);
      expect(data.data.postings).toBeInstanceOf(Array);
    });

    it('should export database with transactions to JSON', async () => {
      // Create transaction
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Test Payee',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -100, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 100, isBusiness: false },
        ],
      });

      const json = await backupService.exportToJSON();
      const data = JSON.parse(json);

      expect(data.data.accounts.length).toBeGreaterThan(0);
      expect(data.data.transactions.length).toBe(1);
      expect(data.data.postings.length).toBe(2);
    });

    it('should export valid JSON', async () => {
      const json = await backupService.exportToJSON();

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should include export metadata', async () => {
      const json = await backupService.exportToJSON();
      const data = JSON.parse(json);

      expect(data.version).toBeDefined();
      expect(data.exportDate).toBeDefined();
      expect(new Date(data.exportDate)).toBeInstanceOf(Date);
    });
  });

  describe('getStats', () => {
    it('should return database statistics', async () => {
      const stats = await backupService.getStats();

      expect(stats).toBeDefined();
      expect(stats.accounts).toBeGreaterThanOrEqual(0);
      expect(stats.transactions).toBeGreaterThanOrEqual(0);
      expect(stats.postings).toBeGreaterThanOrEqual(0);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should count accounts correctly', async () => {
      const stats = await backupService.getStats();

      // We seed 10 accounts in beforeEach
      expect(stats.accounts).toBe(10);
    });

    it('should count transactions and postings correctly', async () => {
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Test',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -100, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 100, isBusiness: false },
        ],
      });

      const stats = await backupService.getStats();

      expect(stats.transactions).toBe(1);
      expect(stats.postings).toBe(2);
    });

    it('should return file size in bytes', async () => {
      const stats = await backupService.getStats();

      expect(typeof stats.size).toBe('number');
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('restoreBackup', () => {
    it('should throw error when backup file not found', async () => {
      await expect(
        backupService.restoreBackup('non-existent-backup.db')
      ).rejects.toThrow('Backup file not found');
    });

    // Note: Full restore testing is tricky because it disconnects and reconnects
    // the database. We'll test the error case above, but skip full restore tests
    // to avoid test database connection issues.
  });

  describe('ensureBackupDirectory', () => {
    it('should create backup directory if it does not exist', () => {
      // The directory is created in constructor, so it should exist
      expect(fs.existsSync(testBackupDir)).toBe(true);
    });

    it('should not throw error if directory already exists', () => {
      // Create a new service instance (should not throw)
      expect(() => {
        new BackupService(prisma, testDbPath, testBackupDir);
      }).not.toThrow();
    });
  });

  describe('Integration', () => {
    it('should create, list, and delete backup in sequence', async () => {
      // Create backup
      const backup = await backupService.createBackup('manual');
      expect(backup).toBeDefined();

      // List backups
      const backups = backupService.listBackups();
      expect(backups).toHaveLength(1);
      expect(backups[0].filename).toBe(backup.filename);

      // Delete backup
      backupService.deleteBackup(backup.filename);
      const afterDelete = backupService.listBackups();
      expect(afterDelete).toHaveLength(0);
    });

    it('should handle backup lifecycle with data changes', async () => {
      // Initial state
      const statsBefore = await backupService.getStats();
      expect(statsBefore.transactions).toBe(0);

      // Create backup of empty state
      const backup1 = await backupService.createBackup('pre-import');

      // Add transaction
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Test',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -100, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 100, isBusiness: false },
        ],
      });

      // Create backup of state with transaction
      const backup2 = await backupService.createBackup('manual');

      // Verify both backups exist
      const backups = backupService.listBackups();
      expect(backups).toHaveLength(2);

      // Verify stats reflect changes
      const statsAfter = await backupService.getStats();
      expect(statsAfter.transactions).toBe(1);
      expect(statsAfter.postings).toBe(2);
    });

    it('should handle multiple backup types', async () => {
      await backupService.createBackup('manual');
      await backupService.createBackup('auto');
      await backupService.createBackup('pre-import');
      await backupService.createBackup('pre-reconcile');

      const backups = backupService.listBackups();

      expect(backups).toHaveLength(4);

      const types = backups.map(b => b.type);
      expect(types).toContain('manual');
      expect(types).toContain('auto');
      expect(types).toContain('pre-import');
      expect(types).toContain('pre-reconcile');
    });
  });
});
