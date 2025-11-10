import { getPrismaClient } from '../db';
import type { Reconciliation, Posting, PrismaClient } from '@prisma/client';
import { accountService, AccountService } from './accountService';

export class ReconciliationService {
  private prisma: PrismaClient;
  private accountService: AccountService;

  constructor(prisma?: PrismaClient, accService?: AccountService) {
    this.prisma = prisma ?? getPrismaClient();
    this.accountService = accService ?? accountService;
  }

  /**
   * Create a new reconciliation session
   */
  async createReconciliation(data: {
    accountId: string;
    statementStartDate: Date;
    statementEndDate: Date;
    statementStartBalance: number;
    statementEndBalance: number;
    notes?: string;
  }): Promise<Reconciliation> {
    return this.prisma.reconciliation.create({
      data: {
        accountId: data.accountId,
        statementStartDate: data.statementStartDate,
        statementEndDate: data.statementEndDate,
        statementStartBalance: data.statementStartBalance,
        statementEndBalance: data.statementEndBalance,
        notes: data.notes,
        locked: false,
      },
    });
  }

  /**
   * Get reconciliation by ID
   */
  async getReconciliationById(id: string): Promise<Reconciliation | null> {
    return this.prisma.reconciliation.findUnique({
      where: { id },
      include: {
        account: true,
        postings: {
          include: {
            transaction: true,
            account: true,
          },
        },
      },
    });
  }

