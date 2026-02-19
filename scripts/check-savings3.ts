import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasources: { db: { url: 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db' } } });

async function run() {
  const savingsId = 'c95b5aa6-7b11-41db-9a74-5c27f72dcabc';
  const txnId = '69f5e434-cd1f-4754-8a05-f8b3f4d4a410';

  // Check the 2 unmerged transfers to see if they're duplicates
  console.log('=== Checking 2025-01-13 for duplicates ===\n');

  const all13 = await prisma.transaction.findMany({
    where: {
      date: { gte: new Date('2025-01-13'), lt: new Date('2025-01-14') },
      postings: { some: { accountId: { in: [savingsId, txnId] } } },
    },
    include: { postings: { include: { account: true } } },
    orderBy: { date: 'asc' },
  });

  for (const tx of all13) {
    console.log(`TX: ${tx.id} | Payee: ${tx.payee}`);
    console.log(`  Created: ${tx.createdAt.toISOString()}`);
    console.log(`  Meta: ${tx.metadata || 'null'}`);
    for (const p of tx.postings) {
      console.log(`  ${p.account.name.trim().padEnd(15)} = ${String(p.amount).padStart(8)} (posting created: ${p.createdAt.toISOString()})`);
    }
    console.log();
  }

  // Now check: what does MQB Txn register show for same date?
  console.log('\n=== MQB Txn register for 2025-01-13 ===\n');
  const txn13 = await prisma.transaction.findMany({
    where: {
      date: { gte: new Date('2025-01-13'), lt: new Date('2025-01-14') },
      postings: { some: { accountId: txnId } },
    },
    include: { postings: { include: { account: true } } },
  });

  for (const tx of txn13) {
    const txnPosting = tx.postings.find(p => p.accountId === txnId);
    const otherPosting = tx.postings.find(p => p.accountId !== txnId);
    console.log(`TX: ${tx.id} | ${tx.payee.substring(0, 55)} | Txn=${txnPosting?.amount} ${otherPosting?.account.name.trim()}=${otherPosting?.amount} | merged=${tx.metadata?.includes('transferMatched') || false}`);
  }

  // Overall: how many transfers were in original CSV for MQB Savings?
  // Check by looking at transactions that ONLY touch savings (unmatched originals)
  console.log('\n\n=== Summary of MQB Savings register entries by category ===');
  const allSavings = await prisma.transaction.findMany({
    where: { postings: { some: { accountId: savingsId } } },
    include: { postings: { include: { account: true } } },
    orderBy: { date: 'asc' },
  });

  let mergedTransfers = 0;
  let unmergedTransfers = 0;
  let uncategorized = 0;
  let other = 0;

  for (const tx of allSavings) {
    const isMerged = tx.metadata?.includes('transferMatched');
    const otherPosting = tx.postings.find(p => p.accountId !== savingsId);
    const isTransfer = otherPosting?.account.kind === 'TRANSFER';
    const isUncat = otherPosting?.account.name === 'Uncategorized';

    if (isMerged) mergedTransfers++;
    else if (isTransfer) unmergedTransfers++;
    else if (isUncat) uncategorized++;
    else other++;
  }

  console.log(`  Merged transfers (transferMatched): ${mergedTransfers}`);
  console.log(`  Unmerged transfers (Savings↔real acct, no flag): ${unmergedTransfers}`);
  console.log(`  Uncategorized: ${uncategorized}`);
  console.log(`  Other: ${other}`);
  console.log(`  Total: ${allSavings.length}`);

  await prisma.$disconnect();
}
run();
