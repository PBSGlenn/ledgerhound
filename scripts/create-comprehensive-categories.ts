import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createComprehensiveCategories() {
  try {
    console.log('📁 Creating comprehensive category structure...\n');

    // Get existing root categories
    const income = await prisma.account.findFirst({
      where: { name: 'Income', kind: 'CATEGORY', parentId: null },
    });

    const expense = await prisma.account.findFirst({
      where: { name: 'Expense', kind: 'CATEGORY', parentId: null },
    });

    if (!income || !expense) {
      throw new Error('Root Income and Expense categories not found. Run create-basic-categories.ts first.');
    }

    // Personal Income Categories
    console.log('Creating Income categories...');
    const employment = await prisma.account.create({
      data: {
        name: 'Employment',
        fullPath: 'Income/Employment',
        type: 'INCOME',
        kind: 'CATEGORY',
        level: 1,
        parentId: income.id,
        sortOrder: 0,
      },
    });

    await prisma.account.create({
      data: {
        name: 'Investment Income',
        fullPath: 'Income/Investment Income',
        type: 'INCOME',
        kind: 'CATEGORY',
        level: 1,
        parentId: income.id,
        sortOrder: 1,
      },
    });

    await prisma.account.create({
      data: {
        name: 'Other Income',
        fullPath: 'Income/Other Income',
        type: 'INCOME',
        kind: 'CATEGORY',
        level: 1,
        parentId: income.id,
        sortOrder: 2,
      },
    });

    // Personal Expense Categories
    console.log('Creating Expense categories...');

    // Healthcare
    const healthcare = await prisma.account.create({
      data: {
        name: 'Healthcare',
        fullPath: 'Expense/Healthcare',
        type: 'EXPENSE',
        kind: 'CATEGORY',
        level: 1,
        parentId: expense.id,
        sortOrder: 1,
      },
    });

    await prisma.account.createMany({
      data: [
        { name: 'Dental', fullPath: 'Expense/Healthcare/Dental', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: healthcare.id, sortOrder: 0 },
        { name: 'Medical', fullPath: 'Expense/Healthcare/Medical', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: healthcare.id, sortOrder: 1 },
        { name: 'Pharmacy', fullPath: 'Expense/Healthcare/Pharmacy', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: healthcare.id, sortOrder: 2 },
        { name: 'Insurance', fullPath: 'Expense/Healthcare/Insurance', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: healthcare.id, sortOrder: 3 },
      ],
    });

    // Shopping
    const shopping = await prisma.account.create({
      data: {
        name: 'Shopping',
        fullPath: 'Expense/Shopping',
        type: 'EXPENSE',
        kind: 'CATEGORY',
        level: 1,
        parentId: expense.id,
        sortOrder: 2,
      },
    });

    await prisma.account.createMany({
      data: [
        { name: 'Groceries', fullPath: 'Expense/Shopping/Groceries', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: shopping.id, sortOrder: 0 },
        { name: 'Retail', fullPath: 'Expense/Shopping/Retail', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: shopping.id, sortOrder: 1 },
        { name: 'Clothing', fullPath: 'Expense/Shopping/Clothing', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: shopping.id, sortOrder: 2 },
        { name: 'Electronics', fullPath: 'Expense/Shopping/Electronics', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: shopping.id, sortOrder: 3 },
      ],
    });

    // Dining & Entertainment
    const dining = await prisma.account.create({
      data: {
        name: 'Dining & Entertainment',
        fullPath: 'Expense/Dining & Entertainment',
        type: 'EXPENSE',
        kind: 'CATEGORY',
        level: 1,
        parentId: expense.id,
        sortOrder: 3,
      },
    });

    await prisma.account.createMany({
      data: [
        { name: 'Restaurants', fullPath: 'Expense/Dining & Entertainment/Restaurants', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: dining.id, sortOrder: 0 },
        { name: 'Cafes & Coffee', fullPath: 'Expense/Dining & Entertainment/Cafes & Coffee', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: dining.id, sortOrder: 1 },
        { name: 'Fast Food', fullPath: 'Expense/Dining & Entertainment/Fast Food', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: dining.id, sortOrder: 2 },
        { name: 'Bars & Pubs', fullPath: 'Expense/Dining & Entertainment/Bars & Pubs', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: dining.id, sortOrder: 3 },
        { name: 'Entertainment', fullPath: 'Expense/Dining & Entertainment/Entertainment', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: dining.id, sortOrder: 4 },
      ],
    });

    // Transportation
    const transportation = await prisma.account.create({
      data: {
        name: 'Transportation',
        fullPath: 'Expense/Transportation',
        type: 'EXPENSE',
        kind: 'CATEGORY',
        level: 1,
        parentId: expense.id,
        sortOrder: 4,
      },
    });

    await prisma.account.createMany({
      data: [
        { name: 'Fuel', fullPath: 'Expense/Transportation/Fuel', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: transportation.id, sortOrder: 0 },
        { name: 'Public Transport', fullPath: 'Expense/Transportation/Public Transport', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: transportation.id, sortOrder: 1 },
        { name: 'Parking', fullPath: 'Expense/Transportation/Parking', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: transportation.id, sortOrder: 2 },
        { name: 'Vehicle Maintenance', fullPath: 'Expense/Transportation/Vehicle Maintenance', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: transportation.id, sortOrder: 3 },
        { name: 'Rideshare & Taxi', fullPath: 'Expense/Transportation/Rideshare & Taxi', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: transportation.id, sortOrder: 4 },
      ],
    });

    // Utilities & Bills
    const utilities = await prisma.account.create({
      data: {
        name: 'Utilities & Bills',
        fullPath: 'Expense/Utilities & Bills',
        type: 'EXPENSE',
        kind: 'CATEGORY',
        level: 1,
        parentId: expense.id,
        sortOrder: 5,
      },
    });

    await prisma.account.createMany({
      data: [
        { name: 'Electricity', fullPath: 'Expense/Utilities & Bills/Electricity', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: utilities.id, sortOrder: 0 },
        { name: 'Gas', fullPath: 'Expense/Utilities & Bills/Gas', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: utilities.id, sortOrder: 1 },
        { name: 'Water', fullPath: 'Expense/Utilities & Bills/Water', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: utilities.id, sortOrder: 2 },
        { name: 'Internet', fullPath: 'Expense/Utilities & Bills/Internet', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: utilities.id, sortOrder: 3 },
        { name: 'Mobile Phone', fullPath: 'Expense/Utilities & Bills/Mobile Phone', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: utilities.id, sortOrder: 4 },
      ],
    });

    // Housing
    const housing = await prisma.account.create({
      data: {
        name: 'Housing',
        fullPath: 'Expense/Housing',
        type: 'EXPENSE',
        kind: 'CATEGORY',
        level: 1,
        parentId: expense.id,
        sortOrder: 6,
      },
    });

    await prisma.account.createMany({
      data: [
        { name: 'Rent', fullPath: 'Expense/Housing/Rent', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: housing.id, sortOrder: 0 },
        { name: 'Mortgage', fullPath: 'Expense/Housing/Mortgage', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: housing.id, sortOrder: 1 },
        { name: 'Home Maintenance', fullPath: 'Expense/Housing/Home Maintenance', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: housing.id, sortOrder: 2 },
        { name: 'Furniture', fullPath: 'Expense/Housing/Furniture', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: housing.id, sortOrder: 3 },
      ],
    });

    // Personal Care
    const personalCare = await prisma.account.create({
      data: {
        name: 'Personal Care',
        fullPath: 'Expense/Personal Care',
        type: 'EXPENSE',
        kind: 'CATEGORY',
        level: 1,
        parentId: expense.id,
        sortOrder: 7,
      },
    });

    await prisma.account.createMany({
      data: [
        { name: 'Haircuts', fullPath: 'Expense/Personal Care/Haircuts', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: personalCare.id, sortOrder: 0 },
        { name: 'Cosmetics', fullPath: 'Expense/Personal Care/Cosmetics', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: personalCare.id, sortOrder: 1 },
        { name: 'Gym', fullPath: 'Expense/Personal Care/Gym', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: personalCare.id, sortOrder: 2 },
      ],
    });

    // Financial
    const financial = await prisma.account.create({
      data: {
        name: 'Financial',
        fullPath: 'Expense/Financial',
        type: 'EXPENSE',
        kind: 'CATEGORY',
        level: 1,
        parentId: expense.id,
        sortOrder: 8,
      },
    });

    await prisma.account.createMany({
      data: [
        { name: 'Bank Fees', fullPath: 'Expense/Financial/Bank Fees', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: financial.id, sortOrder: 0 },
        { name: 'Interest Charges', fullPath: 'Expense/Financial/Interest Charges', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: financial.id, sortOrder: 1 },
        { name: 'Subscriptions', fullPath: 'Expense/Financial/Subscriptions', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: financial.id, sortOrder: 2 },
      ],
    });

    // Education
    const education = await prisma.account.create({
      data: {
        name: 'Education',
        fullPath: 'Expense/Education',
        type: 'EXPENSE',
        kind: 'CATEGORY',
        level: 1,
        parentId: expense.id,
        sortOrder: 9,
      },
    });

    await prisma.account.createMany({
      data: [
        { name: 'Books', fullPath: 'Expense/Education/Books', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: education.id, sortOrder: 0 },
        { name: 'Courses', fullPath: 'Expense/Education/Courses', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: education.id, sortOrder: 1 },
        { name: 'School Fees', fullPath: 'Expense/Education/School Fees', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: education.id, sortOrder: 2 },
      ],
    });

    // Gifts & Donations
    await prisma.account.create({
      data: {
        name: 'Gifts & Donations',
        fullPath: 'Expense/Gifts & Donations',
        type: 'EXPENSE',
        kind: 'CATEGORY',
        level: 1,
        parentId: expense.id,
        sortOrder: 10,
      },
    });

    // Travel
    const travel = await prisma.account.create({
      data: {
        name: 'Travel',
        fullPath: 'Expense/Travel',
        type: 'EXPENSE',
        kind: 'CATEGORY',
        level: 1,
        parentId: expense.id,
        sortOrder: 11,
      },
    });

    await prisma.account.createMany({
      data: [
        { name: 'Accommodation', fullPath: 'Expense/Travel/Accommodation', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: travel.id, sortOrder: 0 },
        { name: 'Flights', fullPath: 'Expense/Travel/Flights', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: travel.id, sortOrder: 1 },
        { name: 'Activities', fullPath: 'Expense/Travel/Activities', type: 'EXPENSE', kind: 'CATEGORY', level: 2, parentId: travel.id, sortOrder: 2 },
      ],
    });

    console.log('\n✅ Category structure created successfully!');
    console.log('\n📊 Summary:');
    console.log('   Income: 3 categories');
    console.log('   Expense: 11 main categories with multiple subcategories');
    console.log('   - Healthcare (4 subcategories)');
    console.log('   - Shopping (4 subcategories)');
    console.log('   - Dining & Entertainment (5 subcategories)');
    console.log('   - Transportation (5 subcategories)');
    console.log('   - Utilities & Bills (5 subcategories)');
    console.log('   - Housing (4 subcategories)');
    console.log('   - Personal Care (3 subcategories)');
    console.log('   - Financial (3 subcategories)');
    console.log('   - Education (3 subcategories)');
    console.log('   - Gifts & Donations');
    console.log('   - Travel (3 subcategories)');
    console.log('   - Uncategorized');

  } catch (error) {
    console.error('❌ Error creating categories:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createComprehensiveCategories();
