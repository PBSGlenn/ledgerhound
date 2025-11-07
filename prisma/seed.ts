import { PrismaClient, AccountType, AccountSubtype, AccountKind, GSTCode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data (skip if database is already empty to avoid FK constraint issues)
  const accountCount = await prisma.account.count();
  if (accountCount > 0) {
    console.log('🧹 Clearing existing data...');
    await prisma.posting.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.reconciliation.deleteMany();
    await prisma.memorizedRule.deleteMany();
    await prisma.importBatch.deleteMany();
    // For accounts with self-referential FK, delete children before parents
    const accounts = await prisma.account.findMany({ orderBy: { level: 'desc' } });
    for (const account of accounts) {
      await prisma.account.delete({ where: { id: account.id } });
    }
    await prisma.settings.deleteMany();
  } else {
    console.log('✓ Database is empty, skipping cleanup');
  }

  // ============================================================================
  // HIERARCHICAL CATEGORY STRUCTURE
  // ============================================================================
  // Level 0: Income/Expense (root categories - not selectable)
  // Level 1: Personal/Business groupings
  // Level 2: Main categories
  // Level 3+: Subcategories

  console.log('📁 Creating category hierarchy...');

  // INCOME HIERARCHY
  // Level 1: Personal Income
  const personalIncome = await prisma.account.create({
    data: {
      name: 'Personal Income',
      fullPath: 'Income/Personal',
      type: AccountType.INCOME,
      kind: AccountKind.CATEGORY,
      level: 1,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 100,
    },
  });

  // Level 2: Employment (under Personal Income)
  const employment = await prisma.account.create({
    data: {
      name: 'Employment',
      fullPath: 'Income/Personal/Employment',
      type: AccountType.INCOME,
      kind: AccountKind.CATEGORY,
      parentId: personalIncome.id,
      level: 2,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 101,
    },
  });

  // Level 3: Employment subcategories
  await prisma.account.createMany({
    data: [
      {
        name: 'Salary',
        fullPath: 'Income/Personal/Employment/Salary',
        type: AccountType.INCOME,
        kind: AccountKind.CATEGORY,
        parentId: employment.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 102,
      },
      {
        name: 'Bonuses',
        fullPath: 'Income/Personal/Employment/Bonuses',
        type: AccountType.INCOME,
        kind: AccountKind.CATEGORY,
        parentId: employment.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 103,
      },
      {
        name: 'Overtime',
        fullPath: 'Income/Personal/Employment/Overtime',
        type: AccountType.INCOME,
        kind: AccountKind.CATEGORY,
        parentId: employment.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 104,
      },
    ],
  });

  // Level 2: Investment Income (under Personal Income)
  const personalInvestment = await prisma.account.create({
    data: {
      name: 'Investment Income',
      fullPath: 'Income/Personal/Investment',
      type: AccountType.INCOME,
      kind: AccountKind.CATEGORY,
      parentId: personalIncome.id,
      level: 2,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 110,
    },
  });

  await prisma.account.createMany({
    data: [
      {
        name: 'Interest',
        fullPath: 'Income/Personal/Investment/Interest',
        type: AccountType.INCOME,
        kind: AccountKind.CATEGORY,
        parentId: personalInvestment.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 111,
      },
      {
        name: 'Dividends',
        fullPath: 'Income/Personal/Investment/Dividends',
        type: AccountType.INCOME,
        kind: AccountKind.CATEGORY,
        parentId: personalInvestment.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 112,
      },
    ],
  });

  // Level 2: Other Personal Income
  const otherPersonalIncome = await prisma.account.create({
    data: {
      name: 'Other Income',
      fullPath: 'Income/Personal/Other',
      type: AccountType.INCOME,
      kind: AccountKind.CATEGORY,
      parentId: personalIncome.id,
      level: 2,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 120,
    },
  });

  await prisma.account.createMany({
    data: [
      {
        name: 'Gifts Received',
        fullPath: 'Income/Personal/Other/Gifts',
        type: AccountType.INCOME,
        kind: AccountKind.CATEGORY,
        parentId: otherPersonalIncome.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 121,
      },
      {
        name: 'Tax Refunds',
        fullPath: 'Income/Personal/Other/TaxRefunds',
        type: AccountType.INCOME,
        kind: AccountKind.CATEGORY,
        parentId: otherPersonalIncome.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 122,
      },
    ],
  });

  // Level 1: Business Income
  const businessIncome = await prisma.account.create({
    data: {
      name: 'Business Income',
      fullPath: 'Income/Business',
      type: AccountType.INCOME,
      kind: AccountKind.CATEGORY,
      level: 1,
      isReal: false,
      isBusinessDefault: true,
      sortOrder: 200,
    },
  });

  // Level 2: Sales (under Business Income)
  const sales = await prisma.account.create({
    data: {
      name: 'Sales',
      fullPath: 'Income/Business/Sales',
      type: AccountType.INCOME,
      kind: AccountKind.CATEGORY,
      parentId: businessIncome.id,
      level: 2,
      isReal: false,
      isBusinessDefault: true,
      sortOrder: 201,
    },
  });

  const productSales = await prisma.account.create({
    data: {
      name: 'Product Sales',
      fullPath: 'Income/Business/Sales/Products',
      type: AccountType.INCOME,
      kind: AccountKind.CATEGORY,
      parentId: sales.id,
      level: 3,
      isReal: false,
      isBusinessDefault: true,
      sortOrder: 202,
    },
  });

  await prisma.account.createMany({
    data: [
      {
        name: 'Service Revenue',
        fullPath: 'Income/Business/Sales/Services',
        type: AccountType.INCOME,
        kind: AccountKind.CATEGORY,
        parentId: sales.id,
        level: 3,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 203,
      },
      {
        name: 'Consulting Fees',
        fullPath: 'Income/Business/Sales/Consulting',
        type: AccountType.INCOME,
        kind: AccountKind.CATEGORY,
        parentId: sales.id,
        level: 3,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 204,
      },
    ],
  });

  // EXPENSE HIERARCHY
  // Level 1: Personal Expenses
  const personalExpenses = await prisma.account.create({
    data: {
      name: 'Personal Expenses',
      fullPath: 'Expense/Personal',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      level: 1,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 1000,
    },
  });

  // Level 2: Housing (under Personal Expenses)
  const housing = await prisma.account.create({
    data: {
      name: 'Housing',
      fullPath: 'Expense/Personal/Housing',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      parentId: personalExpenses.id,
      level: 2,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 1001,
    },
  });

  await prisma.account.createMany({
    data: [
      {
        name: 'Rent/Mortgage',
        fullPath: 'Expense/Personal/Housing/Rent',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: housing.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 1002,
      },
      {
        name: 'Utilities',
        fullPath: 'Expense/Personal/Housing/Utilities',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: housing.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 1003,
      },
      {
        name: 'Home Insurance',
        fullPath: 'Expense/Personal/Housing/Insurance',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: housing.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 1004,
      },
      {
        name: 'Maintenance',
        fullPath: 'Expense/Personal/Housing/Maintenance',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: housing.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 1005,
      },
    ],
  });

  // Level 2: Food & Dining (under Personal Expenses)
  const foodDining = await prisma.account.create({
    data: {
      name: 'Food & Dining',
      fullPath: 'Expense/Personal/Food',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      parentId: personalExpenses.id,
      level: 2,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 1010,
    },
  });

  const groceries = await prisma.account.create({
    data: {
      name: 'Groceries',
      fullPath: 'Expense/Personal/Food/Groceries',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      parentId: foodDining.id,
      level: 3,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 1011,
    },
  });

  const diningOut = await prisma.account.create({
    data: {
      name: 'Dining Out',
      fullPath: 'Expense/Personal/Food/DiningOut',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      parentId: foodDining.id,
      level: 3,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 1012,
    },
  });

  await prisma.account.create({
    data: {
      name: 'Takeaway',
      fullPath: 'Expense/Personal/Food/Takeaway',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      parentId: foodDining.id,
      level: 3,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 1013,
    },
  });

  // Level 2: Transportation (under Personal Expenses)
  const transportation = await prisma.account.create({
    data: {
      name: 'Transportation',
      fullPath: 'Expense/Personal/Transportation',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      parentId: personalExpenses.id,
      level: 2,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 1020,
    },
  });

  await prisma.account.createMany({
    data: [
      {
        name: 'Fuel',
        fullPath: 'Expense/Personal/Transportation/Fuel',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: transportation.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 1021,
      },
      {
        name: 'Public Transport',
        fullPath: 'Expense/Personal/Transportation/PublicTransport',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: transportation.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 1022,
      },
      {
        name: 'Vehicle Maintenance',
        fullPath: 'Expense/Personal/Transportation/Maintenance',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: transportation.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 1023,
      },
    ],
  });

  // Level 2: Healthcare (under Personal Expenses)
  const healthcare = await prisma.account.create({
    data: {
      name: 'Healthcare',
      fullPath: 'Expense/Personal/Healthcare',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      parentId: personalExpenses.id,
      level: 2,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 1030,
    },
  });

  await prisma.account.createMany({
    data: [
      {
        name: 'Medical',
        fullPath: 'Expense/Personal/Healthcare/Medical',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: healthcare.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 1031,
      },
      {
        name: 'Dental',
        fullPath: 'Expense/Personal/Healthcare/Dental',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: healthcare.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 1032,
      },
      {
        name: 'Pharmacy',
        fullPath: 'Expense/Personal/Healthcare/Pharmacy',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: healthcare.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 1033,
      },
    ],
  });

  // Level 2: Entertainment (under Personal Expenses)
  const entertainment = await prisma.account.create({
    data: {
      name: 'Entertainment',
      fullPath: 'Expense/Personal/Entertainment',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      parentId: personalExpenses.id,
      level: 2,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 1040,
    },
  });

  await prisma.account.createMany({
    data: [
      {
        name: 'Subscriptions',
        fullPath: 'Expense/Personal/Entertainment/Subscriptions',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: entertainment.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 1041,
      },
      {
        name: 'Hobbies',
        fullPath: 'Expense/Personal/Entertainment/Hobbies',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: entertainment.id,
        level: 3,
        isReal: false,
        isBusinessDefault: false,
        sortOrder: 1042,
      },
    ],
  });

  // Level 1: Business Expenses
  const businessExpenses = await prisma.account.create({
    data: {
      name: 'Business Expenses',
      fullPath: 'Expense/Business',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      level: 1,
      isReal: false,
      isBusinessDefault: true,
      sortOrder: 2000,
    },
  });

  // Level 2: Operating Expenses (under Business Expenses)
  const operatingExpenses = await prisma.account.create({
    data: {
      name: 'Operating Expenses',
      fullPath: 'Expense/Business/Operating',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      parentId: businessExpenses.id,
      level: 2,
      isReal: false,
      isBusinessDefault: true,
      sortOrder: 2001,
    },
  });

  await prisma.account.createMany({
    data: [
      {
        name: 'Rent',
        fullPath: 'Expense/Business/Operating/Rent',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: operatingExpenses.id,
        level: 3,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 2002,
      },
      {
        name: 'Utilities',
        fullPath: 'Expense/Business/Operating/Utilities',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: operatingExpenses.id,
        level: 3,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 2003,
      },
      {
        name: 'Insurance',
        fullPath: 'Expense/Business/Operating/Insurance',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: operatingExpenses.id,
        level: 3,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 2004,
      },
    ],
  });

  const officeSupplies = await prisma.account.create({
    data: {
      name: 'Office Supplies',
      fullPath: 'Expense/Business/Operating/Supplies',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      parentId: operatingExpenses.id,
      level: 3,
      isReal: false,
      isBusinessDefault: true,
      sortOrder: 2005,
    },
  });

  // Level 2: Cost of Goods Sold (under Business Expenses)
  const cogs = await prisma.account.create({
    data: {
      name: 'Cost of Goods Sold',
      fullPath: 'Expense/Business/COGS',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      parentId: businessExpenses.id,
      level: 2,
      isReal: false,
      isBusinessDefault: true,
      sortOrder: 2010,
    },
  });

  await prisma.account.createMany({
    data: [
      {
        name: 'Materials',
        fullPath: 'Expense/Business/COGS/Materials',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: cogs.id,
        level: 3,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 2011,
      },
      {
        name: 'Direct Labor',
        fullPath: 'Expense/Business/COGS/Labor',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: cogs.id,
        level: 3,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 2012,
      },
      {
        name: 'Shipping & Freight',
        fullPath: 'Expense/Business/COGS/Shipping',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: cogs.id,
        level: 3,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 2013,
      },
    ],
  });

  // Level 2: Marketing & Advertising (under Business Expenses)
  const marketing = await prisma.account.create({
    data: {
      name: 'Marketing & Advertising',
      fullPath: 'Expense/Business/Marketing',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      parentId: businessExpenses.id,
      level: 2,
      isReal: false,
      isBusinessDefault: true,
      sortOrder: 2020,
    },
  });

  await prisma.account.createMany({
    data: [
      {
        name: 'Digital Marketing',
        fullPath: 'Expense/Business/Marketing/Digital',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: marketing.id,
        level: 3,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 2021,
      },
      {
        name: 'Print Advertising',
        fullPath: 'Expense/Business/Marketing/Print',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: marketing.id,
        level: 3,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 2022,
      },
    ],
  });

  // Level 2: Professional Services (under Business Expenses)
  const professional = await prisma.account.create({
    data: {
      name: 'Professional Services',
      fullPath: 'Expense/Business/Professional',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      parentId: businessExpenses.id,
      level: 2,
      isReal: false,
      isBusinessDefault: true,
      sortOrder: 2030,
    },
  });

  await prisma.account.createMany({
    data: [
      {
        name: 'Accounting',
        fullPath: 'Expense/Business/Professional/Accounting',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: professional.id,
        level: 3,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 2031,
      },
      {
        name: 'Legal',
        fullPath: 'Expense/Business/Professional/Legal',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: professional.id,
        level: 3,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 2032,
      },
    ],
  });

  // Level 2: Technology (under Business Expenses)
  const technology = await prisma.account.create({
    data: {
      name: 'Technology',
      fullPath: 'Expense/Business/Technology',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      parentId: businessExpenses.id,
      level: 2,
      isReal: false,
      isBusinessDefault: true,
      sortOrder: 2040,
    },
  });

  await prisma.account.createMany({
    data: [
      {
        name: 'Software Subscriptions',
        fullPath: 'Expense/Business/Technology/Software',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: technology.id,
        level: 3,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 2041,
      },
      {
        name: 'Hardware',
        fullPath: 'Expense/Business/Technology/Hardware',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: technology.id,
        level: 3,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 2042,
      },
    ],
  });

  // Level 2: Travel & Entertainment (under Business Expenses)
  const businessTravel = await prisma.account.create({
    data: {
      name: 'Travel & Entertainment',
      fullPath: 'Expense/Business/Travel',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      parentId: businessExpenses.id,
      level: 2,
      isReal: false,
      isBusinessDefault: true,
      sortOrder: 2050,
    },
  });

  const businessMeals = await prisma.account.create({
    data: {
      name: 'Business Meals',
      fullPath: 'Expense/Business/Travel/Meals',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      parentId: businessTravel.id,
      level: 3,
      isReal: false,
      isBusinessDefault: true,
      sortOrder: 2051,
    },
  });

  await prisma.account.createMany({
    data: [
      {
        name: 'Business Travel',
        fullPath: 'Expense/Business/Travel/Travel',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: businessTravel.id,
        level: 3,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 2052,
      },
      {
        name: 'Accommodation',
        fullPath: 'Expense/Business/Travel/Accommodation',
        type: AccountType.EXPENSE,
        kind: AccountKind.CATEGORY,
        parentId: businessTravel.id,
        level: 3,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 2053,
      },
    ],
  });

  // Uncategorized (fallback)
  await prisma.account.create({
    data: {
      name: 'Uncategorized',
      fullPath: 'Expense/Uncategorized',
      type: AccountType.EXPENSE,
      kind: AccountKind.CATEGORY,
      level: 1,
      isReal: false,
      isBusinessDefault: false,
      sortOrder: 9999,
    },
  });

  console.log('✅ Category hierarchy created');

  // ============================================================================
  // REAL ACCOUNTS (Banks, Credit Cards, etc.)
  // ============================================================================

  console.log('💳 Creating real accounts...');

  const personalBank = await prisma.account.create({
    data: {
      name: 'Personal Checking',
      type: AccountType.ASSET,
      kind: AccountKind.TRANSFER,
      subtype: AccountSubtype.BANK,
      level: 0,
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
      level: 0,
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
      level: 0,
      isReal: false,
      isBusinessDefault: false,
      openingBalance: 0.0,
      openingDate: new Date('2025-01-01'),
      currency: 'AUD',
      sortOrder: 3,
    },
  });

  const businessBank = await prisma.account.create({
    data: {
      name: 'Business Checking',
      type: AccountType.ASSET,
      kind: AccountKind.TRANSFER,
      subtype: AccountSubtype.BANK,
      level: 0,
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
      level: 0,
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
      level: 0,
      isReal: false,
      isBusinessDefault: true,
      openingBalance: 0.0,
      openingDate: new Date('2025-01-01'),
      currency: 'AUD',
      sortOrder: 6,
    },
  });

  console.log('✅ Real accounts created');

  // ============================================================================
  // SAMPLE TRANSACTIONS
  // ============================================================================

  console.log('📝 Creating sample transactions...');

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
            accountId: productSales.id,
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

  // ============================================================================
  // MEMORIZED RULES
  // ============================================================================

  console.log('📋 Creating memorized rules...');

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

  // ============================================================================
  // SETTINGS
  // ============================================================================

  console.log('⚙️  Creating default settings...');

  await prisma.settings.createMany({
    data: [
      {
        key: 'gst_enabled',
        value: JSON.stringify(true),
      },
      {
        key: 'default_gst_rate',
        value: JSON.stringify(0.1),
      },
      {
        key: 'organisation',
        value: JSON.stringify({
          name: 'My Business',
          abn: '',
          address: '',
        }),
      },
      {
        key: 'locale',
        value: JSON.stringify({
          dateFormat: 'dd/MM/yyyy',
          timezone: 'Australia/Melbourne',
          currency: 'AUD',
        }),
      },
    ],
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
