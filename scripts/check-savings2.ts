import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasources: { db: { url: 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db' } } });

async function run() {
  const savingsId = 'c95b5aa6-7b11-41db-9a74-5c27f72dcabc';
  const txnId = '69f5e434-cd1f-4754-8a05-f8b3f4d4a410';

  // Look at ALL transactions touching MQB Savings on 2025-01-13
  console.log('=== 2025-01-13 Transactions on MQB Savings ===\n');
  const jan13 = await prisma.transaction.findMany({
    where: {
      date: { gte: new Date('2025-01-13'), lte: new Date('2025-01-14') },
      postings: { some: { accountId: savingsId } },
    },
    include: { postings: { include: { account: true } } },
  });

  for (const tx of jan13) {
    console.log(`TX ID: ${tx.id}`);
    console.log(`  Date: ${new Date(tx.date).toISOString().slice(0,10)}`);
    console.log(`  Payee: ${tx.payee}`);
    console.log(`  Metadata: ${tx.metadata || 'null'}`);
    for (const p of tx.postings) {
      console.log(`  Posting: ${p.account.name.trim()} = ${p.amount} (created: ${p.createdAt.toISOString()})`);
    }
    console.log();
  }

  // Check for unmerged transfers that have MQB Txn postings but no transferMatched metadata
  console.log('\n=== Unmerged MQB Savings ↔ MQB Txn transfers (no transferMatched flag) ===\n');
  const unmergedTransfers = await prisma.transaction.findMany({
    where: {
      postings: { some: { accountId: savingsId } },
      AND: [
        { postings: { some: { accountId: txnId } } },
        { OR: [{ metadata: null }, { NOT: { metadata: { contains: 'transferMatched' } } }] },
      ],
    },
    include: { postings: { include: { account: true } } },
    orderBy: { date: 'asc' },
  });

  console.log(`Found ${unmergedTransfers.length} unmerged transfers:\n`);
  for (const tx of unmergedTransfers) {
    const sp = tx.postings.find(p => p.accountId === savingsId);
    const tp = tx.postings.find(p => p.accountId === txnId);
    console.log(`${new Date(tx.date).toISOString().slice(0,10)} | ${tx.payee.substring(0,55)} | Savings=${sp?.amount} Txn=${tp?.amount} | meta=${tx.metadata?.substring(0,60) || 'null'}`);
  }

  // Count totals
  const totalSavingsTxns = await prisma.transaction.count({
    where: { postings: { some: { accountId: savingsId } } },
  });
  const mergedCount = await prisma.transaction.count({
    where: { postings: { some: { accountId: savingsId } }, metadata: { contains: 'transferMatched' } },
  });
  console.log(`\n=== TOTALS ===`);
  console.log(`Total MQB Savings transactions: ${totalSavingsTxns}`);
  console.log(`Merged (transferMatched): ${mergedCount}`);
  console.log(`Non-merged: ${totalSavingsTxns - mergedCount}`);

  await prisma.$disconnect();
}
run();
