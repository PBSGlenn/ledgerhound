/**
 * Fix MQB Txn Balance Discrepancies
 *
 * After fix-mqb-txn.ts, the balance is $4,513.88 instead of $513.88 ($4,000 off).
 *
 * Root cause: 4 entries from CBA Txn Business ↔ MQB Txn merges were recreated
 * as Transaction Bs with CBA-side payees and wrong signs. And 1 entry is missing.
 *
 * Fixes:
 * 1. Negate 4 "Transfer To MacBank Txn Account" entries and update payees
 *    to match the original CSV ("From Glenn Tobiansky - Income/Salary")
 * 2. Create the missing "To MacBank Savings" = -$20,000 entry (2025-01-15 UTC)
 *
 * Usage: npx tsx scripts/fix-balance.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';

const DB_URL = 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db';
const DRY_RUN = process.argv.includes('--dry-run');

const prisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
});

const MQB_TXN_ID = '69f5e434-cd1f-4754-8a05-f8b3f4d4a410';
const UNCAT_ID = '7053ee17-2587-4471-a5c0-56724b019329';

// The 4 wrong entries: CBA Txn Business payees with inverted signs
const FIXES = [
  {
    dbPayeeContains: 'Transfer To MacBank Txn Account NetBank Incom',
    dbDate: '2025-06-23',
    dbAmount: -2000,
    csvPayee: 'From Glenn Tobiansky - Income',
    csvAmount: 2000,
  },
  {
    dbPayeeContains: 'Transfer To MacBank Txn Account CommBank App Salar',
    dbDate: '2025-08-20',
    dbAmount: -3000,
    csvPayee: 'From Glenn Tobiansky - Salary',
    csvAmount: 3000,
  },
  {
    dbPayeeContains: 'Transfer To MacBank Txn Account CommBank App Salar',
    dbDate: '2025-10-23',
    dbAmount: -1000,
    csvPayee: 'From Glenn Tobiansky - Salary',
    csvAmount: 1000,
  },
  {
    dbPayeeContains: 'Transfer To MacBank Txn Account CommBank App Salar',
    dbDate: '2026-01-23',
    dbAmount: -2000,
    csvPayee: 'From Glenn Tobiansky - Salary',
    csvAmount: 2000,
  },
];

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== FIXING MQB TXN BALANCE ===');

  // =============================================
  // FIX 1: Negate and rename 4 wrong entries
  // =============================================
  console.log('\n--- FIX 1: Correct 4 wrong entries ---\n');

  for (const fix of FIXES) {
    const txns = await prisma.transaction.findMany({
      where: {
        payee: { contains: fix.dbPayeeContains },
        postings: { some: { accountId: MQB_TXN_ID } },
      },
      include: { postings: true },
      orderBy: { date: 'asc' },
    });

    // Find the specific one by date and amount
    const tx = txns.find(t => {
      const d = new Date(t.date).toISOString().slice(0, 10);
      const p = t.postings.find(p => p.accountId === MQB_TXN_ID);
      return d === fix.dbDate && p && Math.abs(p.amount - fix.dbAmount) < 0.01;
    });

    if (!tx) {
      console.log(`  SKIP: Not found: ${fix.dbDate} "${fix.dbPayeeContains}" amt=${fix.dbAmount}`);
      continue;
    }

    const txnP = tx.postings.find(p => p.accountId === MQB_TXN_ID)!;
    const otherP = tx.postings.find(p => p.accountId !== MQB_TXN_ID)!;

    console.log(`  Fix: ${fix.dbDate} "${tx.payee.substring(0, 55)}"`);
    console.log(`    Payee: "${tx.payee.substring(0, 40)}" → "${fix.csvPayee}"`);
    console.log(`    Txn:   ${txnP.amount} → ${fix.csvAmount}`);
    console.log(`    Other: ${otherP.amount} → ${-fix.csvAmount}`);

    if (!DRY_RUN) {
      await prisma.$transaction(async (dbTx: any) => {
        await dbTx.transaction.update({
          where: { id: tx.id },
          data: { payee: fix.csvPayee },
        });
        await dbTx.posting.update({
          where: { id: txnP.id },
          data: { amount: fix.csvAmount },
        });
        await dbTx.posting.update({
          where: { id: otherP.id },
          data: { amount: -fix.csvAmount },
        });
      });
    }
  }

  // =============================================
  // FIX 2: Create missing "To MacBank Savings" entry
  // CSV: 2025-01-16 (AEST) = 2025-01-15 (UTC), Debit $20,000
  // =============================================
  console.log('\n--- FIX 2: Create missing transfer entry ---\n');

  // CSV has 5 entries of -20000. DB has only 4.
  // DB dates are UTC (1 day before AEST CSV dates).
  // CSV: 13,14,15,16,21 Jan → DB should have: 12,13,14,15,20 Jan
  // DB actually has: 13,14,15,20 → missing 2025-01-12
  const all20k = await prisma.transaction.findMany({
    where: {
      postings: { some: { accountId: MQB_TXN_ID, amount: -20000 } },
    },
    include: { postings: true },
    orderBy: { date: 'asc' },
  });

  console.log(`  Total -20000 MQB Txn entries: ${all20k.length} (CSV expects 5)`);
  for (const t of all20k) {
    const d = new Date(t.date).toISOString().slice(0, 10);
    console.log(`    ${d} | ${t.payee.substring(0, 50)}`);
  }

  if (all20k.length >= 5) {
    console.log('  SKIP: Already have enough entries');
  } else {
    console.log('  Create: 2025-01-12 "To MacBank Savings - Internal Transfer" Txn=-20000');

    if (!DRY_RUN) {
      const newTx = await prisma.transaction.create({
        data: {
          date: new Date('2025-01-12'),
          payee: 'To MacBank Savings - Internal Transfer Receipt number: ON0000130807819',
          status: 'NORMAL',
        },
      });

      await prisma.posting.create({
        data: {
          transactionId: newTx.id,
          accountId: MQB_TXN_ID,
          amount: -20000,
          isBusiness: false,
          cleared: false,
        },
      });

      await prisma.posting.create({
        data: {
          transactionId: newTx.id,
          accountId: UNCAT_ID,
          amount: 20000,
          isBusiness: false,
          cleared: false,
        },
      });
    }
  }

  // =============================================
  // VERIFICATION
  // =============================================
  console.log('\n--- VERIFICATION ---\n');

  if (!DRY_RUN) {
    const txnPostings = await prisma.posting.findMany({ where: { accountId: MQB_TXN_ID } });
    const txnSum = txnPostings.reduce((s, p) => s + p.amount, 0);
    console.log(`MQB Txn balance:     ${txnSum.toFixed(2)} (CSV expects: $513.88)`);
    console.log(`Match: ${Math.abs(txnSum - 513.88) < 0.01 ? '✓ YES' : '❌ NO'}`);

    const savPostings = await prisma.posting.findMany({ where: { accountId: 'c95b5aa6-7b11-41db-9a74-5c27f72dcabc' } });
    const savSum = savPostings.reduce((s, p) => s + p.amount, 0);
    console.log(`\nMQB Savings balance: ${savSum.toFixed(2)} (CSV expects: $78,640.77)`);
  } else {
    console.log('(Dry run — no verification)');
  }

  console.log('\n=== DONE ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());
