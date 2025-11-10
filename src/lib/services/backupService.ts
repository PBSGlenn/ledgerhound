/**
 * Backup Service
 * Handles SQLite database backups and restoration
 */

import { getPrismaClient } from '../db';
import type { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

export interface BackupInfo {
  filename: string;
  timestamp: Date;
  size: number;
  type: 'manual' | 'auto' | 'pre-import' | 'pre-reconcile';
}

export class BackupService {
  private prisma: PrismaClient;
  private dbPath: string;
  private backupDir: string;

  constructor(prisma?: PrismaClient, dbPath?: string, backupDir?: string) {
    this.prisma = prisma ?? getPrismaClient();
    this.dbPath = dbPath ?? 'prisma/dev.db';
    this.backupDir = backupDir ?? 'prisma/backups';
    this.ensureBackupDirectory();
  }

  /**
   * Ensure backup directory exists
   */
  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create a backup of the database
   */
  async createBackup(type: BackupInfo['type'] = 'manual'): Promise<BackupInfo> {
    const timestamp = new Date();
    const dateStr = timestamp.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `backup-${type}-${dateStr}.db`;
    const backupPath = path.join(this.backupDir, filename);

    // Use SQLite VACUUM INTO for proper backup
    try {
      // First, ensure all transactions are committed
      // PRAGMA commands return results, so use $queryRawUnsafe
      await this.prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)');

      // Create backup using file copy (simpler and more reliable)
      fs.copyFileSync(this.dbPath, backupPath);

      const stats = fs.statSync(backupPath);

      return {
        filename,
        timestamp,
        size: stats.size,
        type,
      };
    } catch (error) {
      throw new Error(`Failed to create backup: ${(error as Error).message}`);
    }
  }

  /**
   * Restore database from backup
   */
  async restoreBackup(filename: string): Promise<void> {
    const backupPath = path.join(this.backupDir, filename);

    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }

    try {
      // Close all database connections
      await this.prisma.$disconnect();

      // Create a safety backup before restore
      const safetyBackup = `${this.dbPath}.before-restore`;
      fs.copyFileSync(this.dbPath, safetyBackup);

      // Restore the backup
      fs.copyFileSync(backupPath, this.dbPath);

      // Reconnect
      await this.prisma.$connect();

      // Clean up safety backup after successful restore
      fs.unlinkSync(safetyBackup);
    } catch (error) {
      // If restore failed, try to recover from safety backup
      const safetyBackup = `${this.dbPath}.before-restore`;
      if (fs.existsSync(safetyBackup)) {
        fs.copyFileSync(safetyBackup, this.dbPath);
        fs.unlinkSync(safetyBackup);
      }
      throw new Error(`Failed to restore backup: ${(error as Error).message}`);
    }
  }

  /**
   * List all available backups
   */
  listBackups(): BackupInfo[] {
    if (!fs.existsSync(this.backupDir)) {
      return [];
    }

    const files = fs.readdirSync(this.backupDir);
    const backups: BackupInfo[] = [];

    for (const file of files) {
      if (!file.endsWith('.db')) continue;

      const filePath = path.join(this.backupDir, file);
      const stats = fs.statSync(filePath);

      // Parse filename: backup-{type}-{date}.db
      const match = file.match(/backup-(manual|auto|pre-import|pre-reconcile)-(.+)\.db$/);
      const type = (match?.[1] as BackupInfo['type']) || 'manual';
      const dateStr = match?.[2]?.replace(/-/g, ':').replace('T', ' ') || '';

      backups.push({
        filename: file,
        timestamp: stats.mtime,
        size: stats.size,
        type,
      });
    }

    // Sort by timestamp, newest first
    return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Delete a backup
   */
  deleteBackup(filename: string): void {
    const backupPath = path.join(this.backupDir, filename);

    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup file not found');
    }

    fs.unlinkSync(backupPath);
  }

  /**
   * Delete old backups, keeping only the most recent N
   */
  cleanOldBackups(keepCount: number = 10): number {
    const backups = this.listBackups();
    const toDelete = backups.slice(keepCount);

    for (const backup of toDelete) {
      this.deleteBackup(backup.filename);
    }

    return toDelete.length;
  }

  /**
   * Export database to JSON (for portability)
   */
  async exportToJSON(): Promise<string> {
    try {
      // Fetch all data
      const [accounts, transactions, postings, rules, mappings, reconciliations] = await Promise.all([
        this.prisma.account.findMany(),
        this.prisma.transaction.findMany(),
        this.prisma.posting.findMany(),
        this.prisma.memorizedRule.findMany(),
        this.prisma.importMapping.findMany(),
        this.prisma.reconciliation.findMany({ include: { postings: true } }),
      ]);

      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        data: {
          accounts,
          transactions,
          postings,
          rules,
          mappings,
          reconciliations,
        },
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      throw new Error(`Failed to export to JSON: ${(error as Error).message}`);
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    accounts: number;
    transactions: number;
    postings: number;
    size: number;
  }> {
    const [accountCount, transactionCount, postingCount] = await Promise.all([
      this.prisma.account.count(),
      this.prisma.transaction.count(),
      this.prisma.posting.count(),
    ]);

    const stats = fs.statSync(this.dbPath);

    return {
      accounts: accountCount,
      transactions: transactionCount,
      postings: postingCount,
      size: stats.size,
    };
  }
}

// Singleton instance
export const backupService = new BackupService();
