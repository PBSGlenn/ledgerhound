/**
 * Auto-seed default categories on first launch
 * Creates the Australian Personal + Business category hierarchy,
 * GST system accounts, and default settings when the database is empty.
 */
import { AccountType, AccountKind } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

export async function seedDefaultCategories(prisma: PrismaClient): Promise<void> {
  const accountCount = await prisma.account.count();
  if (accountCount > 0) return; // Already has data

  console.log('📁 First launch detected — seeding default categories...');

  // ========== GST SYSTEM ACCOUNTS ==========
  await prisma.account.createMany({
    data: [
      {
        name: 'GST Collected',
        fullPath: 'GST/Collected',
        type: AccountType.LIABILITY,
        kind: AccountKind.CATEGORY,
        level: 1,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 50,
      },
      {
        name: 'GST Paid',
        fullPath: 'GST/Paid',
        type: AccountType.ASSET,
        kind: AccountKind.CATEGORY,
        level: 1,
        isReal: false,
        isBusinessDefault: true,
        sortOrder: 51,
      },
    ],
  });

  // ========== INCOME HIERARCHY ==========

  // Personal Income
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

  await prisma.account.createMany({
    data: [
      { name: 'Salary', fullPath: 'Income/Personal/Employment/Salary', type: AccountType.INCOME, kind: AccountKind.CATEGORY, parentId: employment.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 102 },
      { name: 'Bonuses', fullPath: 'Income/Personal/Employment/Bonuses', type: AccountType.INCOME, kind: AccountKind.CATEGORY, parentId: employment.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 103 },
      { name: 'Overtime', fullPath: 'Income/Personal/Employment/Overtime', type: AccountType.INCOME, kind: AccountKind.CATEGORY, parentId: employment.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 104 },
    ],
  });

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
      { name: 'Interest', fullPath: 'Income/Personal/Investment/Interest', type: AccountType.INCOME, kind: AccountKind.CATEGORY, parentId: personalInvestment.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 111 },
      { name: 'Dividends', fullPath: 'Income/Personal/Investment/Dividends', type: AccountType.INCOME, kind: AccountKind.CATEGORY, parentId: personalInvestment.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 112 },
    ],
  });

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
      { name: 'Gifts Received', fullPath: 'Income/Personal/Other/Gifts', type: AccountType.INCOME, kind: AccountKind.CATEGORY, parentId: otherPersonalIncome.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 121 },
      { name: 'Tax Refunds', fullPath: 'Income/Personal/Other/TaxRefunds', type: AccountType.INCOME, kind: AccountKind.CATEGORY, parentId: otherPersonalIncome.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 122 },
    ],
  });

  // Business Income
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

  await prisma.account.createMany({
    data: [
      { name: 'Product Sales', fullPath: 'Income/Business/Sales/Products', type: AccountType.INCOME, kind: AccountKind.CATEGORY, parentId: sales.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 202 },
      { name: 'Service Revenue', fullPath: 'Income/Business/Sales/Services', type: AccountType.INCOME, kind: AccountKind.CATEGORY, parentId: sales.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 203 },
      { name: 'Consulting Fees', fullPath: 'Income/Business/Sales/Consulting', type: AccountType.INCOME, kind: AccountKind.CATEGORY, parentId: sales.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 204 },
    ],
  });

  // ========== EXPENSE HIERARCHY ==========

  // Personal Expenses
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
      { name: 'Rent/Mortgage', fullPath: 'Expense/Personal/Housing/Rent', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: housing.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 1002 },
      { name: 'Utilities', fullPath: 'Expense/Personal/Housing/Utilities', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: housing.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 1003 },
      { name: 'Home Insurance', fullPath: 'Expense/Personal/Housing/Insurance', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: housing.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 1004 },
      { name: 'Maintenance', fullPath: 'Expense/Personal/Housing/Maintenance', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: housing.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 1005 },
    ],
  });

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

  await prisma.account.createMany({
    data: [
      { name: 'Groceries', fullPath: 'Expense/Personal/Food/Groceries', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: foodDining.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 1011 },
      { name: 'Dining Out', fullPath: 'Expense/Personal/Food/DiningOut', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: foodDining.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 1012 },
      { name: 'Takeaway', fullPath: 'Expense/Personal/Food/Takeaway', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: foodDining.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 1013 },
    ],
  });

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
      { name: 'Fuel', fullPath: 'Expense/Personal/Transportation/Fuel', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: transportation.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 1021 },
      { name: 'Public Transport', fullPath: 'Expense/Personal/Transportation/PublicTransport', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: transportation.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 1022 },
      { name: 'Vehicle Maintenance', fullPath: 'Expense/Personal/Transportation/Maintenance', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: transportation.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 1023 },
    ],
  });

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
      { name: 'Medical', fullPath: 'Expense/Personal/Healthcare/Medical', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: healthcare.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 1031 },
      { name: 'Dental', fullPath: 'Expense/Personal/Healthcare/Dental', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: healthcare.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 1032 },
      { name: 'Pharmacy', fullPath: 'Expense/Personal/Healthcare/Pharmacy', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: healthcare.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 1033 },
    ],
  });

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
      { name: 'Subscriptions', fullPath: 'Expense/Personal/Entertainment/Subscriptions', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: entertainment.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 1041 },
      { name: 'Hobbies', fullPath: 'Expense/Personal/Entertainment/Hobbies', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: entertainment.id, level: 3, isReal: false, isBusinessDefault: false, sortOrder: 1042 },
    ],
  });

  // Business Expenses
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
      { name: 'Rent', fullPath: 'Expense/Business/Operating/Rent', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: operatingExpenses.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 2002 },
      { name: 'Utilities', fullPath: 'Expense/Business/Operating/Utilities', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: operatingExpenses.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 2003 },
      { name: 'Insurance', fullPath: 'Expense/Business/Operating/Insurance', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: operatingExpenses.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 2004 },
      { name: 'Office Supplies', fullPath: 'Expense/Business/Operating/Supplies', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: operatingExpenses.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 2005 },
    ],
  });

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
      { name: 'Materials', fullPath: 'Expense/Business/COGS/Materials', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: cogs.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 2011 },
      { name: 'Direct Labor', fullPath: 'Expense/Business/COGS/Labor', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: cogs.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 2012 },
      { name: 'Shipping & Freight', fullPath: 'Expense/Business/COGS/Shipping', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: cogs.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 2013 },
    ],
  });

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
      { name: 'Digital Marketing', fullPath: 'Expense/Business/Marketing/Digital', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: marketing.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 2021 },
      { name: 'Print Advertising', fullPath: 'Expense/Business/Marketing/Print', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: marketing.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 2022 },
    ],
  });

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
      { name: 'Accounting', fullPath: 'Expense/Business/Professional/Accounting', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: professional.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 2031 },
      { name: 'Legal', fullPath: 'Expense/Business/Professional/Legal', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: professional.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 2032 },
    ],
  });

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
      { name: 'Software Subscriptions', fullPath: 'Expense/Business/Technology/Software', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: technology.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 2041 },
      { name: 'Hardware', fullPath: 'Expense/Business/Technology/Hardware', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: technology.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 2042 },
    ],
  });

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

  await prisma.account.createMany({
    data: [
      { name: 'Business Meals', fullPath: 'Expense/Business/Travel/Meals', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: businessTravel.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 2051 },
      { name: 'Business Travel', fullPath: 'Expense/Business/Travel/Travel', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: businessTravel.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 2052 },
      { name: 'Accommodation', fullPath: 'Expense/Business/Travel/Accommodation', type: AccountType.EXPENSE, kind: AccountKind.CATEGORY, parentId: businessTravel.id, level: 3, isReal: false, isBusinessDefault: true, sortOrder: 2053 },
    ],
  });

  // Uncategorized fallback
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

  // ========== DEFAULT SETTINGS ==========
  await prisma.settings.createMany({
    data: [
      { key: 'gst_enabled', value: JSON.stringify(true) },
      { key: 'default_gst_rate', value: JSON.stringify(0.1) },
      { key: 'organisation', value: JSON.stringify({ name: 'My Business', abn: '', address: '' }) },
      { key: 'locale', value: JSON.stringify({ dateFormat: 'dd/MM/yyyy', timezone: 'Australia/Melbourne', currency: 'AUD' }) },
    ],
  });

  const count = await prisma.account.count();
  console.log(`✅ Seeded ${count} default categories and settings`);
}
