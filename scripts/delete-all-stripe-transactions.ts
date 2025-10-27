import { getPrismaClient } from '../src/lib/db';

const prisma = getPrismaClient();

async function deleteAllStripeTransactions() {
  console.log('Finding all Stripe transactions...');

  const stripeTransactions = await prisma.transaction.findMany({
    where: {
      externalId: { startsWith: 'txn_' }
    }
  });

  console.log(`Found ${stripeTransactions.length} Stripe transactions`);

  if (stripeTransactions.length === 0) {
    console.log('No Stripe transactions to delete');
    await prisma.$disconnect();
    return;
  }

  console.log('Deleting...');

  let deleted = 0;
  for (const tx of stripeTransactions) {
    await prisma.transaction.delete({
      where: { id: tx.id }
    });
    deleted++;
    if (deleted % 10 === 0) {
      console.log(`Deleted ${deleted}/${stripeTransactions.length}...`);
    }
  }

  console.log(`✓ Successfully deleted ${deleted} Stripe transactions`);
  await prisma.$disconnect();
}

deleteAllStripeTransactions().catch(console.error);
