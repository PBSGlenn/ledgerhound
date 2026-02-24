/**
 * Find unmatched Stripe payout entries in CBA Txn Business.
 * These are CSV-imported "Direct Credit ... STRIPE" entries that weren't
 * merged with corresponding Stripe-imported payout transactions.
 */
import { PrismaClient } from '@prisma/client';

const DB_URL = 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db';
const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

const CBA_TXN_BIZ = 'a8745fd3-853c-4c58-b877-e98a2cf9e2da';
const STRIPE_ACCT = 'a0cc99d2-10d4-4cbc-9ecb-444662c4223a';
const UNCATEGORIZED = '7053ee17-2587-4471-a5c0-56724b019329';

async function main() {
  // 1. Find CBA Txn Business entries that look like Stripe payouts
  const cbaTxns = await prisma.transaction.findMany({
    where: {
      postings: { some: { accountId: CBA_TXN_BIZ } },
      OR: [
        { payee: { contains: 'STRIPE' } },
        { memo: { contains: 'STRIPE' } },
      ],
    },
    include: {
      postings: {
        include: { account: { select: { id: true, name: true } } },
      },
    },
    orderBy: { date: 'asc' },
  });

  console.log(`=== CBA Txn Business - Stripe-related transactions ===`);
  console.log(`Found ${cbaTxns.length} total\n`);

  const unmatched: typeof cbaTxns = [];
  const matched: typeof cbaTxns = [];

  for (const tx of cbaTxns) {
    const hasStripePosting = tx.postings.some(p => p.accountId === STRIPE_ACCT);
    const hasUncategorized = tx.postings.some(p => p.accountId === UNCATEGORIZED);

    if (hasStripePosting) {
      matched.push(tx);
    } else {
      unmatched.push(tx);
    }
  }

  console.log(`Matched (already linked to Stripe account): ${matched.length}`);
  for (const tx of matched) {
    const d = new Date(tx.date).toISOString().slice(0, 10);
    const cbaPosting = tx.postings.find(p => p.accountId === CBA_TXN_BIZ);
    const amt = cbaPosting ? Number(cbaPosting.amount).toFixed(2) : '?';
    console.log(`  ${d} | $${amt} | "${tx.payee}" | memo: "${tx.memo}"`);
  }

  console.log(`\nUnmatched (NOT linked to Stripe account): ${unmatched.length}`);
  for (const tx of unmatched) {
    const d = new Date(tx.date).toISOString().slice(0, 10);
    const cbaPosting = tx.postings.find(p => p.accountId === CBA_TXN_BIZ);
    const amt = cbaPosting ? Number(cbaPosting.amount).toFixed(2) : '?';
    const otherAccounts = tx.postings
      .filter(p => p.accountId !== CBA_TXN_BIZ)
      .map(p => p.account.name.trim())
      .join(', ');
    console.log(`  ${d} | $${amt} | "${tx.payee}" | memo: "${tx.memo}" | other: ${otherAccounts}`);
  }

  // 2. Find Stripe account payout transactions that might be the other half
  console.log(`\n=== Stripe Account - Payout transactions ===`);
  const stripeTxns = await prisma.transaction.findMany({
    where: {
      postings: { some: { accountId: STRIPE_ACCT } },
      OR: [
        { memo: { contains: 'payout' } },
        { memo: { contains: 'Payout' } },
        { payee: { contains: 'Payout' } },
        { payee: { contains: 'payout' } },
      ],
    },
    include: {
      postings: {
        include: { account: { select: { id: true, name: true } } },
      },
    },
    orderBy: { date: 'asc' },
  });

  console.log(`Found ${stripeTxns.length} Stripe payout transactions\n`);

  const stripeUnmatched: typeof stripeTxns = [];
  const stripeMatched: typeof stripeTxns = [];

  for (const tx of stripeTxns) {
    const hasCbaPosting = tx.postings.some(p => p.accountId === CBA_TXN_BIZ);
    if (hasCbaPosting) {
      stripeMatched.push(tx);
    } else {
      stripeUnmatched.push(tx);
    }
  }

  console.log(`Already matched to CBA Txn Business: ${stripeMatched.length}`);
  console.log(`NOT matched to CBA Txn Business: ${stripeUnmatched.length}\n`);

  for (const tx of stripeUnmatched) {
    const d = new Date(tx.date).toISOString().slice(0, 10);
    const stripePosting = tx.postings.find(p => p.accountId === STRIPE_ACCT);
    const amt = stripePosting ? Number(stripePosting.amount).toFixed(2) : '?';
    const otherAccounts = tx.postings
      .filter(p => p.accountId !== STRIPE_ACCT)
      .map(p => `${p.account.name.trim()} ($${Number(p.amount).toFixed(2)})`)
      .join(', ');
    console.log(`  ${d} | Stripe: $${amt} | "${tx.payee}" | memo: "${tx.memo}" | other: ${otherAccounts}`);
  }

  // 3. Try to find potential matches
  if (unmatched.length > 0 && stripeUnmatched.length > 0) {
    console.log(`\n=== Potential Matches ===`);
    for (const cbaTx of unmatched) {
      const cbaPosting = cbaTx.postings.find(p => p.accountId === CBA_TXN_BIZ);
      const cbaAmt = cbaPosting ? Math.abs(Number(cbaPosting.amount)) : 0;
      const cbaDate = new Date(cbaTx.date);

      for (const stTx of stripeUnmatched) {
        const stPosting = stTx.postings.find(p => p.accountId === STRIPE_ACCT);
        const stAmt = stPosting ? Math.abs(Number(stPosting.amount)) : 0;
        const stDate = new Date(stTx.date);

        const amtMatch = Math.abs(cbaAmt - stAmt) < 0.01;
        const daysDiff = Math.abs(cbaDate.getTime() - stDate.getTime()) / (1000 * 60 * 60 * 24);

        if (amtMatch && daysDiff <= 3) {
          const d1 = cbaDate.toISOString().slice(0, 10);
          const d2 = stDate.toISOString().slice(0, 10);
          console.log(`  MATCH: CBA ${d1} $${cbaAmt.toFixed(2)} "${cbaTx.payee}" ↔ Stripe ${d2} $${stAmt.toFixed(2)} "${stTx.payee}"`);
          console.log(`         CBA tx: ${cbaTx.id}`);
          console.log(`         Stripe tx: ${stTx.id}`);
        }
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
