import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearSeedData() {
  try {
    console.log('🧹 Clearing seed data...');

    // Delete all accounts EXCEPT user-created ones
    // Seed accounts have specific names, user accounts won't match these patterns
    const seedAccountNames = [
      'Personal Checking',
      'Business Checking',
      'Personal Credit Card',
      'Business Credit Card',
      'GST Control',
      'Holiday Fund',
      'Personal Income',
      'Employment',
      'Salary',
      'Bonuses',
      'Overtime',
    ];

    // Get all category accounts (these are all from seed)
    const categoryAccounts = await prisma.account.findMany({
      where: {
        kind: 'CATEGORY',
      },
      orderBy: {
        level: 'desc', // Delete deepest levels first (children before parents)
      },
    });

    console.log(`Found ${categoryAccounts.length} category accounts to delete`);

    // Delete category accounts one by one, starting from deepest level
    for (const account of categoryAccounts) {
      await prisma.account.delete({
        where: { id: account.id },
      });
    }

    // Delete seed transfer accounts
    await prisma.account.deleteMany({
      where: {
        kind: 'TRANSFER',
        OR: seedAccountNames.map(name => ({ name })),
      },
    });

    console.log('✅ Seed data cleared successfully!');

    // Show remaining accounts
    const remaining = await prisma.account.findMany({
      where: {
        kind: 'TRANSFER',
      },
      select: {
        name: true,
        type: true,
      },
    });

    console.log('\n📋 Remaining accounts:');
    remaining.forEach(acc => {
      console.log(`  - ${acc.name} (${acc.type})`);
    });

  } catch (error) {
    console.error('❌ Error clearing seed data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearSeedData();
