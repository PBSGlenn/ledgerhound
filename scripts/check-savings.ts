import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasources: { db: { url: 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db' } } });

async function run() {
  const savingsId = 'c95b5aa6-7b11-41db-9a74-5c27f72dcabc';

  // All transactions touching MQB Savings, sorted by date
  const txns = await prisma.transaction.findMany({
    where: { postings: { some: { accountId: savingsId } } },
    include: { postings: { include: { account: true } } },
    orderBy: { date: 'asc' },
    take: 30,
  });

  console.log('MQB Savings Register (first 30 transactions):');
  console.log('DATE       | PAYEE                                          | SAVINGS AMT | OTHER ACCT      | OTHER AMT | MERGED?');
  console.log('-'.repeat(130));

  for (const tx of txns) {
    const sp = tx.postings.find(p => p.accountId === savingsId);
    const op = tx.postings.find(p => p.accountId !== savingsId);
    const d = new Date(tx.date).toISOString().slice(0, 10);
    const merged = tx.metadata?.includes('transferMatched') ? 'YES' : '';
    const payee = tx.payee.substring(0, 48).padEnd(48);
    const savAmt = String(sp!.amount).padStart(11);
    const otherName = (op?.account.name.trim() || '?').padEnd(15);
    const otherAmt = String(op?.amount || '?');
    console.log(`${d} | ${payee} | ${savAmt} | ${otherName} | ${otherAmt.padStart(9)} | ${merged}`);
  }

  await prisma.$disconnect();
}
run();
