import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasources: { db: { url: 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db' } } });

async function run() {
  const txnId = '69f5e434-cd1f-4754-8a05-f8b3f4d4a410';

  // Check MQB Txn entries that were never merged
  console.log('=== MQB Txn unmerged entries (original import signs) ===\n');
  console.log('CSV Reference:');
  console.log('  CBA Cards Receipt 22/01 = Debit $6500 (money OUT, should be negative)');
  console.log('  From Savings 22/01 = Credit $6500 (money IN, should be positive)');
  console.log('  Glenn 13/01 = Credit $20000 (money IN, should be positive)');
  console.log('  Payment 31/01 = Credit $3.16 (interest, should be positive)\n');

  const txns = await prisma.transaction.findMany({
    where: {
      postings: { some: { accountId: txnId } },
      NOT: { metadata: { contains: 'transferMatched' } },
    },
    include: { postings: { include: { account: true } } },
    orderBy: { date: 'asc' },
    take: 30,
  });

  for (const tx of txns) {
    const tp = tx.postings.find(p => p.accountId === txnId);
    const op = tx.postings.find(p => p.accountId !== txnId);
    const d = new Date(tx.date).toISOString().slice(0, 10);
    const payee = tx.payee.substring(0, 55).padEnd(55);
    const amt = String(tp!.amount).padStart(10);
    const other = op?.account.name.trim().padEnd(15) || '?'.padEnd(15);
    console.log(`${d} | ${payee} | Txn=${amt} | ${other}`);
  }

  // Summary: count positives vs negatives
  const allTxn = await prisma.posting.findMany({ where: { accountId: txnId } });
  const pos = allTxn.filter(p => p.amount > 0).length;
  const neg = allTxn.filter(p => p.amount < 0).length;
  console.log(`\nTotal MQB Txn postings: ${allTxn.length} (${pos} positive, ${neg} negative)`);

  // Check balance
  const sum = allTxn.reduce((s, p) => s + p.amount, 0);
  console.log(`Sum of all MQB Txn postings: ${sum.toFixed(2)}`);
  console.log(`CSV final balance (31 Jan 2026): $513.88`);

  await prisma.$disconnect();
}
run();
