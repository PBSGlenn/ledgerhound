import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { RecurringBillService } from '../recurringBillService';
import { TransactionService } from '../transactionService';
import type { PrismaClient } from '@prisma/client';
import { BillFrequency } from '@prisma/client';
import { getTestDb, resetTestDb, cleanupTestDb } from '../__test-utils__/testDb';
import { seedTestAccounts } from '../__test-utils__/fixtures';

describe('RecurringBillService', () => {
  let prisma: PrismaClient;
  let billService: RecurringBillService;
  let transactionService: TransactionService;
  let accounts: Awaited<ReturnType<typeof seedTestAccounts>>;

  beforeAll(async () => {
    prisma = await getTestDb();
  });

  beforeEach(async () => {
    await resetTestDb(prisma);
    billService = new RecurringBillService(prisma);
    transactionService = new TransactionService(prisma);
    accounts = await seedTestAccounts(prisma);
  });

  afterAll(async () => {
    await cleanupTestDb(prisma);
  });

  const createTestBill = (overrides = {}) => ({
    name: 'Electricity',
    payee: 'AGL Energy',
    expectedAmount: 150.00,
    frequency: 'MONTHLY' as BillFrequency,
    dueDay: 15,
    startDate: '2026-01-01',
    categoryAccountId: accounts.groceries.id,
    payFromAccountId: accounts.personalChecking.id,
    ...overrides,
  });

  describe('createBill', () => {
    it('should create a recurring bill with correct fields', async () => {
      const bill = await billService.createBill(createTestBill());

      expect(bill.name).toBe('Electricity');
      expect(bill.payee).toBe('AGL Energy');
      expect(bill.expectedAmount).toBe(150.00);
      expect(bill.frequency).toBe('MONTHLY');
      expect(bill.dueDay).toBe(15);
      expect(bill.status).toBe('ACTIVE');
      expect(bill.lastPaidDate).toBeNull();
      expect(bill.categoryAccount.id).toBe(accounts.groceries.id);
      expect(bill.payFromAccount.id).toBe(accounts.personalChecking.id);
    });

    it('should compute nextDueDate on or after startDate', async () => {
      const bill = await billService.createBill(createTestBill({
        startDate: '2026-03-01',
        dueDay: 15,
        frequency: 'MONTHLY',
      }));

      const nextDue = new Date(bill.nextDueDate);
      expect(nextDue.getDate()).toBe(15);
      expect(nextDue.getMonth()).toBe(2); // March
      expect(nextDue.getFullYear()).toBe(2026);
    });

    it('should compute nextDueDate in next month if dueDay already passed', async () => {
      const bill = await billService.createBill(createTestBill({
        startDate: '2026-03-20',
        dueDay: 10,
        frequency: 'MONTHLY',
      }));

      const nextDue = new Date(bill.nextDueDate);
      expect(nextDue.getDate()).toBe(10);
      expect(nextDue.getMonth()).toBe(3); // April
    });

    it('should store notes', async () => {
      const bill = await billService.createBill(createTestBill({
        notes: 'Account number 123456',
      }));

      expect(bill.notes).toBe('Account number 123456');
    });
  });

  describe('getAllBills', () => {
    it('should return all bills ordered by nextDueDate', async () => {
      await billService.createBill(createTestBill({ name: 'Later', startDate: '2026-06-01', dueDay: 1 }));
      await billService.createBill(createTestBill({ name: 'Sooner', startDate: '2026-02-01', dueDay: 1 }));

      const bills = await billService.getAllBills();
      expect(bills.length).toBe(2);
      expect(bills[0].name).toBe('Sooner');
      expect(bills[1].name).toBe('Later');
    });
  });

  describe('getBillById', () => {
    it('should return bill with account relations', async () => {
      const created = await billService.createBill(createTestBill());
      const found = await billService.getBillById(created.id);

      expect(found).not.toBeNull();
      expect(found!.categoryAccount.name).toBe('Groceries');
      expect(found!.payFromAccount.name).toBe('Personal Checking');
    });

    it('should return null for non-existent id', async () => {
      const found = await billService.getBillById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('updateBill', () => {
    it('should update bill fields', async () => {
      const bill = await billService.createBill(createTestBill());
      const updated = await billService.updateBill(bill.id, {
        name: 'Gas',
        payee: 'Origin Energy',
        expectedAmount: 200.00,
      });

      expect(updated.name).toBe('Gas');
      expect(updated.payee).toBe('Origin Energy');
      expect(updated.expectedAmount).toBe(200.00);
    });

    it('should update status to PAUSED', async () => {
      const bill = await billService.createBill(createTestBill());
      const updated = await billService.updateBill(bill.id, { status: 'PAUSED' });

      expect(updated.status).toBe('PAUSED');
    });

    it('should recompute nextDueDate when frequency changes', async () => {
      const bill = await billService.createBill(createTestBill({
        startDate: '2026-01-01',
        dueDay: 15,
        frequency: 'MONTHLY',
      }));

      const updated = await billService.updateBill(bill.id, { frequency: 'QUARTERLY' });
      const nextDue = new Date(updated.nextDueDate);
      // Should be 3 months from start
      expect(nextDue.getMonth()).toBe(3); // April
    });

    it('should throw for non-existent bill', async () => {
      await expect(billService.updateBill('non-existent', { name: 'X' }))
        .rejects.toThrow('not found');
    });
  });

  describe('deleteBill', () => {
    it('should delete a bill', async () => {
      const bill = await billService.createBill(createTestBill());
      await billService.deleteBill(bill.id);

      const found = await billService.getBillById(bill.id);
      expect(found).toBeNull();
    });
  });

  describe('recordPayment', () => {
    it('should create a transaction with correct postings', async () => {
      const bill = await billService.createBill(createTestBill({ expectedAmount: 100 }));
      const tx = await billService.recordPayment(bill.id);

      expect(tx.payee).toBe('AGL Energy');
      expect(tx.memo).toBe('Recurring: Electricity');
      expect(tx.postings.length).toBe(2);

      const bankPosting = tx.postings.find(p => p.accountId === accounts.personalChecking.id);
      const categoryPosting = tx.postings.find(p => p.accountId === accounts.groceries.id);
      expect(bankPosting!.amount).toBe(-100);
      expect(categoryPosting!.amount).toBe(100);
    });

    it('should advance nextDueDate after payment', async () => {
      const bill = await billService.createBill(createTestBill({
        startDate: '2026-03-01',
        dueDay: 15,
        frequency: 'MONTHLY',
      }));

      await billService.recordPayment(bill.id, undefined, '2026-03-15');
      const updated = await billService.getBillById(bill.id);

      expect(updated!.lastPaidDate).not.toBeNull();
      const nextDue = new Date(updated!.nextDueDate);
      expect(nextDue.getMonth()).toBe(3); // April
      expect(nextDue.getDate()).toBe(15);
    });

    it('should use override amount when provided', async () => {
      const bill = await billService.createBill(createTestBill({ expectedAmount: 100 }));
      const tx = await billService.recordPayment(bill.id, 125.50);

      const bankPosting = tx.postings.find(p => p.accountId === accounts.personalChecking.id);
      expect(bankPosting!.amount).toBe(-125.50);
    });

    it('should throw for non-existent bill', async () => {
      await expect(billService.recordPayment('non-existent'))
        .rejects.toThrow('not found');
    });
  });

  describe('skipOccurrence', () => {
    it('should advance nextDueDate without setting lastPaidDate', async () => {
      const bill = await billService.createBill(createTestBill({
        startDate: '2026-03-01',
        dueDay: 15,
        frequency: 'MONTHLY',
      }));

      const skipped = await billService.skipOccurrence(bill.id);

      expect(skipped.lastPaidDate).toBeNull();
      const nextDue = new Date(skipped.nextDueDate);
      expect(nextDue.getMonth()).toBe(3); // April
      expect(nextDue.getDate()).toBe(15);
    });

    it('should throw for non-existent bill', async () => {
      await expect(billService.skipOccurrence('non-existent'))
        .rejects.toThrow('not found');
    });
  });

  describe('getUpcomingBills', () => {
    it('should return active bills within the window', async () => {
      // Create a bill with nextDueDate in the past (overdue)
      const bill = await billService.createBill(createTestBill({
        startDate: '2025-01-01',
        dueDay: 1,
        frequency: 'MONTHLY',
      }));

      // The bill's nextDueDate should be Feb 1 2025, which is in the past
      const upcoming = await billService.getUpcomingBills(9999);
      expect(upcoming.length).toBe(1);
      expect(upcoming[0].isOverdue).toBe(true);
      expect(upcoming[0].daysUntilDue).toBeLessThan(0);
    });

    it('should exclude paused bills', async () => {
      const bill = await billService.createBill(createTestBill({
        startDate: '2025-01-01',
        dueDay: 1,
      }));
      await billService.updateBill(bill.id, { status: 'PAUSED' });

      const upcoming = await billService.getUpcomingBills(9999);
      expect(upcoming.length).toBe(0);
    });

    it('should include bill name and account names', async () => {
      await billService.createBill(createTestBill({
        startDate: '2025-01-01',
        dueDay: 1,
      }));

      const upcoming = await billService.getUpcomingBills(9999);
      expect(upcoming[0].name).toBe('Electricity');
      expect(upcoming[0].payFromAccountName).toBe('Personal Checking');
      expect(upcoming[0].categoryAccountName).toBe('Groceries');
    });
  });

  describe('getUpcomingCount', () => {
    it('should return correct overdue and upcoming counts', async () => {
      // Overdue bill (past date)
      await billService.createBill(createTestBill({
        name: 'Past Bill',
        startDate: '2025-01-01',
        dueDay: 1,
      }));

      const count = await billService.getUpcomingCount(9999);
      expect(count.overdue).toBe(1);
      expect(count.upcoming).toBe(0);
    });
  });

  describe('computeNextDueDate', () => {
    it('should add 7 days for WEEKLY', () => {
      const after = new Date(2026, 2, 10); // March 10
      const next = billService.computeNextDueDate('WEEKLY', 1, after);
      expect(next.getDate()).toBe(17);
      expect(next.getMonth()).toBe(2); // March
    });

    it('should add 14 days for FORTNIGHTLY', () => {
      const after = new Date(2026, 2, 10); // March 10
      const next = billService.computeNextDueDate('FORTNIGHTLY', 1, after);
      expect(next.getDate()).toBe(24);
      expect(next.getMonth()).toBe(2); // March
    });

    it('should go to next month same day for MONTHLY', () => {
      const after = new Date('2026-03-15');
      const next = billService.computeNextDueDate('MONTHLY', 15, after);
      expect(next.getDate()).toBe(15);
      expect(next.getMonth()).toBe(3); // April
    });

    it('should clamp to month end for MONTHLY (31st in April)', () => {
      const after = new Date('2026-03-31');
      const next = billService.computeNextDueDate('MONTHLY', 31, after);
      // April has 30 days
      expect(next.getDate()).toBe(30);
      expect(next.getMonth()).toBe(3); // April
    });

    it('should clamp to Feb 28 for MONTHLY (31st)', () => {
      const after = new Date('2026-01-31');
      const next = billService.computeNextDueDate('MONTHLY', 31, after);
      expect(next.getDate()).toBe(28);
      expect(next.getMonth()).toBe(1); // February
    });

    it('should go 3 months ahead for QUARTERLY', () => {
      const after = new Date('2026-01-15');
      const next = billService.computeNextDueDate('QUARTERLY', 15, after);
      expect(next.getDate()).toBe(15);
      expect(next.getMonth()).toBe(3); // April
    });

    it('should go 12 months ahead for YEARLY', () => {
      const after = new Date('2026-03-15');
      const next = billService.computeNextDueDate('YEARLY', 15, after);
      expect(next.getDate()).toBe(15);
      expect(next.getMonth()).toBe(2); // March
      expect(next.getFullYear()).toBe(2027);
    });
  });

  describe('computeFirstDueDate', () => {
    it('should return same month if dueDay has not passed', () => {
      const start = new Date('2026-03-01');
      const first = billService.computeFirstDueDate('MONTHLY', 15, start);
      expect(first.getDate()).toBe(15);
      expect(first.getMonth()).toBe(2); // March
    });

    it('should return next month if dueDay already passed', () => {
      const start = new Date('2026-03-20');
      const first = billService.computeFirstDueDate('MONTHLY', 10, start);
      expect(first.getDate()).toBe(10);
      expect(first.getMonth()).toBe(3); // April
    });

    it('should find next matching weekday for WEEKLY', () => {
      // 2026-03-02 is a Monday (day 1)
      const start = new Date('2026-03-02');
      const first = billService.computeFirstDueDate('WEEKLY', 3, start); // Wednesday
      expect(first.getDay()).toBe(3); // Wednesday
      expect(first.getDate()).toBe(4); // March 4
    });

    it('should return same day if start is on the dueDay for WEEKLY', () => {
      // 2026-03-02 is a Monday (day 1)
      const start = new Date('2026-03-02');
      const first = billService.computeFirstDueDate('WEEKLY', 1, start); // Monday
      expect(first.getDay()).toBe(1); // Monday
      expect(first.getDate()).toBe(2); // Same day
    });
  });
});
