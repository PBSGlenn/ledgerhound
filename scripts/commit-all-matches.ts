/**
 * Commit all high-confidence transfer matches across account pairs.
 * Processes pairs in priority order to avoid cross-contamination.
 * Only commits matches with score >= 80.
 */
import { PrismaClient } from '@prisma/client';
import { TransferMatchingService } from '../src/lib/services/transferMatchingService';

const DB_URL = 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db';
const DRY_RUN = process.argv.includes('--dry-run');
const MIN_SCORE = 65;

const prisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
});

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== COMMITTING MATCHES ===');
  console.log(`Minimum score: ${MIN_SCORE}\n`);

  const service = new TransferMatchingService(prisma);

  // Get accounts by name for easy reference
  const accounts = await prisma.account.findMany({
    where: { kind: 'TRANSFER', archived: false },
  });
  const byName = (name: string) => accounts.find(a => a.name.trim() === name.trim());

  // Process pairs in priority order:
  // 1. CBA MC ↔ MQB Txn (credit card payments via Txn — must go first)
  // 2. CBA MC ↔ MQB Savings (direct card payments from Savings in Dec, Jan)
  // 3. CBA Access ↔ CBA Txn Business (CBA internal transfers)
  // 4. MQB Savings ↔ MQB Txn (internal Macquarie transfers — last, after CBA receipts consumed)
  //
  // NOTE: CBA Txn Business ↔ MQB Txn EXCLUDED — produces false positives
  // (CBA entries match against unrelated MQB internal transfers). Needs manual review.
  const pairs = [
    { a: 'CBA MC', b: 'MQB Txn ' },
    { a: 'CBA MC', b: 'MQB Savings' },
    { a: 'CBA Access', b: 'CBA Txn (Business)' },
    { a: 'MQB Savings', b: 'MQB Txn ' },
  ];

  let totalMerged = 0;
  let totalSkipped = 0;

  for (const pair of pairs) {
    const acctA = byName(pair.a);
    const acctB = byName(pair.b);
    if (!acctA || !acctB) {
      console.log(`SKIP: Account "${pair.a}" or "${pair.b}" not found`);
      continue;
    }

    // Re-run detection (candidates may have been consumed by previous matches)
    const preview = await service.matchTransfers(acctA.id, acctB.id);
    const highConfidence = preview.matches.filter(m => m.matchScore >= MIN_SCORE);

    if (highConfidence.length === 0) {
      console.log(`${pair.a} ↔ ${pair.b}: no high-confidence matches`);
      continue;
    }

    console.log(`${pair.a} ↔ ${pair.b}: ${highConfidence.length} matches (score >= ${MIN_SCORE})`);
    for (const m of highConfidence) {
      const aDate = new Date(m.candidateA.date).toISOString().slice(0, 10);
      const bDate = new Date(m.candidateB.date).toISOString().slice(0, 10);
      console.log(`  [${m.matchType} ${m.matchScore}] ${aDate} "${m.candidateA.payee.substring(0, 50)}" (${m.candidateA.amount}) ↔ ${bDate} "${m.candidateB.payee.substring(0, 50)}" (${m.candidateB.amount})`);
    }

    if (!DRY_RUN) {
      const commitPairs = highConfidence.map(m => ({
        candidateAId: m.candidateA.transaction.id,
        candidateBId: m.candidateB.transaction.id,
      }));
      const result = await service.commitMatches(commitPairs);
      console.log(`  → Merged: ${result.merged}, Skipped: ${result.skipped}`);
      if (result.errors.length > 0) {
        console.log(`  → Errors: ${result.errors.join('; ')}`);
      }
      totalMerged += result.merged;
      totalSkipped += result.skipped;
    } else {
      totalMerged += highConfidence.length;
    }
    console.log();
  }

  console.log(`=== SUMMARY ===`);
  console.log(`Total merged: ${totalMerged}`);
  console.log(`Total skipped: ${totalSkipped}`);
  if (DRY_RUN) console.log('(Dry run — no changes made)');
}

main().catch(console.error).finally(() => prisma.$disconnect());
