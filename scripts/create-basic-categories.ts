import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createBasicCategories() {
  try {
    console.log('📁 Creating basic category structure...');

    // Create root Income and Expense categories
    const income = await prisma.account.create({
      data: {
        name: 'Income',
        fullPath: 'Income',
        type: 'INCOME',
        kind: 'CATEGORY',
        level: 0,
        isBusinessDefault: false,
        sortOrder: 0,
      },
    });

    const expense = await prisma.account.create({
      data: {
        name: 'Expense',
        fullPath: 'Expense',
        type: 'EXPENSE',
        kind: 'CATEGORY',
        level: 0,
        isBusinessDefault: false,
        sortOrder: 1,
      },
    });

    // Create Uncategorized under Expense
    const uncategorized = await prisma.account.create({
      data: {
        name: 'Uncategorized',
        fullPath: 'Expense/Uncategorized',
        type: 'EXPENSE',
        kind: 'CATEGORY',
        level: 1,
        parentId: expense.id,
        isBusinessDefault: false,
        sortOrder: 0,
      },
    });

    console.log('✅ Created basic categories:');
    console.log('  - Income');
    console.log('  - Expense');
    console.log('  - Expense/Uncategorized');

    console.log('\n💡 You can now import transactions. Uncategorized transactions will go to "Uncategorized".');

  } catch (error) {
    console.error('❌ Error creating categories:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createBasicCategories();