  /**
   * Get all reconciliations for an account
   */
  async getReconciliations(accountId?: string): Promise<Reconciliation[]> {
    return this.prisma.reconciliation.findMany({
      where: accountId ? { accountId } : undefined,
      include: {
        account: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get unreconciled postings for an account in a date range
   */
  async getUnreconciledPostings(
    accountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Posting[]> {
    return this.prisma.posting.findMany({
      where: {
        accountId,
        reconciled: false,
        transaction: {
          date: {
            gte: startDate,
            lte: endDate,
          },
          status: 'NORMAL',
        },
      },
      include: {
        transaction: true,
        account: true,
      },
      orderBy: [
        { transaction: { date: 'asc' } },
        { createdAt: 'asc' },
      ],
    });
  }

  /**
   * Calculate reconciliation status
   */
  async getReconciliationStatus(reconciliationId: string): Promise<{
    statementBalance: number;
    clearedBalance: number;
    unreconciledBalance: number;
    difference: number;
    isBalanced: boolean;
    reconciledCount: number;
    unreconciledCount: number;
  }> {
    const reconciliation = await this.getReconciliationById(reconciliationId);
    if (!reconciliation) {
      throw new Error(`Reconciliation ${reconciliationId} not found`);
    }

    // Get account's opening balance
    const account = await this.accountService.getAccountById(reconciliation.accountId);
    if (!account) {
      throw new Error(`Account ${reconciliation.accountId} not found`);
    }

    // Get all postings up to statement end date
    const allPostings = await this.prisma.posting.findMany({
      where: {
        accountId: reconciliation.accountId,
        transaction: {
          date: {
            lte: reconciliation.statementEndDate,
          },
          status: 'NORMAL',
        },
      },
      include: {
        transaction: true,
      },
    });

    // Calculate cleared balance (opening + all cleared postings)
    let clearedBalance = account.openingBalance;
    let unreconciledBalance = account.openingBalance;
    let reconciledCount = 0;
    let unreconciledCount = 0;

    for (const posting of allPostings) {
      if (posting.cleared) {
        clearedBalance += posting.amount;
      }
      if (posting.reconciled) {
        reconciledCount++;
      } else {
        unreconciledBalance += posting.amount;
        unreconciledCount++;
      }
    }

    const statementBalance = reconciliation.statementEndBalance;
    const difference = clearedBalance - statementBalance;
    const isBalanced = Math.abs(difference) < 0.01;

    return {
      statementBalance,
      clearedBalance,
      unreconciledBalance,
      difference,
      isBalanced,
      reconciledCount,
      unreconciledCount,
    };
  }

  /**
   * Mark postings as reconciled in a reconciliation session
   */
  async reconcilePostings(
    reconciliationId: string,
    postingIds: string[]
  ): Promise<void> {
    const reconciliation = await this.getReconciliationById(reconciliationId);
    if (!reconciliation) {
      throw new Error(`Reconciliation ${reconciliationId} not found`);
    }

    if (reconciliation.locked) {
      throw new Error('Cannot modify a locked reconciliation');
    }

    // Mark postings as cleared and reconciled
    await this.prisma.posting.updateMany({
      where: {
        id: { in: postingIds },
        accountId: reconciliation.accountId,
      },
      data: {
        cleared: true,
        reconciled: true,
        reconcileId: reconciliationId,
      },
    });
  }

  /**
   * Unreconcile postings
   */
  async unreconcilePostings(
    reconciliationId: string,
    postingIds: string[]
  ): Promise<void> {
    const reconciliation = await this.getReconciliationById(reconciliationId);
    if (!reconciliation) {
      throw new Error(`Reconciliation ${reconciliationId} not found`);
    }

    if (reconciliation.locked) {
      throw new Error('Cannot modify a locked reconciliation');
    }

    await this.prisma.posting.updateMany({
      where: {
        id: { in: postingIds },
        reconcileId: reconciliationId,
      },
      data: {
        reconciled: false,
        reconcileId: null,
      },
    });
  }

  /**
   * Lock a reconciliation session (when balanced)
   */
  async lockReconciliation(reconciliationId: string): Promise<Reconciliation> {
    const status = await this.getReconciliationStatus(reconciliationId);

    if (!status.isBalanced) {
      throw new Error(
        `Cannot lock reconciliation with difference of ${status.difference.toFixed(2)}`
      );
    }

    return this.prisma.reconciliation.update({
      where: { id: reconciliationId },
      data: { locked: true },
    });
  }

  /**
   * Unlock a reconciliation session
   */
  async unlockReconciliation(reconciliationId: string): Promise<Reconciliation> {
    return this.prisma.reconciliation.update({
      where: { id: reconciliationId },
      data: { locked: false },
    });
  }

  /**
   * Update reconciliation statement balances
   */
  async updateReconciliation(
    reconciliationId: string,
    data: {
      statementStartDate?: Date;
      statementEndDate?: Date;
      statementStartBalance?: number;
      statementEndBalance?: number;
      notes?: string;
    }
  ): Promise<Reconciliation> {
    const reconciliation = await this.getReconciliationById(reconciliationId);
    if (!reconciliation) {
      throw new Error(`Reconciliation ${reconciliationId} not found`);
    }

    if (reconciliation.locked) {
      throw new Error('Cannot modify a locked reconciliation');
    }

    return this.prisma.reconciliation.update({
      where: { id: reconciliationId },
      data,
    });
  }

  /**
   * Delete a reconciliation session
   */
  async deleteReconciliation(reconciliationId: string): Promise<void> {
    const reconciliation = await this.getReconciliationById(reconciliationId);
    if (!reconciliation) {
      throw new Error(`Reconciliation ${reconciliationId} not found`);
    }

    if (reconciliation.locked) {
      throw new Error('Cannot delete a locked reconciliation. Unlock it first.');
    }

    // Unreconcile all postings
    await this.prisma.posting.updateMany({
      where: { reconcileId: reconciliationId },
      data: {
        reconciled: false,
        reconcileId: null,
      },
    });

    // Delete the reconciliation
    await this.prisma.reconciliation.delete({
      where: { id: reconciliationId },
    });
  }

  /**
   * Auto-reconcile by matching cleared postings to statement balance
   */
  async autoReconcile(
    accountId: string,
    statementEndDate: Date,
    statementEndBalance: number
  ): Promise<{
    matched: string[]; // Posting IDs
    difference: number;
  }> {
    // Get all unreconciled postings up to statement date
    const postings = await this.prisma.posting.findMany({
      where: {
        accountId,
        reconciled: false,
        transaction: {
          date: { lte: statementEndDate },
          status: 'NORMAL',
        },
      },
      orderBy: [
        { transaction: { date: 'asc' } },
        { createdAt: 'asc' },
      ],
    });

    // Get account opening balance
    const account = await this.accountService.getAccountById(accountId);
    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    // Try to find combination that matches statement balance
    // For now, use simple approach: mark all cleared postings
    let runningBalance = account.openingBalance;
    const matched: string[] = [];

    for (const posting of postings) {
      if (posting.cleared) {
        runningBalance += posting.amount;
        matched.push(posting.id);
      }
    }

    const difference = runningBalance - statementEndBalance;

    return {
      matched,
      difference,
    };
  }

  /**
   * Get reconciliation summary for an account
   */
  async getAccountReconciliationSummary(accountId: string): Promise<{
    lastReconciled: Date | null;
    unreconciledCount: number;
    unreconciledAmount: number;
  }> {
    // Get latest locked reconciliation
    const lastReconciliation = await this.prisma.reconciliation.findFirst({
      where: {
        accountId,
        locked: true,
      },
      orderBy: { statementEndDate: 'desc' },
    });

    // Count unreconciled postings
    const unreconciledPostings = await this.prisma.posting.findMany({
      where: {
        accountId,
        reconciled: false,
        transaction: {
          status: 'NORMAL',
        },
      },
    });

    const unreconciledAmount = unreconciledPostings.reduce(
      (sum, p) => sum + p.amount,
      0
    );

    return {
      lastReconciled: lastReconciliation?.statementEndDate ?? null,
      unreconciledCount: unreconciledPostings.length,
      unreconciledAmount,
    };
  }
}

export const reconciliationService = new ReconciliationService();
