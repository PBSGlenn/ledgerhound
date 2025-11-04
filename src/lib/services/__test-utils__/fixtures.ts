import { AccountType, AccountKind, AccountSubtype, GSTCode } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

/**
 * Test data fixtures
 *
 * Pre-defined test data for common scenarios
 */

export const testAccounts = {
  personalChecking: {
    name: 'Personal Checking',
    type: AccountType.ASSET,
    kind: AccountKind.TRANSFER,
    subtype: AccountSubtype.BANK,
    isReal: true,
    isBusinessDefault: false,
  },

  businessChecking: {
    name: 'Business Checking',
    type: AccountType.ASSET,
    kind: AccountKind.TRANSFER,
    subtype: AccountSubtype.BANK,
    isReal: true,
    isBusinessDefault: true,
  },

  creditCard: {
    name: 'Credit Card',
    type: AccountType.LIABILITY,
    kind: AccountKind.TRANSFER,
    subtype: AccountSubtype.CARD,
    isReal: true,
    isBusinessDefault: false,
  },

  groceries: {
    name: 'Groceries',
    type: AccountType.EXPENSE,
    kind: AccountKind.CATEGORY,
    isReal: false,
    isBusinessDefault: false,
  },

  officeSupplies: {
    name: 'Office Supplies',
    type: AccountType.EXPENSE,
    kind: AccountKind.CATEGORY,
    isReal: false,
    isBusinessDefault: true,
    defaultHasGst: true,
  },

  salary: {
    name: 'Salary',
    type: AccountType.INCOME,
    kind: AccountKind.CATEGORY,
    isReal: false,
    isBusinessDefault: false,
  },

  salesIncome: {
    name: 'Sales Income',
    type: AccountType.INCOME,
    kind: AccountKind.CATEGORY,
    isReal: false,
    isBusinessDefault: true,
    defaultHasGst: true,
  },

  gstCollected: {
    name: 'GST Collected',
    type: AccountType.LIABILITY,
    kind: AccountKind.CATEGORY,
    isReal: false,
    isBusinessDefault: true,
  },

  gstPaid: {
    name: 'GST Paid',
    type: AccountType.ASSET,
    kind: AccountKind.CATEGORY,
    isReal: false,
    isBusinessDefault: true,
  },

  uncategorized: {
    name: 'Uncategorized',
    type: AccountType.EXPENSE,
    kind: AccountKind.CATEGORY,
    isReal: false,
    isBusinessDefault: false,
  },
};

export const testTransactions = {
  personalGrocery: {
    date: new Date('2025-01-15'),
    payee: 'Woolworths',
    memo: 'Weekly shopping',
  },

  businessOfficeSupplies: {
    date: new Date('2025-01-16'),
    payee: 'Officeworks',
    memo: 'Printer paper',
  },

  transfer: {
    date: new Date('2025-01-17'),
    payee: 'Transfer',
    memo: 'Savings',
  },
};

export const testPostings = {
  personalExpense: (accountId: string, categoryId: string, amount: number) => ({
    accountId,
    amount: -amount,
    isBusiness: false,
    category: {
      accountId: categoryId,
      amount: amount,
      isBusiness: false,
    },
  }),

  businessExpense: (accountId: string, categoryId: string, amountIncGst: number) => {
    const gstAmount = (amountIncGst * 0.1) / 1.1;
    const amountExGst = amountIncGst - gstAmount;

    return {
      accountId,
      amount: -amountIncGst,
      isBusiness: false,
      category: {
        accountId: categoryId,
        amount: amountExGst,
        isBusiness: true,
        gstCode: GSTCode.GST,
        gstRate: 0.1,
        gstAmount,
      },
    };
  },
};

/**
 * Helper to seed test database with common accounts
 */
export async function seedTestAccounts(prisma: PrismaClient) {
  const accounts = await Promise.all([
    prisma.account.create({ data: testAccounts.personalChecking }),
    prisma.account.create({ data: testAccounts.businessChecking }),
    prisma.account.create({ data: testAccounts.creditCard }),
    prisma.account.create({ data: testAccounts.groceries }),
    prisma.account.create({ data: testAccounts.officeSupplies }),
    prisma.account.create({ data: testAccounts.salary }),
    prisma.account.create({ data: testAccounts.salesIncome }),
    prisma.account.create({ data: testAccounts.gstCollected }),
    prisma.account.create({ data: testAccounts.gstPaid }),
    prisma.account.create({ data: testAccounts.uncategorized }),
  ]);

  return {
    personalChecking: accounts[0],
    businessChecking: accounts[1],
    creditCard: accounts[2],
    groceries: accounts[3],
    officeSupplies: accounts[4],
    salary: accounts[5],
    salesIncome: accounts[6],
    gstCollected: accounts[7],
    gstPaid: accounts[8],
    uncategorized: accounts[9],
  };
}

/**
 * Helper to create a simple personal transaction
 */
export async function createPersonalTransaction(
  prisma: PrismaClient,
  fromAccountId: string,
  categoryId: string,
  amount: number
) {
  return await prisma.transaction.create({
    data: {
      date: new Date(),
      payee: 'Test Payee',
      postings: {
        create: [
          {
            accountId: fromAccountId,
            amount: -amount,
            isBusiness: false,
          },
          {
            accountId: categoryId,
            amount: amount,
            isBusiness: false,
          },
        ],
      },
    },
    include: {
      postings: true,
    },
  });
}

/**
 * Helper to create a business transaction with GST
 */
export async function createBusinessTransaction(
  prisma: PrismaClient,
  fromAccountId: string,
  categoryId: string,
  gstAccountId: string,
  amountIncGst: number
) {
  const gstAmount = (amountIncGst * 0.1) / 1.1;
  const amountExGst = amountIncGst - gstAmount;

  return await prisma.transaction.create({
    data: {
      date: new Date(),
      payee: 'Test Business Payee',
      postings: {
        create: [
          {
            accountId: fromAccountId,
            amount: -amountIncGst,
            isBusiness: false,
          },
          {
            accountId: categoryId,
            amount: amountExGst,
            isBusiness: true,
            gstCode: GSTCode.GST,
            gstRate: 0.1,
            gstAmount,
          },
          {
            accountId: gstAccountId,
            amount: gstAmount,
            isBusiness: true,
          },
        ],
      },
    },
    include: {
      postings: true,
    },
  });
}
