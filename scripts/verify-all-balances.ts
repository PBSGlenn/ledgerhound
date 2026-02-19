/**
 * Verify all account balances after transfer matching.
 * Checks MQB Txn, MQB Savings, CBA MC, CBA Txn Business, CBA Access.
 */
import { PrismaClient } from '@prisma/client';

const DB_URL = 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db';

const prisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
});

async function main() {
  console.log('=== BALANCE VERIFICATION ===\n');

  const accounts = await prisma.account.findMany({
    where: { kind: 'TRANSFER', archived: false },
    orderBy: { name: 'asc' },
  });

  for (const acct of accounts) {
    const postings = await prisma.posting.findMany({ where: { accountId: acct.id } });
    const sum = postings.reduce((s, p) => s + p.amount, 0);
    const balance = (acct.openingBalance || 0) + sum;
    const mergedCount = await prisma.transaction.count({
      where: {
        metadata: { contains: 'transferMatched' },
        postings: { some: { accountId: acct.id } },
      },
    });

    console.log(`${acct.name.trim().padEnd(25)} | Balance: ${balance.toFixed(2).padStart(12)} | Postings: ${String(postings.length).padStart(4)} | Merged: ${String(mergedCount).padStart(3)}`);
  }

  // Specific CSV-known balances
  console.log('\n=== CSV EXPECTED VALUES ===\n');

  const mqbTxnId = '69f5e434-cd1f-4754-8a05-f8b3f4d4a410';
  const mqbSavId = 'c95b5aa6-7b11-41db-9a74-5c27f72dcabc';

  const txnPostings = await prisma.posting.findMany({ where: { accountId: mqbTxnId } });
  const txnSum = txnPostings.reduce((s, p) => s + p.amount, 0);
  console.log(`MQB Txn:     ${txnSum.toFixed(2)} (CSV expects: $513.88)     ${Math.abs(txnSum - 513.88) < 0.01 ? 'PASS' : 'FAIL'}`);

  const savPostings = await prisma.posting.findMany({ where: { accountId: mqbSavId } });
  const savSum = savPostings.reduce((s, p) => s + p.amount, 0);
  console.log(`MQB Savings: ${savSum.toFixed(2)} (CSV expects: $78,640.77)  ${Math.abs(savSum - 78640.77) < 0.01 ? 'PASS' : 'FAIL'}`);

  // Check double-entry integrity: sum of all postings should be 0
  console.log('\n=== DOUBLE-ENTRY INTEGRITY ===\n');
  const allPostings = await prisma.posting.findMany();
  const totalSum = allPostings.reduce((s, p) => s + p.amount, 0);
  console.log(`Sum of ALL postings: ${totalSum.toFixed(2)} (should be 0.00)  ${Math.abs(totalSum) < 0.01 ? 'PASS' : 'FAIL'}`);

  // Check for any unbalanced transactions
  const txns = await prisma.transaction.findMany({ include: { postings: true } });
  let unbalanced = 0;
  for (const tx of txns) {
    const sum = tx.postings.reduce((s, p) => s + p.amount, 0);
    if (Math.abs(sum) > 0.01) {
      unbalanced++;
      const d = new Date(tx.date).toISOString().slice(0, 10);
      console.log(`  UNBALANCED: ${d} "${tx.payee.substring(0, 50)}" sum=${sum.toFixed(2)}`);
    }
  }
  console.log(`Unbalanced transactions: ${unbalanced} / ${txns.length}  ${unbalanced === 0 ? 'PASS' : 'FAIL'}`);

  console.log('\n=== DONE ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());
