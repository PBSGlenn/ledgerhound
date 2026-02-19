import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ datasources: { db: { url: 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db' } } });

const MQB_TXN_ID = '69f5e434-cd1f-4754-8a05-f8b3f4d4a410';
const MQB_SAVINGS_ID = 'c95b5aa6-7b11-41db-9a74-5c27f72dcabc';
const UNCAT_ID = '7053ee17-2587-4471-a5c0-56724b019329';

async function run() {
  // 1. Check Transaction As for extra Uncategorized postings
  // The first unmerge (previous session) created Uncategorized postings on Transaction As.
  // When commit-all-matches.ts re-merged, those weren't removed.
  // Then fix-mqb-txn.ts added MORE Uncategorized postings.
  console.log('=== Transactions with 3+ postings (leftover from unmerge cycles) ===\n');

  // Check all transactions touching MQB Savings, CBA MC, CBA Txn Business
  const allTxns = await prisma.transaction.findMany({
    include: { postings: { include: { account: true } } },
  });

  let extraPostings = 0;
  let extraSum = 0;
  const problematic: any[] = [];

  for (const tx of allTxns) {
    if (tx.postings.length > 2) {
      const d = new Date(tx.date).toISOString().slice(0, 10);
      const uncatPostings = tx.postings.filter(p => p.accountId === UNCAT_ID);
      const realPostings = tx.postings.filter(p => p.accountId !== UNCAT_ID);
      const sum = tx.postings.reduce((s, p) => s + p.amount, 0);

      console.log(`TX: ${tx.id} | ${d} | ${tx.payee.substring(0, 50)} | ${tx.postings.length} postings | sum=${sum.toFixed(2)}`);
      for (const p of tx.postings) {
        console.log(`  ${p.account.name.trim().padEnd(20)} = ${String(p.amount).padStart(12)} | created: ${p.createdAt.toISOString().slice(0, 19)}`);
      }

      if (uncatPostings.length > 1) {
        extraPostings += uncatPostings.length - 1;
        // The extra ones are causing the balance to be off
        const extraUncat = uncatPostings.slice(1);
        for (const p of extraUncat) {
          extraSum += p.amount;
        }
        problematic.push(tx);
      }
      console.log();
    }
  }

  console.log(`\nTotal transactions with 3+ postings: ${problematic.length}`);
  console.log(`Extra Uncategorized postings: ${extraPostings}`);
  console.log(`Sum of extra Uncategorized postings: ${extraSum.toFixed(2)}`);

  // 2. Check the MQB Txn balance contribution from extra postings
  console.log('\n=== Impact on MQB accounts ===\n');

  // Check MQB Txn transactions for extra postings
  const txnTxns = await prisma.transaction.findMany({
    where: { postings: { some: { accountId: MQB_TXN_ID } } },
    include: { postings: { include: { account: true } } },
  });

  let txnExtraSum = 0;
  for (const tx of txnTxns) {
    const uncatPostings = tx.postings.filter(p => p.accountId === UNCAT_ID);
    if (uncatPostings.length > 1) {
      for (const p of uncatPostings.slice(1)) {
        txnExtraSum += p.amount;
      }
    }
  }
  console.log(`Extra Uncategorized sum on MQB Txn transactions: ${txnExtraSum.toFixed(2)}`);

  // Check MQB Savings transactions
  const savTxns = await prisma.transaction.findMany({
    where: { postings: { some: { accountId: MQB_SAVINGS_ID } } },
    include: { postings: { include: { account: true } } },
  });

  let savExtraSum = 0;
  for (const tx of savTxns) {
    const uncatPostings = tx.postings.filter(p => p.accountId === UNCAT_ID);
    if (uncatPostings.length > 1) {
      for (const p of uncatPostings.slice(1)) {
        savExtraSum += p.amount;
      }
    }
  }
  console.log(`Extra Uncategorized sum on MQB Savings transactions: ${savExtraSum.toFixed(2)}`);

  // 3. Also check: does every Transaction A have a real posting that sums correctly?
  console.log('\n=== Transactions where postings don\'t sum to zero ===\n');
  let unbalanced = 0;
  for (const tx of allTxns) {
    const sum = tx.postings.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(sum) > 0.01) {
      const d = new Date(tx.date).toISOString().slice(0, 10);
      console.log(`UNBALANCED: ${d} | ${tx.payee.substring(0, 50)} | sum=${sum.toFixed(2)} | ${tx.postings.length} postings`);
      for (const p of tx.postings) {
        console.log(`  ${p.account.name.trim().padEnd(20)} = ${p.amount}`);
      }
      console.log();
      unbalanced++;
    }
  }
  console.log(`Unbalanced transactions: ${unbalanced}`);

  await prisma.$disconnect();
}
run();
