import { getPrismaClient } from '../src/lib/db';

const prisma = getPrismaClient();

async function countStripeTransactions() {
  const count = await prisma.transaction.count({
    where: {
      externalId: { startsWith: 'txn_' }
    }
  });

  console.log(`Stripe transactions in database: ${count}`);
  await prisma.$disconnect();
}

countStripeTransactions().catch(console.error);
