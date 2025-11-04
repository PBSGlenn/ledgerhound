import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { ReconciliationService } from '../reconciliationService';
import { TransactionService } from '../transactionService';
import { AccountService } from '../accountService';
import type { PrismaClient } from '@prisma/client';
import { createTestDb, resetTestDb, cleanupTestDb } from '../__test-utils__/testDb';
import { seedTestAccounts } from '../__test-utils__/fixtures';

describe('ReconciliationService', () => {
  let prisma: PrismaClient;
  let reconciliationService: ReconciliationService;
  let transactionService: TransactionService;
  let accountService: AccountService;
  let accounts: Awaited<ReturnType<typeof seedTestAccounts>>;

  beforeEach(async () => {
    prisma = await createTestDb();
    await resetTestDb(prisma);
    accountService = new AccountService(prisma);
    reconciliationService = new ReconciliationService(prisma, accountService);
    transactionService = new TransactionService(prisma);
    accounts = await seedTestAccounts(prisma);
  });

  afterAll(async () => {
    await cleanupTestDb(prisma);
  });

  describe('createReconciliation', () => {
    it('should create a new reconciliation session', async () => {
      const reconciliation = await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 1500,
      });

      expect(reconciliation.accountId).toBe(accounts.personalChecking.id);
      expect(reconciliation.statementStartBalance).toBe(1000);
      expect(reconciliation.statementEndBalance).toBe(1500);
      expect(reconciliation.locked).toBe(false);
    });

    it('should create reconciliation with notes', async () => {
      const reconciliation = await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 1500,
        notes: 'January 2025 statement',
      });

      expect(reconciliation.notes).toBe('January 2025 statement');
    });
  });

  describe('getReconciliationById', () => {
    it('should get reconciliation with postings', async () => {
      const created = await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 1500,
      });

      const retrieved = await reconciliationService.getReconciliationById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.account).toBeDefined();
      expect(retrieved?.postings).toBeDefined();
    });

    it('should return null for non-existent reconciliation', async () => {
      const reconciliation = await reconciliationService.getReconciliationById('non-existent-id');
      expect(reconciliation).toBeNull();
    });
  });

  describe('getReconciliations', () => {
    it('should get all reconciliations for an account', async () => {
      await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 1500,
      });

      await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-02-01'),
        statementEndDate: new Date('2025-02-28'),
        statementStartBalance: 1500,
        statementEndBalance: 2000,
      });

      const reconciliations = await reconciliationService.getReconciliations(
        accounts.personalChecking.id
      );

      expect(reconciliations).toHaveLength(2);
      expect(reconciliations.every((r) => r.accountId === accounts.personalChecking.id)).toBe(true);
    });

    it('should get all reconciliations across all accounts', async () => {
      await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 1500,
      });

      await reconciliationService.createReconciliation({
        accountId: accounts.creditCard.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 0,
        statementEndBalance: -500,
      });

      const allReconciliations = await reconciliationService.getReconciliations();

      expect(allReconciliations).toHaveLength(2);
    });
  });

  describe('getUnreconciledPostings', () => {
    beforeEach(async () => {
      // Create transactions with postings
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Test Payee 1',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -100, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 100, isBusiness: false },
        ],
      });

      await transactionService.createTransaction({
        date: new Date('2025-01-20'),
        payee: 'Test Payee 2',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -50, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 50, isBusiness: false },
        ],
      });
    });

    it('should get unreconciled postings in date range', async () => {
      const postings = await reconciliationService.getUnreconciledPostings(
        accounts.personalChecking.id,
        new Date('2025-01-01'),
        new Date('2025-01-31')
      );

      expect(postings).toHaveLength(2);
      expect(postings.every((p) => !p.reconciled)).toBe(true);
      expect(postings.every((p) => p.accountId === accounts.personalChecking.id)).toBe(true);
    });

    it('should exclude postings outside date range', async () => {
      const postings = await reconciliationService.getUnreconciledPostings(
        accounts.personalChecking.id,
        new Date('2025-01-01'),
        new Date('2025-01-14')
      );

      expect(postings).toHaveLength(0);
    });
  });

  describe('getReconciliationStatus', () => {
    it('should calculate reconciliation status correctly', async () => {
      // Set opening balance
      await accountService.updateAccount(accounts.personalChecking.id, {
        openingBalance: 1000,
      });

      // Create transactions
      const tx1 = await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Deposit',
        postings: [
          { accountId: accounts.personalChecking.id, amount: 500, isBusiness: false },
          { accountId: accounts.salary.id, amount: -500, isBusiness: false },
        ],
      });

      const tx2 = await transactionService.createTransaction({
        date: new Date('2025-01-20'),
        payee: 'Withdrawal',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -200, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 200, isBusiness: false },
        ],
      });

      // Create reconciliation
      const reconciliation = await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 1300, // 1000 + 500 - 200
      });

      // Mark postings as cleared
      const postings = await prisma.posting.findMany({
        where: { accountId: accounts.personalChecking.id },
      });

      await prisma.posting.updateMany({
        where: { id: { in: postings.map((p) => p.id) } },
        data: { cleared: true },
      });

      const status = await reconciliationService.getReconciliationStatus(reconciliation.id);

      expect(status.statementBalance).toBe(1300);
      expect(status.clearedBalance).toBe(1300); // 1000 + 500 - 200
      expect(status.isBalanced).toBe(true);
      expect(status.difference).toBeCloseTo(0, 2);
    });

    it('should identify unbalanced reconciliation', async () => {
      await accountService.updateAccount(accounts.personalChecking.id, {
        openingBalance: 1000,
      });

      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Test',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -100, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 100, isBusiness: false },
        ],
      });

      const reconciliation = await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 1000, // Should be 900 after -100 transaction
      });

      // Mark posting as cleared
      const postings = await prisma.posting.findMany({
        where: { accountId: accounts.personalChecking.id },
      });

      await prisma.posting.updateMany({
        where: { id: { in: postings.map((p) => p.id) } },
        data: { cleared: true },
      });

      const status = await reconciliationService.getReconciliationStatus(reconciliation.id);

      expect(status.isBalanced).toBe(false);
      expect(status.difference).toBeCloseTo(-100, 2);
    });
  });

  describe('reconcilePostings', () => {
    it('should mark postings as reconciled', async () => {
      const tx = await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Test',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -100, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 100, isBusiness: false },
        ],
      });

      const reconciliation = await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 900,
      });

      const postings = await prisma.posting.findMany({
        where: { accountId: accounts.personalChecking.id },
      });

      await reconciliationService.reconcilePostings(
        reconciliation.id,
        postings.map((p) => p.id)
      );

      const reconciledPostings = await prisma.posting.findMany({
        where: { id: { in: postings.map((p) => p.id) } },
      });

      expect(reconciledPostings.every((p) => p.reconciled)).toBe(true);
      expect(reconciledPostings.every((p) => p.cleared)).toBe(true);
      expect(reconciledPostings.every((p) => p.reconcileId === reconciliation.id)).toBe(true);
    });

    it('should throw error for locked reconciliation', async () => {
      const reconciliation = await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 1000,
      });

      await prisma.reconciliation.update({
        where: { id: reconciliation.id },
        data: { locked: true },
      });

      await expect(
        reconciliationService.reconcilePostings(reconciliation.id, ['posting-id'])
      ).rejects.toThrow('Cannot modify a locked reconciliation');
    });
  });

  describe('unreconcilePostings', () => {
    it('should unmark postings as reconciled', async () => {
      const tx = await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Test',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -100, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 100, isBusiness: false },
        ],
      });

      const reconciliation = await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 900,
      });

      const postings = await prisma.posting.findMany({
        where: { accountId: accounts.personalChecking.id },
      });

      // First reconcile
      await reconciliationService.reconcilePostings(
        reconciliation.id,
        postings.map((p) => p.id)
      );

      // Then unreconcile
      await reconciliationService.unreconcilePostings(
        reconciliation.id,
        postings.map((p) => p.id)
      );

      const unreconciledPostings = await prisma.posting.findMany({
        where: { id: { in: postings.map((p) => p.id) } },
      });

      expect(unreconciledPostings.every((p) => !p.reconciled)).toBe(true);
      expect(unreconciledPostings.every((p) => p.reconcileId === null)).toBe(true);
    });

    it('should throw error for locked reconciliation', async () => {
      const reconciliation = await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 1000,
      });

      await prisma.reconciliation.update({
        where: { id: reconciliation.id },
        data: { locked: true },
      });

      await expect(
        reconciliationService.unreconcilePostings(reconciliation.id, ['posting-id'])
      ).rejects.toThrow('Cannot modify a locked reconciliation');
    });
  });

  describe('lockReconciliation', () => {
    it('should lock balanced reconciliation', async () => {
      await accountService.updateAccount(accounts.personalChecking.id, {
        openingBalance: 1000,
      });

      const reconciliation = await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 1000, // No transactions, so balanced
      });

      const locked = await reconciliationService.lockReconciliation(reconciliation.id);

      expect(locked.locked).toBe(true);
    });

    it('should not lock unbalanced reconciliation', async () => {
      await accountService.updateAccount(accounts.personalChecking.id, {
        openingBalance: 1000,
      });

      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Test',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -100, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 100, isBusiness: false },
        ],
      });

      // Mark posting as cleared
      const postings = await prisma.posting.findMany({
        where: { accountId: accounts.personalChecking.id },
      });

      await prisma.posting.updateMany({
        where: { id: { in: postings.map((p) => p.id) } },
        data: { cleared: true },
      });

      const reconciliation = await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 1000, // Should be 900, so unbalanced
      });

      await expect(
        reconciliationService.lockReconciliation(reconciliation.id)
      ).rejects.toThrow('Cannot lock reconciliation with difference');
    });
  });

  describe('unlockReconciliation', () => {
    it('should unlock locked reconciliation', async () => {
      const reconciliation = await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 1000,
      });

      await prisma.reconciliation.update({
        where: { id: reconciliation.id },
        data: { locked: true },
      });

      const unlocked = await reconciliationService.unlockReconciliation(reconciliation.id);

      expect(unlocked.locked).toBe(false);
    });
  });

  describe('updateReconciliation', () => {
    it('should update reconciliation statement details', async () => {
      const reconciliation = await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 1500,
      });

      const updated = await reconciliationService.updateReconciliation(reconciliation.id, {
        statementEndBalance: 1600,
        notes: 'Updated balance',
      });

      expect(updated.statementEndBalance).toBe(1600);
      expect(updated.notes).toBe('Updated balance');
    });

    it('should throw error for locked reconciliation', async () => {
      const reconciliation = await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 1000,
      });

      await prisma.reconciliation.update({
        where: { id: reconciliation.id },
        data: { locked: true },
      });

      await expect(
        reconciliationService.updateReconciliation(reconciliation.id, {
          statementEndBalance: 1100,
        })
      ).rejects.toThrow('Cannot modify a locked reconciliation');
    });
  });

  describe('deleteReconciliation', () => {
    it('should delete reconciliation and unreconcile postings', async () => {
      const tx = await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Test',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -100, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 100, isBusiness: false },
        ],
      });

      const reconciliation = await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 900,
      });

      const postings = await prisma.posting.findMany({
        where: { accountId: accounts.personalChecking.id },
      });

      await reconciliationService.reconcilePostings(
        reconciliation.id,
        postings.map((p) => p.id)
      );

      await reconciliationService.deleteReconciliation(reconciliation.id);

      // Check reconciliation deleted
      const deleted = await reconciliationService.getReconciliationById(reconciliation.id);
      expect(deleted).toBeNull();

      // Check postings unreconciled
      const unreconciledPostings = await prisma.posting.findMany({
        where: { id: { in: postings.map((p) => p.id) } },
      });

      expect(unreconciledPostings.every((p) => !p.reconciled)).toBe(true);
      expect(unreconciledPostings.every((p) => p.reconcileId === null)).toBe(true);
    });

    it('should not delete locked reconciliation', async () => {
      const reconciliation = await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 1000,
      });

      await prisma.reconciliation.update({
        where: { id: reconciliation.id },
        data: { locked: true },
      });

      await expect(
        reconciliationService.deleteReconciliation(reconciliation.id)
      ).rejects.toThrow('Cannot delete a locked reconciliation');
    });
  });

  describe('autoReconcile', () => {
    it('should auto-reconcile cleared postings', async () => {
      await accountService.updateAccount(accounts.personalChecking.id, {
        openingBalance: 1000,
      });

      const tx1 = await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Deposit',
        postings: [
          { accountId: accounts.personalChecking.id, amount: 500, isBusiness: false },
          { accountId: accounts.salary.id, amount: -500, isBusiness: false },
        ],
      });

      const tx2 = await transactionService.createTransaction({
        date: new Date('2025-01-20'),
        payee: 'Withdrawal',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -200, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 200, isBusiness: false },
        ],
      });

      // Mark first posting as cleared
      const postings = await prisma.posting.findMany({
        where: {
          accountId: accounts.personalChecking.id,
          transaction: { date: new Date('2025-01-15') },
        },
      });

      await prisma.posting.updateMany({
        where: { id: { in: postings.map((p) => p.id) } },
        data: { cleared: true },
      });

      const result = await reconciliationService.autoReconcile(
        accounts.personalChecking.id,
        new Date('2025-01-31'),
        1500 // 1000 + 500
      );

      expect(result.matched).toHaveLength(1);
      expect(result.difference).toBeCloseTo(0, 2);
    });
  });

  describe('getAccountReconciliationSummary', () => {
    it('should return summary with no reconciliations', async () => {
      const summary = await reconciliationService.getAccountReconciliationSummary(
        accounts.personalChecking.id
      );

      expect(summary.lastReconciled).toBeNull();
      expect(summary.unreconciledCount).toBe(0);
      expect(summary.unreconciledAmount).toBe(0);
    });

    it('should return summary with unreconciled transactions', async () => {
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Test',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -100, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 100, isBusiness: false },
        ],
      });

      await transactionService.createTransaction({
        date: new Date('2025-01-20'),
        payee: 'Test 2',
        postings: [
          { accountId: accounts.personalChecking.id, amount: -50, isBusiness: false },
          { accountId: accounts.groceries.id, amount: 50, isBusiness: false },
        ],
      });

      const summary = await reconciliationService.getAccountReconciliationSummary(
        accounts.personalChecking.id
      );

      expect(summary.unreconciledCount).toBe(2);
      expect(summary.unreconciledAmount).toBe(-150);
    });

    it('should include last reconciled date', async () => {
      await accountService.updateAccount(accounts.personalChecking.id, {
        openingBalance: 1000,
      });

      const reconciliation = await reconciliationService.createReconciliation({
        accountId: accounts.personalChecking.id,
        statementStartDate: new Date('2025-01-01'),
        statementEndDate: new Date('2025-01-31'),
        statementStartBalance: 1000,
        statementEndBalance: 1000,
      });

      // Lock the reconciliation
      await reconciliationService.lockReconciliation(reconciliation.id);

      const summary = await reconciliationService.getAccountReconciliationSummary(
        accounts.personalChecking.id
      );

      expect(summary.lastReconciled).toEqual(new Date('2025-01-31'));
    });
  });
});
