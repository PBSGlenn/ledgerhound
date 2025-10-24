import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteDuplicateOpeningBalance() {
  console.log('🔍 Finding duplicate opening balance transactions...');

  const pbsAccount = await prisma.account.findFirst({
    where: {
      name: 'CBA Transaction Account (PBS)',
      kind: 'TRANSFER',
    },
  });

  if (!pbsAccount) {
    console.error('❌ PBS account not found!');
    process.exit(1);
  }

  // Find all opening balance transactions for this account
  const openingBalanceTransactions = await prisma.transaction.findMany({
    where: {
      payee: 'Opening Balance',
      date: new Date('2024-07-01T00:00:00.000Z'),
      postings: {
        some: {
          accountId: pbsAccount.id,
        },
      },
    },
    include: {
      postings: true,
    },
  });

  console.log(`Found ${openingBalanceTransactions.length} opening balance transaction(s)`);

  if (openingBalanceTransactions.length === 0) {
    console.log('✅ No duplicate opening balance to delete');
    return;
  }

  // Delete the transaction we created (it has postings to Opening Balances equity account)
  for (const txn of openingBalanceTransactions) {
    const hasOpeningBalancesEquity = txn.postings.some(
      (p) => p.accountId !== pbsAccount.id
    );

    if (hasOpeningBalancesEquity) {
      console.log(`\n🗑️  Deleting duplicate opening balance transaction: ${txn.id}`);
      console.log(`   Postings: ${txn.postings.length}`);

      // Delete postings first
      await prisma.posting.deleteMany({
        where: { transactionId: txn.id },
      });

      // Delete transaction
      await prisma.transaction.delete({
        where: { id: txn.id },
      });

      console.log('✅ Deleted duplicate opening balance transaction');
    }
  }
}

deleteDuplicateOpeningBalance()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
