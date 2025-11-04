import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaClient, AccountType, GSTCode } from '@prisma/client';
import { createTestDb, resetTestDb, cleanupTestDb } from '../__test-utils__/testDb';
import { seedTestAccounts } from '../__test-utils__/fixtures';
import { expectPostingsSumToZero, calculateGST, calculateAmountExGST } from '../__test-utils__/helpers';
import { TransactionService } from '../transactionService';
import type { CreateTransactionDTO } from '../../../types';

describe('TransactionService', () => {
  let prisma: PrismaClient;
  let transactionService: TransactionService;
  let accounts: Awaited<ReturnType<typeof seedTestAccounts>>;

  beforeEach(async () => {
    prisma = await createTestDb();
    await resetTestDb(prisma);
    transactionService = new TransactionService(prisma);
    accounts = await seedTestAccounts(prisma);
  });

  afterAll(async () => {
    await cleanupTestDb(prisma);
  });

  describe('createTransaction', () => {
    describe('simple transactions', () => {
      it('should create a simple personal transaction', async () => {
        const transactionData: CreateTransactionDTO = {
          date: new Date('2025-01-15'),
          payee: 'Woolworths',
          memo: 'Weekly shopping',
          postings: [
            {
              accountId: accounts.personalChecking.id,
              amount: -110,
              isBusiness: false,
            },
            {
              accountId: accounts.groceries.id,
              amount: 110,
              isBusiness: false,
            },
          ],
        };

        const transaction = await transactionService.createTransaction(transactionData);

        expect(transaction.id).toBeDefined();
        expect(transaction.payee).toBe('Woolworths');
        expect(transaction.postings).toHaveLength(2);
        expectPostingsSumToZero(transaction.postings);
      });

      it('should create a simple business transaction with GST', async () => {
        const amountIncGst = 110;
        const gstAmount = calculateGST(amountIncGst);
        const amountExGst = calculateAmountExGST(amountIncGst);

        const transactionData: CreateTransactionDTO = {
          date: new Date('2025-01-16'),
          payee: 'Officeworks',
          memo: 'Office supplies',
          postings: [
            {
              accountId: accounts.businessChecking.id,
              amount: -amountIncGst,
              isBusiness: false,
            },
            {
              accountId: accounts.officeSupplies.id,
              amount: amountExGst,
              isBusiness: true,
              gstCode: GSTCode.GST,
              gstRate: 0.1,
              gstAmount,
            },
            {
              accountId: accounts.gstPaid.id,
              amount: gstAmount,
              isBusiness: true,
            },
          ],
        };

        const transaction = await transactionService.createTransaction(transactionData);

        expect(transaction.postings).toHaveLength(3);
        expectPostingsSumToZero(transaction.postings);

        // Verify GST posting
        const gstPosting = transaction.postings.find(
          (p) => p.accountId === accounts.gstPaid.id
        );
        expect(gstPosting?.amount).toBeCloseTo(gstAmount, 2);
      });
    });

    describe('split transactions', () => {
      it('should create a split transaction with multiple categories', async () => {
        const transactionData: CreateTransactionDTO = {
          date: new Date('2025-01-17'),
          payee: 'Various Vendors',
          memo: 'Mixed expenses',
          postings: [
            {
              accountId: accounts.creditCard.id,
              amount: -150,
              isBusiness: false,
            },
            {
              accountId: accounts.groceries.id,
              amount: 80,
              isBusiness: false,
            },
            {
              accountId: accounts.officeSupplies.id,
              amount: 50,
              isBusiness: false,
            },
            {
              accountId: accounts.salary.id,
              amount: 20,
              isBusiness: false,
            },
          ],
        };

        const transaction = await transactionService.createTransaction(transactionData);

        expect(transaction.postings).toHaveLength(4);
        expectPostingsSumToZero(transaction.postings);
      });

      it('should create a split with mixed business and personal postings', async () => {
        const businessAmount = 90.91;
        const businessGst = calculateGST(businessAmount);
        const businessExGst = calculateAmountExGST(businessAmount);
        const personalAmount = 59.09;

        const transactionData: CreateTransactionDTO = {
          date: new Date('2025-01-18'),
          payee: 'Restaurant',
          memo: 'Business lunch + personal',
          postings: [
            {
              accountId: accounts.creditCard.id,
              amount: -(businessAmount + personalAmount),
              isBusiness: false,
            },
            {
              accountId: accounts.officeSupplies.id, // Business meals category
              amount: businessExGst,
              isBusiness: true,
              gstCode: GSTCode.GST,
              gstRate: 0.1,
              gstAmount: businessGst,
            },
            {
              accountId: accounts.gstPaid.id,
              amount: businessGst,
              isBusiness: true,
            },
            {
              accountId: accounts.groceries.id, // Personal dining
              amount: personalAmount,
              isBusiness: false,
            },
          ],
        };

        const transaction = await transactionService.createTransaction(transactionData);

        expect(transaction.postings).toHaveLength(4);
        expectPostingsSumToZero(transaction.postings);

        const businessPosting = transaction.postings.find(
          (p) => p.accountId === accounts.officeSupplies.id
        );
        expect(businessPosting?.isBusiness).toBe(true);
        expect(businessPosting?.gstAmount).toBeCloseTo(businessGst, 2);

        const personalPosting = transaction.postings.find(
          (p) => p.accountId === accounts.groceries.id
        );
        expect(personalPosting?.isBusiness).toBe(false);
        expect(personalPosting?.gstAmount).toBeNull();
      });
    });

    describe('transfer transactions', () => {
      it('should create a transfer between accounts', async () => {
        const transactionData: CreateTransactionDTO = {
          date: new Date('2025-01-19'),
          payee: 'Transfer',
          memo: 'Move to savings',
          postings: [
            {
              accountId: accounts.personalChecking.id,
              amount: -500,
              isBusiness: false,
            },
            {
              accountId: accounts.businessChecking.id,
              amount: 500,
              isBusiness: false,
            },
          ],
        };

        const transaction = await transactionService.createTransaction(transactionData);

        expect(transaction.postings).toHaveLength(2);
        expectPostingsSumToZero(transaction.postings);

        // Transfers should not have GST
        transaction.postings.forEach((posting) => {
          expect(posting.gstAmount).toBeNull();
          expect(posting.gstCode).toBeNull();
        });
      });
    });

    describe('validation', () => {
      it('should reject transaction with postings that do not sum to zero', async () => {
        const transactionData: CreateTransactionDTO = {
          date: new Date(),
          payee: 'Invalid Transaction',
          postings: [
            {
              accountId: accounts.personalChecking.id,
              amount: -100,
              isBusiness: false,
            },
            {
              accountId: accounts.groceries.id,
              amount: 110, // Does not balance!
              isBusiness: false,
            },
          ],
        };

        await expect(
          transactionService.createTransaction(transactionData)
        ).rejects.toThrow('must sum to zero');
      });

      it('should reject personal posting with GST information', async () => {
        const transactionData: CreateTransactionDTO = {
          date: new Date(),
          payee: 'Invalid GST Transaction',
          postings: [
            {
              accountId: accounts.personalChecking.id,
              amount: -110,
              isBusiness: false,
            },
            {
              accountId: accounts.groceries.id,
              amount: 110,
              isBusiness: false, // Personal but has GST!
              gstCode: GSTCode.GST,
              gstRate: 0.1,
              gstAmount: 10,
            },
          ],
        };

        await expect(
          transactionService.createTransaction(transactionData)
        ).rejects.toThrow('cannot have GST information');
      });

      it('should accept business posting without GST for GST-free items', async () => {
        const transactionData: CreateTransactionDTO = {
          date: new Date(),
          payee: 'GST-Free Business Expense',
          postings: [
            {
              accountId: accounts.businessChecking.id,
              amount: -100,
              isBusiness: false,
            },
            {
              accountId: accounts.officeSupplies.id,
              amount: 100,
              isBusiness: true,
              gstCode: GSTCode.GST_FREE,
            },
          ],
        };

        const transaction = await transactionService.createTransaction(transactionData);

        expect(transaction.postings).toHaveLength(2);
        expectPostingsSumToZero(transaction.postings);

        const businessPosting = transaction.postings.find(
          (p) => p.accountId === accounts.officeSupplies.id
        );
        expect(businessPosting?.isBusiness).toBe(true);
        expect(businessPosting?.gstCode).toBe(GSTCode.GST_FREE);
        expect(businessPosting?.gstAmount).toBeNull();
      });

      it('should require date', async () => {
        const transactionData: any = {
          payee: 'Missing Date',
          postings: [
            {
              accountId: accounts.personalChecking.id,
              amount: -100,
              isBusiness: false,
            },
            {
              accountId: accounts.groceries.id,
              amount: 100,
              isBusiness: false,
            },
          ],
        };

        await expect(
          transactionService.createTransaction(transactionData)
        ).rejects.toThrow();
      });

      it('should require at least 2 postings', async () => {
        const transactionData: CreateTransactionDTO = {
          date: new Date(),
          payee: 'Single Posting',
          postings: [
            {
              accountId: accounts.personalChecking.id,
              amount: -100,
              isBusiness: false,
            },
          ],
        };

        // Single posting will fail double-entry validation (must sum to zero)
        await expect(
          transactionService.createTransaction(transactionData)
        ).rejects.toThrow('must sum to zero');
      });
    });

    describe('metadata', () => {
      it('should store metadata for Stripe transactions', async () => {
        const metadata = {
          stripeTransactionId: 'txn_123456',
          stripeType: 'charge',
          grossAmount: 220,
          feeAmount: 4.04,
          netAmount: 215.96,
        };

        const transactionData: CreateTransactionDTO = {
          date: new Date(),
          payee: 'Stripe Charge',
          externalId: 'txn_123456',
          metadata,
          postings: [
            {
              accountId: accounts.businessChecking.id,
              amount: 215.96,
              isBusiness: false,
            },
            {
              accountId: accounts.salesIncome.id,
              amount: -215.96,
              isBusiness: false,
            },
          ],
        };

        const transaction = await transactionService.createTransaction(transactionData);

        expect(transaction.externalId).toBe('txn_123456');
        expect(JSON.parse(transaction.metadata as string)).toEqual(metadata);
      });
    });
  });

  describe('updateTransaction', () => {
    it('should update transaction fields', async () => {
      // Create initial transaction
      const transaction = await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Original Payee',
        memo: 'Original memo',
        postings: [
          {
            accountId: accounts.personalChecking.id,
            amount: -100,
            isBusiness: false,
          },
          {
            accountId: accounts.groceries.id,
            amount: 100,
            isBusiness: false,
          },
        ],
      });

      // Update it
      const updated = await transactionService.updateTransaction({
        id: transaction.id,
        payee: 'Updated Payee',
        memo: 'Updated memo',
        tags: ['important', 'personal'],
      });

      expect(updated.payee).toBe('Updated Payee');
      expect(updated.memo).toBe('Updated memo');
      expect(JSON.parse(updated.tags as string)).toEqual(['important', 'personal']);
      expect(updated.postings).toHaveLength(2); // Postings unchanged
    });

    it('should update postings and maintain double-entry', async () => {
      const transaction = await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Original',
        postings: [
          {
            accountId: accounts.personalChecking.id,
            amount: -100,
            isBusiness: false,
          },
          {
            accountId: accounts.groceries.id,
            amount: 100,
            isBusiness: false,
          },
        ],
      });

      const updated = await transactionService.updateTransaction({
        id: transaction.id,
        postings: [
          {
            accountId: accounts.personalChecking.id,
            amount: -150,
            isBusiness: false,
          },
          {
            accountId: accounts.groceries.id,
            amount: 150,
            isBusiness: false,
          },
        ],
      });

      expect(updated.postings).toHaveLength(2);
      expectPostingsSumToZero(updated.postings);
      expect(updated.postings[1].amount).toBe(150);
    });

    it('should reject update with unbalanced postings', async () => {
      const transaction = await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Original',
        postings: [
          {
            accountId: accounts.personalChecking.id,
            amount: -100,
            isBusiness: false,
          },
          {
            accountId: accounts.groceries.id,
            amount: 100,
            isBusiness: false,
          },
        ],
      });

      await expect(
        transactionService.updateTransaction({
          id: transaction.id,
          postings: [
            {
              accountId: accounts.personalChecking.id,
              amount: -100,
              isBusiness: false,
            },
            {
              accountId: accounts.groceries.id,
              amount: 110, // Unbalanced!
              isBusiness: false,
            },
          ],
        })
      ).rejects.toThrow('must sum to zero');
    });
  });

  describe('deleteTransaction', () => {
    it('should delete a transaction and its postings', async () => {
      const transaction = await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'To Be Deleted',
        postings: [
          {
            accountId: accounts.personalChecking.id,
            amount: -100,
            isBusiness: false,
          },
          {
            accountId: accounts.groceries.id,
            amount: 100,
            isBusiness: false,
          },
        ],
      });

      await transactionService.deleteTransaction(transaction.id);

      const fetched = await transactionService.getTransactionById(transaction.id);
      expect(fetched).toBeNull();

      // Verify postings are also deleted
      const postings = await prisma.posting.findMany({
        where: { transactionId: transaction.id },
      });
      expect(postings).toHaveLength(0);
    });
  });

  describe('voidTransaction', () => {
    it('should void a transaction (mark as VOID)', async () => {
      const transaction = await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'To Be Voided',
        postings: [
          {
            accountId: accounts.personalChecking.id,
            amount: -100,
            isBusiness: false,
          },
          {
            accountId: accounts.groceries.id,
            amount: 100,
            isBusiness: false,
          },
        ],
      });

      const voided = await transactionService.voidTransaction(transaction.id);

      expect(voided.status).toBe('VOID');

      // Voided transactions should not appear in balances
      const balance = await prisma.posting.findMany({
        where: {
          accountId: accounts.personalChecking.id,
          transaction: { status: 'NORMAL' },
        },
      });
      expect(balance).toHaveLength(0);
    });
  });

  describe('getTransactionById', () => {
    it('should get transaction with postings', async () => {
      const created = await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Test Transaction',
        memo: 'Test memo',
        postings: [
          {
            accountId: accounts.personalChecking.id,
            amount: -100,
            isBusiness: false,
          },
          {
            accountId: accounts.groceries.id,
            amount: 100,
            isBusiness: false,
          },
        ],
      });

      const fetched = await transactionService.getTransactionById(created.id);

      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.payee).toBe('Test Transaction');
      expect(fetched?.postings).toHaveLength(2);
    });

    it('should return null for non-existent transaction', async () => {
      const transaction = await transactionService.getTransactionById('non-existent-id');

      expect(transaction).toBeNull();
    });
  });

  describe('getRegisterEntries', () => {
    it('should get register entries for an account', async () => {
      // Create several transactions
      await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Transaction 1',
        postings: [
          {
            accountId: accounts.personalChecking.id,
            amount: -100,
            isBusiness: false,
          },
          {
            accountId: accounts.groceries.id,
            amount: 100,
            isBusiness: false,
          },
        ],
      });

      await transactionService.createTransaction({
        date: new Date('2025-01-16'),
        payee: 'Transaction 2',
        postings: [
          {
            accountId: accounts.personalChecking.id,
            amount: -50,
            isBusiness: false,
          },
          {
            accountId: accounts.groceries.id,
            amount: 50,
            isBusiness: false,
          },
        ],
      });

      const entries = await transactionService.getRegisterEntries(
        accounts.personalChecking.id
      );

      // Should have opening balance + 2 transactions = 3 entries
      expect(entries.length).toBe(3);
      // First entry is opening balance
      expect(entries[0].payee).toBe('Opening Balance');
    });

    it('should filter register entries by date range', async () => {
      await transactionService.createTransaction({
        date: new Date('2025-01-10'),
        payee: 'Old Transaction',
        postings: [
          {
            accountId: accounts.personalChecking.id,
            amount: -100,
            isBusiness: false,
          },
          {
            accountId: accounts.groceries.id,
            amount: 100,
            isBusiness: false,
          },
        ],
      });

      await transactionService.createTransaction({
        date: new Date('2025-01-20'),
        payee: 'New Transaction',
        postings: [
          {
            accountId: accounts.personalChecking.id,
            amount: -50,
            isBusiness: false,
          },
          {
            accountId: accounts.groceries.id,
            amount: 50,
            isBusiness: false,
          },
        ],
      });

      const entries = await transactionService.getRegisterEntries(
        accounts.personalChecking.id,
        {
          dateFrom: new Date('2025-01-15'),
          dateTo: new Date('2025-01-25'),
        }
      );

      // Should have opening balance + 1 transaction in date range = 2 entries
      expect(entries.length).toBe(2);
      expect(entries[0].payee).toBe('Opening Balance');
      expect(entries[1].payee).toBe('New Transaction');
    });
  });

  describe('markCleared', () => {
    it('should mark postings as cleared', async () => {
      const transaction = await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'To Be Cleared',
        postings: [
          {
            accountId: accounts.personalChecking.id,
            amount: -100,
            isBusiness: false,
          },
          {
            accountId: accounts.groceries.id,
            amount: 100,
            isBusiness: false,
          },
        ],
      });

      const postingIds = transaction.postings.map((p) => p.id);
      await transactionService.markCleared(postingIds, true);

      const updated = await transactionService.getTransactionById(transaction.id);
      updated?.postings.forEach((posting) => {
        expect(posting.cleared).toBe(true);
      });
    });
  });

  describe('bulkAddTags', () => {
    it('should add tags to multiple transactions', async () => {
      const t1 = await transactionService.createTransaction({
        date: new Date('2025-01-15'),
        payee: 'Transaction 1',
        postings: [
          {
            accountId: accounts.personalChecking.id,
            amount: -100,
            isBusiness: false,
          },
          {
            accountId: accounts.groceries.id,
            amount: 100,
            isBusiness: false,
          },
        ],
      });

      const t2 = await transactionService.createTransaction({
        date: new Date('2025-01-16'),
        payee: 'Transaction 2',
        postings: [
          {
            accountId: accounts.personalChecking.id,
            amount: -50,
            isBusiness: false,
          },
          {
            accountId: accounts.groceries.id,
            amount: 50,
            isBusiness: false,
          },
        ],
      });

      await transactionService.bulkAddTags([t1.id, t2.id], ['bulk', 'important']);

      const updated1 = await transactionService.getTransactionById(t1.id);
      const updated2 = await transactionService.getTransactionById(t2.id);

      expect(updated1?.tags).toContain('bulk');
      expect(updated1?.tags).toContain('important');
      expect(updated2?.tags).toContain('bulk');
      expect(updated2?.tags).toContain('important');
    });
  });
});
