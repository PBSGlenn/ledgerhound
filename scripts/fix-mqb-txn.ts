/**
 * Fix MQB Txn Import Signs
 *
 * The MQB Txn CSV was imported with Debit/Credit columns swapped,
 * causing all MQB Txn posting amounts to have inverted signs.
 * The transfer matching then corrupted the other-side postings too.
 *
 * This script:
 * 1. Unmerges all transfers touching MQB Txn
 * 2. Negates the corrupted postings on the kept Transaction As
 * 3. Negates all MQB Txn postings (fixing the original import)
 * 4. Deletes stuck duplicate transfers on 2025-01-13
 *
 * Usage: npx tsx scripts/fix-mqb-txn.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';

const DB_URL = 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db';
const DRY_RUN = process.argv.includes('--dry-run');

const prisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
});

const MQB_TXN_ID = '69f5e434-cd1f-4754-8a05-f8b3f4d4a410';
const MQB_SAVINGS_ID = 'c95b5aa6-7b11-41db-9a74-5c27f72dcabc';

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== FIXING MQB TXN IMPORT ===');

  const uncategorized = await prisma.account.findFirst({ where: { name: 'Uncategorized' } });
  if (!uncategorized) throw new Error('Uncategorized account not found');

  // =============================================
  // STEP 1: Unmerge all transfers touching MQB Txn
  // =============================================
  console.log('\n--- STEP 1: Unmerge transfers touching MQB Txn ---\n');

  const mergedTxns = await prisma.transaction.findMany({
    where: {
      metadata: { contains: 'transferMatched' },
      postings: { some: { accountId: MQB_TXN_ID } },
    },
    include: { postings: { include: { account: true } } },
    orderBy: { date: 'asc' },
  });

  console.log(`Found ${mergedTxns.length} merged transfers touching MQB Txn`);

  const unmergedTxAIds: string[] = []; // Track Transaction A IDs for Step 2
  let unmerged = 0;

  for (const tx of mergedTxns) {
    const meta = JSON.parse(tx.metadata!);
    const mergedAt = new Date(meta.mergedAt);
    const d = new Date(tx.date).toISOString().slice(0, 10);

    const newPosting = tx.postings.find(p => {
      const diff = Math.abs(p.createdAt.getTime() - mergedAt.getTime());
      return diff < 1000;
    });
    const originalPosting = tx.postings.find(p => p.id !== newPosting?.id);

    if (!newPosting || !originalPosting) {
      console.log(`  SKIP: ${d} "${tx.payee.substring(0, 40)}" — cannot identify postings`);
      continue;
    }

    console.log(`  Unmerge: ${d} "${tx.payee.substring(0, 50)}"`);
    unmergedTxAIds.push(tx.id);

    if (!DRY_RUN) {
      await prisma.$transaction(async (dbTx: any) => {
        await dbTx.posting.delete({ where: { id: newPosting.id } });

        await dbTx.posting.create({
          data: {
            transactionId: tx.id,
            accountId: uncategorized.id,
            amount: -originalPosting.amount,
            isBusiness: false,
            cleared: false,
          },
        });

        const cleanMeta = { ...meta };
        delete cleanMeta.transferMatched;
        delete cleanMeta.mergedTransactionId;
        delete cleanMeta.mergedPayee;
        delete cleanMeta.mergedAt;
        const newMetadata = Object.keys(cleanMeta).length > 0 ? JSON.stringify(cleanMeta) : null;

        await dbTx.transaction.update({
          where: { id: tx.id },
          data: { metadata: newMetadata },
        });

        // Recreate Transaction B with B's payee if available
        const newTxB = await dbTx.transaction.create({
          data: {
            date: tx.date,
            payee: meta.mergedPayee || tx.payee,
            status: 'NORMAL',
          },
        });

        await dbTx.posting.create({
          data: {
            transactionId: newTxB.id,
            accountId: newPosting.accountId,
            amount: newPosting.amount,
            isBusiness: false,
            cleared: false,
          },
        });

        await dbTx.posting.create({
          data: {
            transactionId: newTxB.id,
            accountId: uncategorized.id,
            amount: -newPosting.amount,
            isBusiness: false,
            cleared: false,
          },
        });
      });
    }
    unmerged++;
  }

  console.log(`Unmerged: ${unmerged}`);

  // =============================================
  // STEP 2: Fix corrupted Transaction A postings
  // The merge changed A's amount to -bAmount (where B had wrong signs).
  // Negating both postings restores the correct amount.
  // =============================================
  console.log('\n--- STEP 2: Fix corrupted Transaction A postings ---\n');

  let fixedAs = 0;
  for (const txId of unmergedTxAIds) {
    const tx = await prisma.transaction.findUnique({
      where: { id: txId },
      include: { postings: { include: { account: true } } },
    });
    if (!tx) continue;

    for (const p of tx.postings) {
      const acctName = p.account.name.trim();
      if (!DRY_RUN) {
        await prisma.posting.update({
          where: { id: p.id },
          data: { amount: -p.amount },
        });
      }
    }

    const realP = tx.postings.find(p => p.account.kind === 'TRANSFER');
    const d = new Date(tx.date).toISOString().slice(0, 10);
    console.log(`  Fix: ${d} "${tx.payee.substring(0, 50)}" | ${realP?.account.name.trim()} ${realP?.amount} → ${realP ? -realP.amount : '?'}`);
    fixedAs++;
  }

  console.log(`Fixed: ${fixedAs} Transaction A postings`);

  // =============================================
  // STEP 3: Negate ALL MQB Txn postings (fix import)
  // Only for transactions with Uncategorized/Category counterpart
  // =============================================
  console.log('\n--- STEP 3: Negate all MQB Txn import postings ---\n');

  const txnTransactions = await prisma.transaction.findMany({
    where: { postings: { some: { accountId: MQB_TXN_ID } } },
    include: { postings: { include: { account: true } } },
  });

  let negated = 0;
  let skipped = 0;

  for (const tx of txnTransactions) {
    const txnPosting = tx.postings.find(p => p.accountId === MQB_TXN_ID);
    const otherPosting = tx.postings.find(p => p.accountId !== MQB_TXN_ID);

    if (!txnPosting || !otherPosting) continue;

    // Only negate if counterpart is a CATEGORY account
    if (otherPosting.account.kind !== 'CATEGORY') {
      skipped++;
      continue;
    }

    if (!DRY_RUN) {
      await prisma.$transaction(async (dbTx: any) => {
        await dbTx.posting.update({
          where: { id: txnPosting.id },
          data: { amount: -txnPosting.amount },
        });
        await dbTx.posting.update({
          where: { id: otherPosting.id },
          data: { amount: -otherPosting.amount },
        });
      });
    }
    negated++;
  }

  console.log(`Negated: ${negated} MQB Txn transactions, Skipped: ${skipped} (already transfers)`);

  // =============================================
  // STEP 4: Delete stuck duplicate transfers
  // =============================================
  console.log('\n--- STEP 4: Delete stuck duplicate transfers ---\n');

  const stuckTransfers = await prisma.transaction.findMany({
    where: {
      postings: { some: { accountId: MQB_SAVINGS_ID } },
      AND: [
        { postings: { some: { accountId: MQB_TXN_ID } } },
        { OR: [{ metadata: null }, { NOT: { metadata: { contains: 'transferMatched' } } }] },
      ],
    },
    include: { postings: { include: { account: true } } },
  });

  console.log(`Found ${stuckTransfers.length} stuck transfers`);

  for (const tx of stuckTransfers) {
    const sp = tx.postings.find(p => p.accountId === MQB_SAVINGS_ID);
    const d = new Date(tx.date).toISOString().slice(0, 10);
    console.log(`  Delete: ${d} "${tx.payee.substring(0, 50)}" Savings=${sp?.amount}`);

    if (!DRY_RUN) {
      await prisma.posting.deleteMany({ where: { transactionId: tx.id } });
      await prisma.transaction.delete({ where: { id: tx.id } });
    }
  }

  // =============================================
  // VERIFICATION
  // =============================================
  console.log('\n--- VERIFICATION ---\n');

  if (!DRY_RUN) {
    // MQB Txn balance
    const txnPostings = await prisma.posting.findMany({ where: { accountId: MQB_TXN_ID } });
    const txnSum = txnPostings.reduce((s, p) => s + p.amount, 0);
    console.log(`MQB Txn balance:     ${txnSum.toFixed(2)} (CSV expects: $513.88)`);

    // MQB Savings balance
    const savPostings = await prisma.posting.findMany({ where: { accountId: MQB_SAVINGS_ID } });
    const savSum = savPostings.reduce((s, p) => s + p.amount, 0);
    console.log(`MQB Savings balance: ${savSum.toFixed(2)} (CSV expects: $78,640.77)`);

    // Quick sign check on Glenn entries
    const glenn = await prisma.transaction.findMany({
      where: { payee: { contains: 'Glenn' }, postings: { some: { accountId: MQB_TXN_ID } } },
      include: { postings: true },
      take: 3,
    });
    console.log('\nGlenn Tobiansky sign check (should be positive/credit):');
    for (const tx of glenn) {
      const tp = tx.postings.find(p => p.accountId === MQB_TXN_ID);
      const d = new Date(tx.date).toISOString().slice(0, 10);
      console.log(`  ${d} ${tx.payee.substring(0, 40)} = ${tp?.amount} ${tp && tp.amount > 0 ? '✓' : '❌'}`);
    }
  } else {
    console.log('(Dry run — no verification)');
  }

  console.log('\n=== DONE ===');
  if (DRY_RUN) console.log('(Dry run — no changes made)');
}

main().catch(console.error).finally(() => prisma.$disconnect());
