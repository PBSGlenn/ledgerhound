import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { PrismaClient, AccountType, AccountKind } from '@prisma/client';
import { getTestDb, resetTestDb, cleanupTestDb } from '../__test-utils__/testDb';
import { seedTestAccounts, createPersonalTransaction } from '../__test-utils__/fixtures';
import { AccountService } from '../accountService';

describe('AccountService', () => {
  let prisma: PrismaClient;
  let accountService: AccountService;

  beforeAll(async () => {
    prisma = await getTestDb();
  });

  beforeEach(async () => {
    await resetTestDb(prisma);
    accountService = new AccountService(prisma);
  });

  afterAll(async () => {
    await cleanupTestDb(prisma);
  });

  describe('createAccount', () => {
    it('should create a new account with required fields', async () => {
      const account = await accountService.createAccount({
        name: 'Test Account',
        type: AccountType.ASSET,
      });

      expect(account.id).toBeDefined();
      expect(account.name).toBe('Test Account');
      expect(account.type).toBe(AccountType.ASSET);
      expect(account.kind).toBe(AccountKind.TRANSFER); // Auto-derived
      expect(account.isReal).toBe(true); // Default
      expect(account.openingBalance).toBe(0); // Default
      expect(account.currency).toBe('AUD'); // Default
    });

    it('should create an account with custom fields', async () => {
      const openingDate = new Date('2025-01-01');
      const account = await accountService.createAccount({
        name: 'Business Checking',
        type: AccountType.ASSET,
        isReal: true,
        isBusinessDefault: true,
        openingBalance: 10000,
        openingDate,
        currency: 'AUD',
        sortOrder: 5,
      });

      expect(account.isReal).toBe(true);
      expect(account.isBusinessDefault).toBe(true);
      expect(account.openingBalance).toBe(10000);
      expect(account.openingDate).toEqual(openingDate);
      expect(account.sortOrder).toBe(5);
    });

    it('should auto-derive kind as CATEGORY for INCOME/EXPENSE', async () => {
      const income = await accountService.createAccount({
        name: 'Salary',
        type: AccountType.INCOME,
      });
      const expense = await accountService.createAccount({
        name: 'Groceries',
        type: AccountType.EXPENSE,
      });

      expect(income.kind).toBe(AccountKind.CATEGORY);
      expect(expense.kind).toBe(AccountKind.CATEGORY);
    });

    it('should auto-derive kind as TRANSFER for ASSET/LIABILITY/EQUITY', async () => {
      const asset = await accountService.createAccount({
        name: 'Checking',
        type: AccountType.ASSET,
      });
      const liability = await accountService.createAccount({
        name: 'Credit Card',
        type: AccountType.LIABILITY,
      });
      const equity = await accountService.createAccount({
        name: 'Opening Balance',
        type: AccountType.EQUITY,
      });

      expect(asset.kind).toBe(AccountKind.TRANSFER);
      expect(liability.kind).toBe(AccountKind.TRANSFER);
      expect(equity.kind).toBe(AccountKind.TRANSFER);
    });

    it('should prevent duplicate account names within same type', async () => {
      await accountService.createAccount({
        name: 'Checking',
        type: AccountType.ASSET,
      });

      await expect(
        accountService.createAccount({
          name: 'Checking',
          type: AccountType.ASSET,
        })
      ).rejects.toThrow('Account "Checking" already exists');
    });

    it('should allow same name in different types', async () => {
      await accountService.createAccount({
        name: 'Fees',
        type: AccountType.EXPENSE,
      });

      // Should not throw
      const account = await accountService.createAccount({
        name: 'Fees',
        type: AccountType.INCOME,
      });

      expect(account.name).toBe('Fees');
      expect(account.type).toBe(AccountType.INCOME);
    });
  });

  describe('getAllAccounts', () => {
    beforeEach(async () => {
      await seedTestAccounts(prisma);
    });

    it('should get all non-archived accounts by default', async () => {
      const accounts = await accountService.getAllAccounts();

      expect(accounts.length).toBeGreaterThan(0);
      expect(accounts.every((a) => !a.archived)).toBe(true);
    });

    it('should include archived accounts when requested', async () => {
      const accounts = await seedTestAccounts(prisma);

      // Archive one account
      await accountService.archiveAccount(accounts.personalChecking.id, true);

      const allAccounts = await accountService.getAllAccounts({
        includeArchived: true,
      });
      const activeAccounts = await accountService.getAllAccounts({
        includeArchived: false,
      });

      expect(allAccounts.length).toBeGreaterThan(activeAccounts.length);
    });

    it('should filter by account type', async () => {
      const assets = await accountService.getAllAccounts({
        type: AccountType.ASSET,
      });
      const expenses = await accountService.getAllAccounts({
        type: AccountType.EXPENSE,
      });

      expect(assets.every((a) => a.type === AccountType.ASSET)).toBe(true);
      expect(expenses.every((a) => a.type === AccountType.EXPENSE)).toBe(true);
      expect(assets.length).toBeGreaterThan(0);
      expect(expenses.length).toBeGreaterThan(0);
    });

    it('should filter by account kind', async () => {
      const transfers = await accountService.getAllAccounts({
        kind: AccountKind.TRANSFER,
      });
      const categories = await accountService.getAllAccounts({
        kind: AccountKind.CATEGORY,
      });

      expect(transfers.every((a) => a.kind === AccountKind.TRANSFER)).toBe(true);
      expect(categories.every((a) => a.kind === AccountKind.CATEGORY)).toBe(true);
    });

    it('should filter by isReal', async () => {
      const realAccounts = await accountService.getAllAccounts({
        isReal: true,
      });
      const categoryAccounts = await accountService.getAllAccounts({
        isReal: false,
      });

      expect(realAccounts.every((a) => a.isReal === true)).toBe(true);
      expect(categoryAccounts.every((a) => a.isReal === false)).toBe(true);
    });

    it('should filter by isBusinessDefault', async () => {
      const businessAccounts = await accountService.getAllAccounts({
        isBusinessDefault: true,
      });

      expect(businessAccounts.every((a) => a.isBusinessDefault === true)).toBe(true);
      expect(businessAccounts.length).toBeGreaterThan(0);
    });

    it('should sort accounts by type, sortOrder, and name', async () => {
      const accounts = await accountService.getAllAccounts();

      // Verify sorting (assets before liabilities, etc.)
      for (let i = 1; i < accounts.length; i++) {
        const prev = accounts[i - 1];
        const curr = accounts[i];

        if (prev.type !== curr.type) {
          // Type ordering: ASSET < LIABILITY < EQUITY < INCOME < EXPENSE
          const typeOrder = [
            AccountType.ASSET,
            AccountType.LIABILITY,
            AccountType.EQUITY,
            AccountType.INCOME,
            AccountType.EXPENSE,
          ];
          expect(typeOrder.indexOf(prev.type)).toBeLessThanOrEqual(
            typeOrder.indexOf(curr.type)
          );
        }
      }
    });
  });

  describe('getAccountById', () => {
    it('should get account by ID', async () => {
      const created = await accountService.createAccount({
        name: 'Test Account',
        type: AccountType.ASSET,
      });

      const fetched = await accountService.getAccountById(created.id);

      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe(created.id);
      expect(fetched?.name).toBe('Test Account');
    });

    it('should return null for non-existent ID', async () => {
      const account = await accountService.getAccountById('non-existent-id');

      expect(account).toBeNull();
    });
  });

  describe('updateAccount', () => {
    it('should update account fields', async () => {
      const account = await accountService.createAccount({
        name: 'Original Name',
        type: AccountType.ASSET,
      });

      const updated = await accountService.updateAccount(account.id, {
        name: 'Updated Name',
        isBusinessDefault: true,
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.isBusinessDefault).toBe(true);
    });

    it('should prevent duplicate names within same type', async () => {
      await accountService.createAccount({
        name: 'Account A',
        type: AccountType.ASSET,
      });
      const accountB = await accountService.createAccount({
        name: 'Account B',
        type: AccountType.ASSET,
      });

      await expect(
        accountService.updateAccount(accountB.id, {
          name: 'Account A',
        })
      ).rejects.toThrow('Account "Account A" already exists');
    });

    it('should update kind when type changes', async () => {
      const account = await accountService.createAccount({
        name: 'Test',
        type: AccountType.ASSET,
      });

      expect(account.kind).toBe(AccountKind.TRANSFER);

      const updated = await accountService.updateAccount(account.id, {
        type: AccountType.EXPENSE,
      });

      expect(updated.kind).toBe(AccountKind.CATEGORY);
    });

    it('should throw error for non-existent account', async () => {
      await expect(
        accountService.updateAccount('non-existent-id', {
          name: 'New Name',
        })
      ).rejects.toThrow('Account non-existent-id not found');
    });
  });

  describe('archiveAccount', () => {
    it('should archive an account', async () => {
      const account = await accountService.createAccount({
        name: 'Test Account',
        type: AccountType.ASSET,
      });

      const archived = await accountService.archiveAccount(account.id, true);

      expect(archived.archived).toBe(true);
    });

    it('should unarchive an account', async () => {
      const account = await accountService.createAccount({
        name: 'Test Account',
        type: AccountType.ASSET,
      });

      await accountService.archiveAccount(account.id, true);
      const unarchived = await accountService.archiveAccount(account.id, false);

      expect(unarchived.archived).toBe(false);
    });
  });

  describe('deleteAccount', () => {
    it('should delete an account with no postings', async () => {
      const account = await accountService.createAccount({
        name: 'Test Account',
        type: AccountType.ASSET,
      });

      await accountService.deleteAccount(account.id);

      const fetched = await accountService.getAccountById(account.id);
      expect(fetched).toBeNull();
    });

    it('should prevent deletion of account with postings', async () => {
      const accounts = await seedTestAccounts(prisma);

      // Create a transaction (which creates postings)
      await createPersonalTransaction(
        prisma,
        accounts.personalChecking.id,
        accounts.groceries.id,
        100
      );

      await expect(
        accountService.deleteAccount(accounts.personalChecking.id)
      ).rejects.toThrow('Cannot delete account with');
    });
  });

  describe('getAccountBalance', () => {
    it('should return opening balance for account with no transactions', async () => {
      const account = await accountService.createAccount({
        name: 'Test Account',
        type: AccountType.ASSET,
        openingBalance: 1000,
      });

      const balance = await accountService.getAccountBalance(account.id);

      expect(balance).toBe(1000);
    });

    it('should calculate balance with transactions', async () => {
      const accounts = await seedTestAccounts(prisma);

      // Create transactions
      await createPersonalTransaction(
        prisma,
        accounts.personalChecking.id,
        accounts.groceries.id,
        50 // -50 from checking
      );
      await createPersonalTransaction(
        prisma,
        accounts.personalChecking.id,
        accounts.groceries.id,
        30 // -30 from checking
      );

      const balance = await accountService.getAccountBalance(
        accounts.personalChecking.id
      );

      // Opening balance (0) - 50 - 30 = -80
      expect(balance).toBe(-80);
    });

    it('should filter by date', async () => {
      const account = await accountService.createAccount({
        name: 'Test Account',
        type: AccountType.ASSET,
        openingBalance: 100,
      });

      // Create transaction with specific date
      await prisma.transaction.create({
        data: {
          date: new Date('2025-01-15'),
          payee: 'Test',
          postings: {
            create: [
              {
                accountId: account.id,
                amount: 50,
                isBusiness: false,
              },
            ],
          },
        },
      });

      const balanceBeforeDate = await accountService.getAccountBalance(account.id, {
        upToDate: new Date('2025-01-14'),
      });
      const balanceAfterDate = await accountService.getAccountBalance(account.id, {
        upToDate: new Date('2025-01-16'),
      });

      expect(balanceBeforeDate).toBe(100); // Opening balance only
      expect(balanceAfterDate).toBe(150); // Opening + transaction
    });

    it('should filter by cleared status', async () => {
      const account = await accountService.createAccount({
        name: 'Test Account',
        type: AccountType.ASSET,
      });

      // Create cleared and uncleared postings
      await prisma.transaction.create({
        data: {
          date: new Date(),
          payee: 'Test',
          postings: {
            create: [
              {
                accountId: account.id,
                amount: 50,
                cleared: true,
                isBusiness: false,
              },
            ],
          },
        },
      });
      await prisma.transaction.create({
        data: {
          date: new Date(),
          payee: 'Test 2',
          postings: {
            create: [
              {
                accountId: account.id,
                amount: 30,
                cleared: false,
                isBusiness: false,
              },
            ],
          },
        },
      });

      const totalBalance = await accountService.getAccountBalance(account.id);
      const clearedBalance = await accountService.getAccountBalance(account.id, {
        clearedOnly: true,
      });

      expect(totalBalance).toBe(80); // 50 + 30
      expect(clearedBalance).toBe(50); // Only cleared
    });

    it('should throw error for non-existent account', async () => {
      await expect(
        accountService.getAccountBalance('non-existent-id')
      ).rejects.toThrow('Account non-existent-id not found');
    });
  });

  describe('getAccountWithBalance', () => {
    it('should return account with current and cleared balances', async () => {
      const account = await accountService.createAccount({
        name: 'Test Account',
        type: AccountType.ASSET,
        openingBalance: 100,
      });

      // Create cleared and uncleared postings
      await prisma.transaction.create({
        data: {
          date: new Date(),
          payee: 'Test',
          postings: {
            create: [
              {
                accountId: account.id,
                amount: 50,
                cleared: true,
                isBusiness: false,
              },
            ],
          },
        },
      });
      await prisma.transaction.create({
        data: {
          date: new Date(),
          payee: 'Test 2',
          postings: {
            create: [
              {
                accountId: account.id,
                amount: 30,
                cleared: false,
                isBusiness: false,
              },
            ],
          },
        },
      });

      const accountWithBalance = await accountService.getAccountWithBalance(
        account.id
      );

      expect(accountWithBalance.id).toBe(account.id);
      expect(accountWithBalance.currentBalance).toBe(180); // 100 + 50 + 30
      expect(accountWithBalance.clearedBalance).toBe(150); // 100 + 50
    });
  });

  describe('getAllAccountsWithBalances', () => {
    it('should return all accounts with balances', async () => {
      const accounts = await seedTestAccounts(prisma);

      // Create some transactions
      await createPersonalTransaction(
        prisma,
        accounts.personalChecking.id,
        accounts.groceries.id,
        100
      );

      const accountsWithBalances = await accountService.getAllAccountsWithBalances();

      expect(accountsWithBalances.length).toBeGreaterThan(0);
      accountsWithBalances.forEach((account) => {
        expect(account.currentBalance).toBeDefined();
        expect(account.clearedBalance).toBeDefined();
      });
    });

    it('should filter by type', async () => {
      await seedTestAccounts(prisma);

      const assets = await accountService.getAllAccountsWithBalances({
        type: AccountType.ASSET,
      });

      expect(assets.every((a) => a.type === AccountType.ASSET)).toBe(true);
      assets.forEach((account) => {
        expect(account.currentBalance).toBeDefined();
      });
    });
  });

  describe('reorderAccounts', () => {
    it('should update sortOrder for accounts', async () => {
      const account1 = await accountService.createAccount({
        name: 'Account 1',
        type: AccountType.ASSET,
      });
      const account2 = await accountService.createAccount({
        name: 'Account 2',
        type: AccountType.ASSET,
      });
      const account3 = await accountService.createAccount({
        name: 'Account 3',
        type: AccountType.ASSET,
      });

      // Reorder
      await accountService.reorderAccounts([
        account3.id,
        account1.id,
        account2.id,
      ]);

      const updated1 = await accountService.getAccountById(account1.id);
      const updated2 = await accountService.getAccountById(account2.id);
      const updated3 = await accountService.getAccountById(account3.id);

      expect(updated3?.sortOrder).toBe(0);
      expect(updated1?.sortOrder).toBe(1);
      expect(updated2?.sortOrder).toBe(2);
    });
  });
});
