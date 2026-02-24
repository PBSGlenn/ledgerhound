/**
 * Fix duplicate Stripe payout entries in CBA Txn Business.
 *
 * Two cases:
 * 1. DUPLICATES (31): "Direct Credit STRIPE" entries that have matching
 *    already-merged Stripe payout transactions → DELETE these
 * 2. ORPHANS (5, June 2025): "Direct Credit STRIPE" entries with no
 *    Stripe-side match → CONVERT to CBA Txn Business ↔ Stripe transfers
 */
import { PrismaClient } from '@prisma/client';

const DB_URL = 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db';
const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
const DRY_RUN = process.argv.includes('--dry-run');

const CBA_TXN_BIZ = 'a8745fd3-853c-4c58-b877-e98a2cf9e2da';
const STRIPE_ACCT = 'a0cc99d2-10d4-4cbc-9ecb-444662c4223a';
const UNCATEGORIZED = '7053ee17-2587-4471-a5c0-56724b019329';

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== FIXING STRIPE PAYOUT DUPLICATES ===');

  // Get all unmatched "Direct Credit STRIPE" entries
  const unmatched = await prisma.transaction.findMany({
    where: {
      postings: { some: { accountId: CBA_TXN_BIZ } },
      payee: { startsWith: 'Direct Credit' },
      OR: [
        { payee: { contains: 'STRIPE' } },
      ],
    },
    include: {
      postings: true,
    },
    orderBy: { date: 'asc' },
  });

  // Only keep ones that are NOT already linked to Stripe (i.e., the duplicates)
  const unmatchedStripe = unmatched.filter(tx =>
    !tx.postings.some(p => p.accountId === STRIPE_ACCT) &&
    tx.postings.some(p => p.accountId === UNCATEGORIZED)
  );

  console.log(`Found ${unmatchedStripe.length} unmatched "Direct Credit STRIPE" entries\n`);

  // Get already-matched Stripe payouts for comparison
  const matched = await prisma.transaction.findMany({
    where: {
      AND: [
        { postings: { some: { accountId: STRIPE_ACCT } } },
        { postings: { some: { accountId: CBA_TXN_BIZ } } },
      ],
      OR: [
        { memo: { contains: 'payout' } },
        { memo: { contains: 'Payout' } },
      ],
    },
    include: { postings: true },
    orderBy: { date: 'asc' },
  });

  let deleted = 0;
  let converted = 0;
  let skipped = 0;

  for (const tx of unmatchedStripe) {
    const cbaPosting = tx.postings.find(p => p.accountId === CBA_TXN_BIZ);
    const uncatPosting = tx.postings.find(p => p.accountId === UNCATEGORIZED);
    const amt = cbaPosting ? Math.abs(Number(cbaPosting.amount)) : 0;
    const d = new Date(tx.date).toISOString().slice(0, 10);

    // Check if there's an already-matched transaction with same date and amount
    const matchedCounterpart = matched.find(m => {
      const mDate = new Date(m.date).toISOString().slice(0, 10);
      const mPosting = m.postings.find(p => p.accountId === CBA_TXN_BIZ);
      const mAmt = mPosting ? Math.abs(Number(mPosting.amount)) : 0;
      return mDate === d && Math.abs(mAmt - amt) < 0.01;
    });

    if (matchedCounterpart) {
      // Case 1: DUPLICATE — delete it
      console.log(`  DELETE: ${d} $${amt.toFixed(2)} "${tx.payee}" (dup of merged ${matchedCounterpart.id})`);
      if (!DRY_RUN) {
        // Delete postings first, then transaction
        await prisma.posting.deleteMany({ where: { transactionId: tx.id } });
        await prisma.transaction.delete({ where: { id: tx.id } });
      }
      deleted++;
    } else {
      // Case 2: ORPHAN — convert Uncategorized posting to Stripe account
      console.log(`  CONVERT: ${d} $${amt.toFixed(2)} "${tx.payee}" → transfer to Stripe`);
      if (!DRY_RUN && uncatPosting) {
        await prisma.posting.update({
          where: { id: uncatPosting.id },
          data: { accountId: STRIPE_ACCT },
        });
        await prisma.transaction.update({
          where: { id: tx.id },
          data: {
            payee: 'STRIPE PAYOUT',
            memo: 'Stripe payout',
          },
        });
      }
      converted++;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Deleted duplicates: ${deleted}`);
  console.log(`Converted to transfers: ${converted}`);
  console.log(`Skipped: ${skipped}`);
  if (DRY_RUN) console.log('(Dry run — no changes made)');
}

main().catch(console.error).finally(() => prisma.$disconnect());
