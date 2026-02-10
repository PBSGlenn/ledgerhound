import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findTestData() {
  console.log('🔍 Searching for Test data in database...\n');

  // Find accounts with "Test" in name
  const testAccounts = await prisma.account.findMany({
    where: {
      name: {
        contains: 'Test'
      }
    },
    select: {
      id: true,
      name: true,
      type: true,
      kind: true,
      archived: true,
      createdAt: true
    },
    orderBy: {
      name: 'asc'
    }
  });

  // Find transactions with "Test" in payee
  const testTransactions = await prisma.transaction.findMany({
    where: {
      payee: {
        contains: 'Test'
      }
    },
    select: {
      id: true,
      date: true,
      payee: true,
      memo: true,
      status: true,
      createdAt: true,
      postings: {
        include: {
          account: {
            select: {
              name: true
            }
          }
        }
      }
    },
    orderBy: {
      date: 'desc'
    }
  });

  // Find memorized rules with "Test" in name or matchValue
  const testRules = await prisma.memorizedRule.findMany({
    where: {
      OR: [
        {
          name: {
            contains: 'Test',
            mode: 'insensitive'
          }
        },
        {
          matchValue: {
            contains: 'Test',
            mode: 'insensitive'
          }
        }
      ]
    },
    select: {
      id: true,
      name: true,
      matchType: true,
      matchValue: true,
      defaultPayee: true,
      createdAt: true
    },
    orderBy: {
      name: 'asc'
    }
  });

  // Display results
  console.log(`📊 RESULTS:\n`);

  console.log(`🏦 Accounts with "Test" (${testAccounts.length}):`);
  if (testAccounts.length > 0) {
    testAccounts.forEach(acc => {
      const archivedFlag = acc.archived ? '🗄️  ARCHIVED' : '';
      console.log(`  - ${acc.name} (${acc.type}, ${acc.kind}) ${archivedFlag}`);
      console.log(`    ID: ${acc.id}`);
      console.log(`    Created: ${acc.createdAt.toISOString().split('T')[0]}\n`);
    });
  } else {
    console.log('  None found\n');
  }

  console.log(`💰 Transactions with "Test" payee (${testTransactions.length}):`);
  if (testTransactions.length > 0) {
    testTransactions.forEach(txn => {
      console.log(`  - ${txn.date.toISOString().split('T')[0]} | ${txn.payee}`);
      console.log(`    ID: ${txn.id}`);
      if (txn.memo) console.log(`    Memo: ${txn.memo}`);
      console.log(`    Status: ${txn.status}`);
      console.log(`    Accounts: ${txn.postings.map(p => p.account.name).join(', ')}\n`);
    });
  } else {
    console.log('  None found\n');
  }

  console.log(`📋 Memorized Rules with "Test" (${testRules.length}):`);
  if (testRules.length > 0) {
    testRules.forEach(rule => {
      console.log(`  - ${rule.name}`);
      console.log(`    ID: ${rule.id}`);
      console.log(`    Match: ${rule.matchType} "${rule.matchValue}"`);
      if (rule.defaultPayee) console.log(`    Default Payee: ${rule.defaultPayee}`);
      console.log(`    Created: ${rule.createdAt.toISOString().split('T')[0]}\n`);
    });
  } else {
    console.log('  None found\n');
  }

  // Summary
  console.log('━'.repeat(60));
  console.log(`\n✅ SUMMARY:`);
  console.log(`   Total Accounts: ${testAccounts.length}`);
  console.log(`   Total Transactions: ${testTransactions.length}`);
  console.log(`   Total Rules: ${testRules.length}`);
  console.log(`   GRAND TOTAL: ${testAccounts.length + testTransactions.length + testRules.length} test records\n`);

  await prisma.$disconnect();
}

findTestData()
  .catch(error => {
    console.error('Error finding test data:', error);
    process.exit(1);
  });
