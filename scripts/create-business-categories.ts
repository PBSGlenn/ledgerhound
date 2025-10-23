import { getPrismaClient } from '../src/lib/db';
import { AccountType } from '@prisma/client';

const prisma = getPrismaClient();

async function createBusinessCategories() {
  console.log('📁 Creating business category structure...\n');

  // Get the root Expense category
  const expenseRoot = await prisma.account.findFirst({
    where: {
      name: 'Expense',
      level: 0,
      kind: 'CATEGORY',
    },
  });

  if (!expenseRoot) {
    throw new Error('Expense root category not found');
  }

  // Get the root Income category
  const incomeRoot = await prisma.account.findFirst({
    where: {
      name: 'Income',
      level: 0,
      kind: 'CATEGORY',
    },
  });

  if (!incomeRoot) {
    throw new Error('Income root category not found');
  }

  console.log('Creating Business Income categories...');

  // Business Income Categories
  const businessIncomeCategories = [
    { name: 'Sales Revenue', subcategories: [] },
    { name: 'Service Revenue', subcategories: [] },
    { name: 'Consulting Income', subcategories: [] },
    { name: 'Other Business Income', subcategories: [] },
  ];

  let sortOrder = 100; // Start at 100 to keep after personal income categories

  for (const category of businessIncomeCategories) {
    const parent = await prisma.account.create({
      data: {
        name: category.name,
        fullPath: `Income/${category.name}`,
        type: AccountType.INCOME,
        kind: 'CATEGORY',
        level: 1,
        parentId: incomeRoot.id,
        isBusinessDefault: true, // Business categories have GST enabled by default
        sortOrder: sortOrder++,
      },
    });

    let subSortOrder = 0;
    for (const subName of category.subcategories) {
      await prisma.account.create({
        data: {
          name: subName,
          fullPath: `Income/${category.name}/${subName}`,
          type: AccountType.INCOME,
          kind: 'CATEGORY',
          level: 2,
          parentId: parent.id,
          isBusinessDefault: true,
          sortOrder: subSortOrder++,
        },
      });
    }
  }

  console.log('Creating Business Expense categories...');

  // Business Expense Categories
  const businessExpenseCategories = [
    {
      name: 'Office & Supplies',
      subcategories: ['Office Supplies', 'Stationery', 'Postage & Shipping', 'Equipment'],
    },
    {
      name: 'Professional Services',
      subcategories: ['Accounting & Bookkeeping', 'Legal Fees', 'Consulting', 'IT Services'],
    },
    {
      name: 'Marketing & Advertising',
      subcategories: ['Online Advertising', 'Print Advertising', 'Website & Hosting', 'Social Media'],
    },
    {
      name: 'Business Travel',
      subcategories: ['Accommodation', 'Flights', 'Meals While Travelling', 'Ground Transport'],
    },
    {
      name: 'Vehicle Expenses',
      subcategories: ['Fuel', 'Maintenance & Repairs', 'Registration & Insurance', 'Parking & Tolls'],
    },
    {
      name: 'Communications',
      subcategories: ['Mobile Phone', 'Internet', 'Landline', 'Messaging Services'],
    },
    {
      name: 'Insurance',
      subcategories: ['Public Liability', 'Professional Indemnity', 'Business Contents', 'Other Insurance'],
    },
    {
      name: 'Rent & Utilities',
      subcategories: ['Office Rent', 'Electricity', 'Gas', 'Water'],
    },
    {
      name: 'Staff Costs',
      subcategories: ['Wages & Salaries', 'Superannuation', 'Workers Compensation', 'Staff Training'],
    },
    {
      name: 'Bank Charges',
      subcategories: ['Merchant Fees', 'Account Fees', 'Interest on Business Loans'],
    },
    {
      name: 'Subscriptions & Software',
      subcategories: ['Software Subscriptions', 'Professional Memberships', 'Industry Subscriptions', 'Cloud Services'],
    },
    {
      name: 'Cost of Goods Sold',
      subcategories: ['Raw Materials', 'Inventory Purchases', 'Freight & Delivery', 'Packaging'],
    },
    {
      name: 'Depreciation',
      subcategories: [] // Usually no subcategories needed
    },
    {
      name: 'Other Business Expenses',
      subcategories: ['Licenses & Permits', 'Repairs & Maintenance', 'Cleaning', 'Miscellaneous'],
    },
  ];

  sortOrder = 1000; // Start at 1000 to keep after personal expense categories

  for (const category of businessExpenseCategories) {
    const parent = await prisma.account.create({
      data: {
        name: category.name,
        fullPath: `Expense/${category.name}`,
        type: AccountType.EXPENSE,
        kind: 'CATEGORY',
        level: 1,
        parentId: expenseRoot.id,
        isBusinessDefault: true, // Business categories have GST enabled by default
        sortOrder: sortOrder++,
      },
    });

    let subSortOrder = 0;
    for (const subName of category.subcategories) {
      await prisma.account.create({
        data: {
          name: subName,
          fullPath: `Expense/${category.name}/${subName}`,
          type: AccountType.EXPENSE,
          kind: 'CATEGORY',
          level: 2,
          parentId: parent.id,
          isBusinessDefault: true,
          sortOrder: subSortOrder++,
        },
      });
    }
  }

  console.log('\n✅ Business category structure created successfully!\n');
  console.log('📊 Summary:');
  console.log(`   Business Income: ${businessIncomeCategories.length} categories`);
  console.log(`   Business Expense: ${businessExpenseCategories.length} main categories with subcategories`);
  console.log('   - Office & Supplies (4 subcategories)');
  console.log('   - Professional Services (4 subcategories)');
  console.log('   - Marketing & Advertising (4 subcategories)');
  console.log('   - Business Travel (4 subcategories)');
  console.log('   - Vehicle Expenses (4 subcategories)');
  console.log('   - Communications (4 subcategories)');
  console.log('   - Insurance (4 subcategories)');
  console.log('   - Rent & Utilities (4 subcategories)');
  console.log('   - Staff Costs (4 subcategories)');
  console.log('   - Bank Charges (3 subcategories)');
  console.log('   - Subscriptions & Software (4 subcategories)');
  console.log('   - Cost of Goods Sold (4 subcategories)');
  console.log('   - Depreciation');
  console.log('   - Other Business Expenses (4 subcategories)');
  console.log('\n💡 Note: All business categories have isBusinessDefault=true for GST tracking');
}

createBusinessCategories()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error creating business categories:', error);
    process.exit(1);
  });
