/**
 * Unmerge Transfer Matches
 *
 * Reverses all transfer matching merges by:
 * 1. For each merged transaction: identify the "new" posting (created during merge)
 * 2. Delete the new posting and restore an Uncategorized posting (restoring Transaction A)
 * 3. Recreate Transaction B with its Account B posting + Uncategorized posting
 *
 * Usage: npx tsx scripts/unmerge-transfers.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';

const DB_URL = 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db';
const DRY_RUN = process.argv.includes('--dry-run');

const prisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
});

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN (no changes will be made) ===' : '=== UNMERGING TRANSFERS ===');

  // Find the Uncategorized account
  const uncategorized = await prisma.account.findFirst({ where: { name: 'Uncategorized' } });
  if (!uncategorized) {
    console.error('ERROR: Uncategorized account not found');
    return;
  }
  console.log(`Uncategorized account: ${uncategorized.id}`);

  // Find all merged transactions
  const mergedTxns = await prisma.transaction.findMany({
    where: { metadata: { contains: 'transferMatched' } },
    include: { postings: { include: { account: true } } },
    orderBy: { date: 'asc' },
  });

  console.log(`Found ${mergedTxns.length} merged transactions to unmerge\n`);

  let unmerged = 0;
  let errors = 0;

  for (const tx of mergedTxns) {
    const meta = JSON.parse(tx.metadata!);
    const mergedAt = new Date(meta.mergedAt);

    // Identify the "new" posting (created during merge — its createdAt matches mergedAt within 1 second)
    const newPosting = tx.postings.find(p => {
      const diff = Math.abs(p.createdAt.getTime() - mergedAt.getTime());
      return diff < 1000; // Within 1 second
    });

    const originalPosting = tx.postings.find(p => p.id !== newPosting?.id);

    if (!newPosting || !originalPosting) {
      console.error(`  SKIP: ${tx.id} — could not identify original vs new posting`);
      errors++;
      continue;
    }

    console.log(`TX: ${tx.id} | ${tx.date.toISOString().slice(0, 10)} | ${tx.payee}`);
    console.log(`  Original: ${originalPosting.account.name} (${originalPosting.amount})`);
    console.log(`  New (to remove): ${newPosting.account.name} (${newPosting.amount})`);
    console.log(`  Will recreate Transaction B: ${newPosting.account.name} posting + Uncategorized`);

    if (!DRY_RUN) {
      try {
        await prisma.$transaction(async (dbTx: any) => {
          // 1. Delete the new posting from Transaction A
          await dbTx.posting.delete({ where: { id: newPosting.id } });

          // 2. Create Uncategorized posting on Transaction A to restore balance
          await dbTx.posting.create({
            data: {
              transactionId: tx.id,
              accountId: uncategorized.id,
              amount: -originalPosting.amount, // Balance the original posting
              isBusiness: false,
              cleared: false,
            },
          });

          // 3. Clean up metadata on Transaction A
          const cleanMeta = { ...meta };
          delete cleanMeta.transferMatched;
          delete cleanMeta.mergedTransactionId;
          delete cleanMeta.mergedAt;
          const newMetadata = Object.keys(cleanMeta).length > 0 ? JSON.stringify(cleanMeta) : null;

          await dbTx.transaction.update({
            where: { id: tx.id },
            data: { metadata: newMetadata },
          });

          // 4. Recreate Transaction B
          const newTxB = await dbTx.transaction.create({
            data: {
              date: tx.date, // Use the merged transaction's date (close enough)
              payee: tx.payee, // We lost B's original payee, use A's
              status: 'NORMAL',
              metadata: JSON.stringify({ restoredFromUnmerge: true, originalMergedTxId: tx.id }),
            },
          });

          // 5. Create Account B posting on Transaction B
          await dbTx.posting.create({
            data: {
              transactionId: newTxB.id,
              accountId: newPosting.accountId,
              amount: newPosting.amount, // Same amount as what was on the merged tx
              isBusiness: false,
              cleared: false,
            },
          });

          // 6. Create balancing Uncategorized posting on Transaction B
          await dbTx.posting.create({
            data: {
              transactionId: newTxB.id,
              accountId: uncategorized.id,
              amount: -newPosting.amount,
              isBusiness: false,
              cleared: false,
            },
          });

          console.log(`  ✓ Unmerged. New Transaction B: ${newTxB.id}`);
        });

        unmerged++;
      } catch (err) {
        console.error(`  ✗ ERROR: ${err instanceof Error ? err.message : err}`);
        errors++;
      }
    } else {
      unmerged++;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Unmerged: ${unmerged}`);
  console.log(`Errors: ${errors}`);
  if (DRY_RUN) console.log('(Dry run — no changes made. Remove --dry-run to execute.)');
}

main().catch(console.error).finally(() => prisma.$disconnect());
