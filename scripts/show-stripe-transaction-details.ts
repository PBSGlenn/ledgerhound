import { getPrismaClient } from '../src/lib/db';

const prisma = getPrismaClient();

async function showTransactionDetails() {
  // Find a recent Stripe charge
  const tx = await prisma.transaction.findFirst({
    where: {
      externalId: { startsWith: 'txn_' },
      payee: { contains: 'Calendly' }
    },
    include: {
      postings: {
        include: {
          account: true
        }
      }
    },
    orderBy: {
      date: 'desc'
    }
  });

  if (!tx) {
    console.log('No Stripe charge transactions found');
    await prisma.$disconnect();
    return;
  }

  console.log('=== RAW DATABASE RECORD ===');
  console.log('Transaction ID:', tx.id);
  console.log('External ID:', tx.externalId);
  console.log('Date:', tx.date);
  console.log('Payee:', tx.payee);
  console.log('Memo:', tx.memo);
  console.log('Reference:', tx.reference);

  console.log('\n=== METADATA (RAW JSON) ===');
  console.log(tx.metadata);

  if (tx.metadata) {
    console.log('\n=== METADATA (PARSED) ===');
    const metadata = JSON.parse(tx.metadata);
    console.log('Stripe Type:', metadata.stripeType);
    console.log('Gross Amount:', metadata.grossAmount);
    console.log('Fee Amount:', metadata.feeAmount);
    console.log('Fee GST:', metadata.feeGst);
    console.log('Net Amount:', metadata.netAmount);
    console.log('Fee Details:', JSON.stringify(metadata.feeDetails, null, 2));
  }

  console.log('\n=== POSTINGS (RAW DATABASE) ===');
  for (const posting of tx.postings) {
    console.log(`Posting ID: ${posting.id}`);
    console.log(`  Account: ${posting.account.name} (${posting.account.type})`);
    console.log(`  Account ID: ${posting.accountId}`);
    console.log(`  Amount: ${posting.amount}`);
    console.log(`  Is Business: ${posting.isBusiness}`);
    console.log(`  GST Code: ${posting.gstCode || 'null'}`);
    console.log('---');
  }

  console.log('\n=== DOUBLE-ENTRY CHECK ===');
  const sum = tx.postings.reduce((acc, p) => acc + p.amount, 0);
  console.log('Sum of postings:', sum);
  console.log('Balanced:', Math.abs(sum) < 0.01 ? '✓ YES' : '✗ NO - INVALID!');

  await prisma.$disconnect();
}

showTransactionDetails().catch(console.error);
