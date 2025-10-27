import { getPrismaClient } from '../src/lib/db';

const prisma = getPrismaClient();

async function debugStripeTransaction() {
  // Find a Stripe transaction
  const tx = await prisma.transaction.findFirst({
    where: {
      externalId: { startsWith: 'txn_' }
    },
    include: {
      postings: {
        include: {
          account: true
        }
      }
    }
  });

  if (!tx) {
    console.log('No Stripe transactions found');
    return;
  }

  console.log('=== TRANSACTION ===');
  console.log('ID:', tx.id);
  console.log('External ID:', tx.externalId);
  console.log('Date:', tx.date);
  console.log('Payee:', tx.payee);
  console.log('Memo:', tx.memo);
  console.log('\n=== METADATA ===');
  if (tx.metadata) {
    const metadata = JSON.parse(tx.metadata);
    console.log(JSON.stringify(metadata, null, 2));
  }

  console.log('\n=== POSTINGS ===');
  for (const posting of tx.postings) {
    console.log(`${posting.account.name}: $${posting.amount} (isBusiness: ${posting.isBusiness})`);
  }

  console.log('\n=== TOTAL CHECK ===');
  const sum = tx.postings.reduce((acc, p) => acc + p.amount, 0);
  console.log('Sum of postings:', sum);
  console.log('Should be 0:', sum === 0 ? '✓' : '✗ INVALID');

  await prisma.$disconnect();
}

debugStripeTransaction().catch(console.error);
