import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasources: { db: { url: 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db' } } });

async function run() {
  const savingsId = 'c95b5aa6-7b11-41db-9a74-5c27f72dcabc';
  const txnId = '69f5e434-cd1f-4754-8a05-f8b3f4d4a410';

  // 1. Check merged Savings↔Txn transfers
  console.log('=== MERGED MQB Savings ↔ MQB Txn transfers (signs vs CSV) ===\n');
  const merged = await prisma.transaction.findMany({
    where: {
      metadata: { contains: 'transferMatched' },
      postings: { some: { accountId: savingsId } },
    },
    include: { postings: { include: { account: true } } },
    orderBy: { date: 'asc' },
  });

  // CSV truth: "From MacBank Txn Acct" = Credit on Savings (+), "To MacBank Txn Acct" = Debit on Savings (-)
  let flippedCount = 0;
  for (const tx of merged) {
    const sp = tx.postings.find(p => p.accountId === savingsId)!;
    const isFromTxn = tx.payee.includes('From MacBank Txn Acct');
    const isToTxn = tx.payee.includes('To MacBank Txn Acct');

    let expected = '';
    let isFlipped = false;
    if (isFromTxn) {
      expected = 'CREDIT (+)';
      isFlipped = sp.amount < 0;
    } else if (isToTxn) {
      expected = 'DEBIT (-)';
      isFlipped = sp.amount > 0;
    }

    if (isFlipped) flippedCount++;
    const d = new Date(tx.date).toISOString().slice(0, 10);
    console.log(`${d} | ${tx.payee.substring(0, 50).padEnd(50)} | DB: ${String(sp.amount).padStart(10)} | CSV expects: ${expected} | ${isFlipped ? '❌ FLIPPED' : '✓ OK'}`);
  }
  console.log(`\nFlipped: ${flippedCount} / ${merged.length}`);

  // 2. Check if "From Glenn Mark Tobiansky" transactions were consumed by wrong merges
  console.log('\n\n=== Glenn Tobiansky transactions in MQB Txn ===');
  const glenn = await prisma.transaction.findMany({
    where: {
      payee: { contains: 'Glenn' },
      postings: { some: { accountId: txnId } },
    },
    include: { postings: { include: { account: true } } },
    orderBy: { date: 'asc' },
  });
  console.log(`Found: ${glenn.length}`);
  for (const tx of glenn) {
    const tp = tx.postings.find(p => p.accountId === txnId);
    const op = tx.postings.find(p => p.accountId !== txnId);
    const d = new Date(tx.date).toISOString().slice(0, 10);
    const merged = tx.metadata?.includes('transferMatched') ? 'MERGED!' : '';
    console.log(`  ${d} | ${tx.payee.substring(0, 55)} | Txn=${tp?.amount} | ${op?.account.name.trim()} | ${merged}`);
  }

  // 3. Check "To MacBank Savings" transactions that should have been matched but weren't
  console.log('\n\n=== Orphaned "To MacBank Savings" / "To linked account" in MQB Txn ===');
  const orphans = await prisma.transaction.findMany({
    where: {
      OR: [
        { payee: { contains: 'To MacBank Savings' } },
        { payee: { contains: 'To linked account' } },
      ],
      postings: { some: { accountId: txnId } },
    },
    include: { postings: { include: { account: true } } },
    orderBy: { date: 'asc' },
  });
  console.log(`Found: ${orphans.length}`);
  for (const tx of orphans) {
    const tp = tx.postings.find(p => p.accountId === txnId);
    const op = tx.postings.find(p => p.accountId !== txnId);
    const d = new Date(tx.date).toISOString().slice(0, 10);
    console.log(`  ${d} | ${tx.payee.substring(0, 55)} | Txn=${tp?.amount} | ${op?.account.name.trim()} | meta: ${tx.metadata?.substring(0, 40) || 'null'}`);
  }

  await prisma.$disconnect();
}
run();
