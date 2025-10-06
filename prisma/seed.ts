import { PrismaClient, AccountType, AccountSubtype, AccountKind, GSTCode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.posting.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.reconciliation.deleteMany();
  await prisma.memorizedRule.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.account.deleteMany();
  await prisma.settings.deleteMany();

  // Create personal accounts
  const personalBank = await prisma.account.create({
    data: {
      name: 'Personal Checking',
      type: AccountType.ASSET,
      kind: AccountKind.TRANSFER,
      subtype: AccountSubtype.BANK,
      isReal: true,
      isBusinessDefault: false,
      openingBalance: 5000.0,
      openingDate: new Date('2025-01-01'),
      currency: 'AUD',
      sortOrder: 1,
    },
  });

  const personalCredit = await prisma.account.create({
    data: {
      name: 'Personal Credit Card',
      type: AccountType.LIABILITY,
      kind: AccountKind.TRANSFER,
      subtype: AccountSubtype.CARD,
      isReal: true,
      isBusinessDefault: false,
      openingBalance: 0.0,
      openingDate: new Date('2025-01-01'),
      currency: 'AUD',
      sortOrder: 2,
    },
  });

  const savingsGoal = await prisma.account.create({
    data: {
      name: 'Holiday Fund',
      type: AccountType.EQUITY,
      kind: AccountKind.TRANSFER,
      subtype: AccountSubtype.SAVINGS_GOAL,
      isReal: false,
      isBusinessDefault: false,
      openingBalance: 0.0,
      openingDate: new Date('2025-01-01'),
      currency: 'AUD',
      sortOrder: 3,
    },
  });

  // Create business accounts
  const businessBank = await prisma.account.create({
    data: {
      name: 'Business Checking',
      type: AccountType.ASSET,
      kind: AccountKind.TRANSFER,
      subtype: AccountSubtype.BANK,
      isReal: true,
      isBusinessDefault: true,
      openingBalance: 10000.0,
      openingDate: new Date('2025-01-01'),
      currency: 'AUD',
      sortOrder: 4,
    },
  });

  const businessCard = await prisma.account.create({
    data: {
      name: 'Business Credit Card',
      type: AccountType.LIABILITY,
      kind: AccountKind.TRANSFER,
      subtype: AccountSubtype.CARD,
      isReal: true,
      isBusinessDefault: true,
      openingBalance: 0.0,
      openingDate: new Date('2025-01-01'),
      currency: 'AUD',
      sortOrder: 5,
    },
  });

  await prisma.account.create({
    data: {
      name: 'GST Control',
      type: AccountType.LIABILITY,
      kind: AccountKind.TRANSFER,
      subtype: AccountSubtype.GST_CONTROL,
      isReal: false,
      isBusinessDefault: true,
      openingBalance: 0.0,
      openingDate: new Date('2025-01-01'),
      currency: 'AUD',
      sortOrder: 6,
    },
  });

  // Create personal income/expense categories
  await prisma.account.create({
    data: {
      name: 'Salary',
      type: AccountType.INCOME,
      kind: AccountKind.CATEGORY,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 10,
    },
  });

  const groceries = await prisma.account.create({
    data: {
      name: 'Groceries',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 11,
    },
  });

  const diningOut = await prisma.account.create({
    data: {
      name: 'Dining Out',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 12,
    },
  });

  // Create business income/expense categories
  const salesIncome = await prisma.account.create({
    data: {
      name: 'Sales Income',
      type: AccountType.INCOME,
      kind: AccountKind.CATEGORY,
      isReal: false,
      isBusinessDefault: true,
      sortOrder: 20,
    },
  });

  const officeSupplies = await prisma.account.create({
    data: {
      name: 'Office Supplies',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      isReal: false,
      isBusinessDefault: true,
      sortOrder: 21,
    },
  });

  const businessMeals = await prisma.account.create({
    data: {
      name: 'Business Meals',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      isReal: false,
      isBusinessDefault: true,
      sortOrder: 22,
    },
  });

  await prisma.account.create({
    data: {
      name: 'Uncategorized',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 99,
    },
  });

  console.log('✅ Accounts created');

  // Example 1: Personal grocery purchase (NO GST tracking)
  await prisma.transaction.create({
    data: {
      date: new Date('2025-08-12'),
      payee: 'Woolworths',
      memo: 'Weekly groceries',
      tags: JSON.stringify(['shopping', 'personal']),
      postings: {
        create: [
          {
            accountId: personalBank.id,
            amount: -110.0,
            isBusiness: false,
          },
          {
            accountId: groceries.id,
            amount: 110.0,
            isBusiness: false,
          },
        ],
      },
    },
  });

  // Example 2: Business office supplies $110 inc. GST
  await prisma.transaction.create({
    data: {
      date: new Date('2025-08-12'),
      payee: 'Officeworks',
      memo: 'Office supplies',
      reference: 'Receipt-12345',
      tags: JSON.stringify(['business', 'office']),
      postings: {
        create: [
          {
            accountId: businessCard.id,
            amount: -110.0,
            isBusiness: true,
          },
          {
            accountId: officeSupplies.id,
            amount: 100.0,
            isBusiness: true,
            gstCode: GSTCode.GST,
            gstRate: 0.1,
            gstAmount: 10.0,
          },
        ],
      },
    },
  });

  // Example 3: Mixed personal/business split - Dinner with client
  await prisma.transaction.create({
    data: {
      date: new Date('2025-08-15'),
      payee: 'The Restaurant',
      memo: 'Client dinner + personal meal',
      tags: JSON.stringify(['dining', 'mixed']),
      postings: {
        create: [
          {
            accountId: personalCredit.id,
            amount: -150.0,
            isBusiness: false,
          },
          {
            accountId: businessMeals.id,
            amount: 90.91,
            isBusiness: true,
            gstCode: GSTCode.GST,
            gstRate: 0.1,
            gstAmount: 9.09,
            categorySplitLabel: 'Client portion',
          },
          {
            accountId: diningOut.id,
            amount: 59.09,
            isBusiness: false,
            categorySplitLabel: 'Personal portion',
          },
        ],
      },
    },
  });

  // Example 4: Transfer to savings goal (no GST)
  await prisma.transaction.create({
    data: {
      date: new Date('2025-08-20'),
      payee: 'Savings Transfer',
      memo: 'Holiday fund contribution',
      tags: JSON.stringify(['savings']),
      postings: {
        create: [
          {
            accountId: personalBank.id,
            amount: -500.0,
            isBusiness: false,
          },
          {
            accountId: savingsGoal.id,
            amount: 500.0,
            isBusiness: false,
          },
        ],
      },
    },
  });

  // Example 5: Business sale with GST
  await prisma.transaction.create({
    data: {
      date: new Date('2025-08-22'),
      payee: 'ABC Company',
      memo: 'Invoice #2025-001',
      reference: 'INV-2025-001',
      tags: JSON.stringify(['business', 'income']),
      postings: {
        create: [
          {
            accountId: businessBank.id,
            amount: 1100.0,
            isBusiness: true,
          },
          {
            accountId: salesIncome.id,
            amount: -1000.0,
            isBusiness: true,
            gstCode: GSTCode.GST,
            gstRate: 0.1,
            gstAmount: -100.0, // Negative because income is negative
          },
        ],
      },
    },
  });

  console.log('✅ Sample transactions created');

  // Create memorized rules
  await prisma.memorizedRule.create({
    data: {
      name: 'Woolworths Groceries',
      matchType: 'CONTAINS',
      matchValue: 'Woolworths',
      defaultPayee: 'Woolworths',
      defaultAccountId: groceries.id,
      defaultSplits: JSON.stringify([
        {
          accountId: groceries.id,
          percentOrAmount: 100,
          isBusiness: false,
          gstCode: null,
        },
      ]),
      applyOnImport: true,
      applyOnManualEntry: true,
      priority: 10,
    },
  });

  await prisma.memorizedRule.create({
    data: {
      name: 'Officeworks Supplies',
      matchType: 'CONTAINS',
      matchValue: 'Officeworks',
      defaultPayee: 'Officeworks',
      defaultAccountId: officeSupplies.id,
      defaultSplits: JSON.stringify([
        {
          accountId: officeSupplies.id,
          percentOrAmount: 100,
          isBusiness: true,
          gstCode: 'GST',
          gstRate: 0.1,
        },
      ]),
      applyOnImport: true,
      applyOnManualEntry: true,
      priority: 20,
    },
  });

  console.log('✅ Memorized rules created');

  // Create default settings
  await prisma.settings.create({
    data: {
      key: 'gst_enabled',
      value: JSON.stringify(true),
    },
  });

  await prisma.settings.create({
    data: {
      key: 'default_gst_rate',
      value: JSON.stringify(0.1),
    },
  });

  await prisma.settings.create({
    data: {
      key: 'organisation',
      value: JSON.stringify({
        name: 'My Business',
        abn: '',
        address: '',
      }),
    },
  });

  await prisma.settings.create({
    data: {
      key: 'locale',
      value: JSON.stringify({
        dateFormat: 'dd/MM/yyyy',
        timezone: 'Australia/Melbourne',
        currency: 'AUD',
      }),
    },
  });

  console.log('✅ Settings created');

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
