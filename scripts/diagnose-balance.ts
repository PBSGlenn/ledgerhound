import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasources: { db: { url: 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db' } } });

const MQB_TXN_ID = '69f5e434-cd1f-4754-8a05-f8b3f4d4a410';
const MQB_SAVINGS_ID = 'c95b5aa6-7b11-41db-9a74-5c27f72dcabc';

async function run() {
  // 1. List ALL MQB Txn transactions with postings
  console.log('=== ALL MQB Txn transactions ===\n');
  const txns = await prisma.transaction.findMany({
    where: { postings: { some: { accountId: MQB_TXN_ID } } },
    include: { postings: { include: { account: true } } },
    orderBy: { date: 'asc' },
  });

  let runningBalance = 0;
  for (const tx of txns) {
    const txnP = tx.postings.find(p => p.accountId === MQB_TXN_ID)!;
    const otherP = tx.postings.find(p => p.accountId !== MQB_TXN_ID);
    const d = new Date(tx.date).toISOString().slice(0, 10);
    runningBalance += txnP.amount;
    console.log(`${d} | ${tx.payee.substring(0, 55).padEnd(55)} | Txn=${String(txnP.amount).padStart(10)} | ${(otherP?.account.name.trim() || '?').padEnd(20)} | bal=${runningBalance.toFixed(2)}`);
  }
  console.log(`\nTotal: ${txns.length} transactions, Balance: ${runningBalance.toFixed(2)}`);

  // 2. Check for any duplicate payees on same date
  console.log('\n=== Potential duplicates (same date + similar payee) ===\n');
  const byDatePayee = new Map<string, typeof txns>();
  for (const tx of txns) {
    const d = new Date(tx.date).toISOString().slice(0, 10);
    const key = `${d}|${tx.payee.substring(0, 30)}`;
    if (!byDatePayee.has(key)) byDatePayee.set(key, []);
    byDatePayee.get(key)!.push(tx);
  }
  for (const [key, group] of byDatePayee) {
    if (group.length > 1) {
      console.log(`DUPLICATE: ${key} (${group.length} entries)`);
      for (const tx of group) {
        const txnP = tx.postings.find(p => p.accountId === MQB_TXN_ID)!;
        console.log(`  ID: ${tx.id} | Txn=${txnP.amount} | meta=${tx.metadata?.substring(0, 40) || 'null'}`);
      }
    }
  }

  // 3. MQB Savings balance check
  console.log('\n=== MQB Savings balance ===\n');
  const savPostings = await prisma.posting.findMany({ where: { accountId: MQB_SAVINGS_ID } });
  const savSum = savPostings.reduce((s, p) => s + p.amount, 0);
  console.log(`MQB Savings balance: ${savSum.toFixed(2)} (expected: $78,640.77)`);
  console.log(`Difference: ${(savSum - 78640.77).toFixed(2)}`);

  // 4. MQB Txn balance detail
  console.log('\n=== MQB Txn balance ===');
  console.log(`MQB Txn balance: ${runningBalance.toFixed(2)} (expected: $513.88)`);
  console.log(`Difference: ${(runningBalance - 513.88).toFixed(2)}`);

  await prisma.$disconnect();
}
run();
