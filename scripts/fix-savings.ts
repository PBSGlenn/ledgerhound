/**
 * Fix MQB Savings Import Signs
 *
 * The MQB Savings CSV was also imported with Debit/Credit columns swapped.
 * fix-mqb-txn.ts Step 2 fixed the merged transfer entries (by negating Transaction As),
 * but standalone entries (Payment interest, CBA Cards receipts) still have wrong signs.
 *
 * Fixes:
 * 1. Negate 17 entries with inverted signs (identified by CSV comparison)
 * 2. Create missing +20000 transfer entry on 2025-01-12 (Savings side)
 *
 * Usage: npx tsx scripts/fix-savings.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';

const DB_URL = 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db';
const DRY_RUN = process.argv.includes('--dry-run');

const prisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
});

const MQB_SAVINGS_ID = 'c95b5aa6-7b11-41db-9a74-5c27f72dcabc';
const UNCAT_ID = '7053ee17-2587-4471-a5c0-56724b019329';

// Entries to negate: date (DB/UTC), payee substring, wrong DB amount → correct CSV amount
const TO_NEGATE = [
  // 12 Payment (interest) entries - DB has negative, should be positive
  { date: '2025-01-30', payee: 'Payment', wrongAmt: -227.92 },
  { date: '2025-02-27', payee: 'Payment', wrongAmt: -398.59 },
  { date: '2025-03-30', payee: 'Payment', wrongAmt: -469.47 },
  { date: '2025-04-29', payee: 'Payment', wrongAmt: -454.01 },
  { date: '2025-05-30', payee: 'Payment', wrongAmt: -434.99 },
  { date: '2025-06-29', payee: 'Payment', wrongAmt: -392.4 },
  { date: '2025-07-30', payee: 'Payment', wrongAmt: -388.3 },
  { date: '2025-08-30', payee: 'Payment', wrongAmt: -365.3 },
  { date: '2025-09-29', payee: 'Payment', wrongAmt: -336.5 },
  { date: '2025-10-30', payee: 'Payment', wrongAmt: -330.98 },
  { date: '2025-11-29', payee: 'Payment', wrongAmt: -302.44 },
  { date: '2025-12-30', payee: 'Payment', wrongAmt: -297.9 },
  { date: '2026-01-30', payee: 'Payment', wrongAmt: -282.96 },
  // 2 CBA entries on Oct 23 (DB +6658.5, should be -6658.5)
  { date: '2025-10-23', payee: 'Commonwealth Bank of Australia Cards Receipt', wrongAmt: 6658.5 },
  { date: '2025-10-23', payee: 'To MacBank Txn Acct', wrongAmt: 6658.5 },
  // 2 more CBA Cards from Savings (wrong sign)
  { date: '2025-12-26', payee: 'Commonwealth Bank of Australia Cards Receipt', wrongAmt: 5277.37 },
  { date: '2026-01-23', payee: 'Commonwealth Bank of Australia Cards Receipt', wrongAmt: 3045.34 },
];

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== FIXING MQB SAVINGS ===');

  // =============================================
  // FIX 1: Negate entries with inverted signs
  // =============================================
  console.log('\n--- FIX 1: Negate inverted entries ---\n');

  let fixed = 0;
  for (const entry of TO_NEGATE) {
    const dateStart = new Date(entry.date);
    const dateEnd = new Date(dateStart.getTime() + 86400000);

    const txns = await prisma.transaction.findMany({
      where: {
        date: { gte: dateStart, lt: dateEnd },
        payee: { contains: entry.payee },
        postings: { some: { accountId: MQB_SAVINGS_ID } },
      },
      include: { postings: true },
    });

    // Find the specific one with the wrong amount
    const tx = txns.find(t => {
      const p = t.postings.find(p => p.accountId === MQB_SAVINGS_ID);
      return p && Math.abs(p.amount - entry.wrongAmt) < 0.01;
    });

    if (!tx) {
      console.log(`  SKIP: Not found: ${entry.date} "${entry.payee}" amt=${entry.wrongAmt}`);
      continue;
    }

    const savP = tx.postings.find(p => p.accountId === MQB_SAVINGS_ID)!;
    const otherP = tx.postings.find(p => p.accountId !== MQB_SAVINGS_ID)!;

    console.log(`  Negate: ${entry.date} "${tx.payee.substring(0, 50)}" | Sav: ${savP.amount} → ${-savP.amount}`);

    if (!DRY_RUN) {
      await prisma.$transaction(async (dbTx: any) => {
        await dbTx.posting.update({
          where: { id: savP.id },
          data: { amount: -savP.amount },
        });
        await dbTx.posting.update({
          where: { id: otherP.id },
          data: { amount: -otherP.amount },
        });
      });
    }
    fixed++;
  }

  console.log(`Fixed: ${fixed}`);

  // =============================================
  // FIX 2: Create missing transfer entry (Savings side)
  // CSV: 2025-01-16 (AEST) From MacBank Txn Acct +20000
  // DB date: 2025-01-12 (already created MQB Txn side)
  // =============================================
  console.log('\n--- FIX 2: Create missing Savings transfer entry ---\n');

  // Find the MQB Txn transaction we created in fix-balance.ts
  const txnTx = await prisma.transaction.findMany({
    where: {
      date: { gte: new Date('2025-01-12'), lt: new Date('2025-01-13') },
      payee: { contains: 'To MacBank Savings' },
    },
    include: { postings: true },
  });

  if (txnTx.length > 0) {
    // Check if we need a separate Savings entry or if we can merge later
    // For now, create a standalone Savings entry
    const existingSav = await prisma.transaction.findMany({
      where: {
        date: { gte: new Date('2025-01-12'), lt: new Date('2025-01-13') },
        payee: { contains: 'From MacBank Txn Acct' },
        postings: { some: { accountId: MQB_SAVINGS_ID } },
      },
    });

    if (existingSav.length > 0) {
      console.log('  SKIP: Savings entry already exists');
    } else {
      console.log('  Create: 2025-01-12 "From MacBank Txn Acct - Internal Transfer" Sav=+20000');

      if (!DRY_RUN) {
        const newTx = await prisma.transaction.create({
          data: {
            date: new Date('2025-01-12'),
            payee: 'From MacBank Txn Acct - Internal Transfer',
            status: 'NORMAL',
          },
        });

        await prisma.posting.create({
          data: {
            transactionId: newTx.id,
            accountId: MQB_SAVINGS_ID,
            amount: 20000,
            isBusiness: false,
            cleared: false,
          },
        });

        await prisma.posting.create({
          data: {
            transactionId: newTx.id,
            accountId: UNCAT_ID,
            amount: -20000,
            isBusiness: false,
            cleared: false,
          },
        });
      }
    }
  } else {
    console.log('  NOTE: MQB Txn side entry not found on 2025-01-12');
  }

  // =============================================
  // VERIFICATION
  // =============================================
  console.log('\n--- VERIFICATION ---\n');

  if (!DRY_RUN) {
    const savPostings = await prisma.posting.findMany({ where: { accountId: MQB_SAVINGS_ID } });
    const savSum = savPostings.reduce((s, p) => s + p.amount, 0);
    console.log(`MQB Savings balance: ${savSum.toFixed(2)} (CSV expects: $78,640.77)`);
    console.log(`Match: ${Math.abs(savSum - 78640.77) < 0.01 ? '✓ YES' : '❌ NO'}`);

    const txnPostings = await prisma.posting.findMany({ where: { accountId: '69f5e434-cd1f-4754-8a05-f8b3f4d4a410' } });
    const txnSum = txnPostings.reduce((s, p) => s + p.amount, 0);
    console.log(`\nMQB Txn balance:     ${txnSum.toFixed(2)} (CSV expects: $513.88)`);
    console.log(`Match: ${Math.abs(txnSum - 513.88) < 0.01 ? '✓ YES' : '❌ NO'}`);
  } else {
    console.log('(Dry run — no verification)');
  }

  console.log('\n=== DONE ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());
