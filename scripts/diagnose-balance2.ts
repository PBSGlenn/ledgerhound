import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasources: { db: { url: 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db' } } });

const MQB_TXN_ID = '69f5e434-cd1f-4754-8a05-f8b3f4d4a410';
const MQB_SAVINGS_ID = 'c95b5aa6-7b11-41db-9a74-5c27f72dcabc';

async function run() {
  // 1. Check account opening balances
  const txnAcct = await prisma.account.findUnique({ where: { id: MQB_TXN_ID } });
  const savAcct = await prisma.account.findUnique({ where: { id: MQB_SAVINGS_ID } });
  console.log('=== Account Opening Balances ===');
  console.log(`MQB Txn: openingBalance=${txnAcct?.openingBalance}, openingDate=${txnAcct?.openingDate}`);
  console.log(`MQB Savings: openingBalance=${savAcct?.openingBalance}, openingDate=${savAcct?.openingDate}`);

  // 2. Check all MQB Txn entries - look for the recreated Transaction Bs from Step 1
  // that were ALSO kept as original import entries
  console.log('\n=== MQB Txn entries with creation timestamps ===\n');
  const txns = await prisma.transaction.findMany({
    where: { postings: { some: { accountId: MQB_TXN_ID } } },
    include: { postings: { include: { account: true } } },
    orderBy: { date: 'asc' },
  });

  for (const tx of txns) {
    const txnP = tx.postings.find(p => p.accountId === MQB_TXN_ID)!;
    const otherP = tx.postings.find(p => p.accountId !== MQB_TXN_ID);
    const d = new Date(tx.date).toISOString().slice(0, 10);
    const created = tx.createdAt.toISOString().slice(0, 19);
    const pCreated = txnP.createdAt.toISOString().slice(0, 19);
    console.log(`${d} | ${tx.payee.substring(0, 45).padEnd(45)} | Txn=${String(txnP.amount).padStart(10)} | ${(otherP?.account.name.trim() || '?').padEnd(15)} | txCreated=${created} | pCreated=${pCreated}`);
  }

  // 3. Look for entries from the MQB Txn CSV side that appeared as both
  // an original import AND a recreated Transaction B
  // Recreated Bs would have a very recent createdAt (from the fix script run)
  console.log('\n=== Entries created today (recreated Transaction Bs from fix) ===\n');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const recentTxns = txns.filter(tx => tx.createdAt >= today);
  console.log(`Found ${recentTxns.length} entries created today`);
  for (const tx of recentTxns) {
    const txnP = tx.postings.find(p => p.accountId === MQB_TXN_ID)!;
    const d = new Date(tx.date).toISOString().slice(0, 10);
    console.log(`  ${d} | ${tx.payee.substring(0, 55)} | Txn=${txnP.amount} | created=${tx.createdAt.toISOString()}`);
  }

  // 4. Compare: how many are original imports vs recreated?
  const importDate = new Date('2026-02-17'); // roughly when commit-all-matches.ts was run
  const originals = txns.filter(tx => tx.createdAt < importDate);
  const recreated = txns.filter(tx => tx.createdAt >= importDate);
  console.log(`\nOriginal entries (before 2/17): ${originals.length}`);
  console.log(`Recreated entries (on/after 2/17): ${recreated.length}`);
  console.log(`Total: ${txns.length}`);

  // 5. Sum of recreated entries
  let recreatedSum = 0;
  for (const tx of recreated) {
    const txnP = tx.postings.find(p => p.accountId === MQB_TXN_ID)!;
    recreatedSum += txnP.amount;
  }
  console.log(`Sum of recreated entries: ${recreatedSum.toFixed(2)}`);

  await prisma.$disconnect();
}
run();
