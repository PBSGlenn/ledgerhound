/**
 * Find all potential transfer matches across all account pairs.
 * Reports matches without committing anything.
 */
import { PrismaClient } from '@prisma/client';
import { TransferMatchingService } from '../src/lib/services/transferMatchingService';

const DB_URL = 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db';

const prisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
});

async function main() {
  const service = new TransferMatchingService(prisma);

  // Get all TRANSFER-kind accounts
  const accounts = await prisma.account.findMany({
    where: { kind: 'TRANSFER', archived: false },
    orderBy: { name: 'asc' },
  });

  console.log('=== TRANSFER ACCOUNTS ===');
  for (const a of accounts) {
    console.log(`  ${a.name} (${a.id})`);
  }
  console.log();

  // Check each unique pair
  const allMatches: Array<{
    accountA: string;
    accountB: string;
    matches: number;
    exact: number;
    probable: number;
    possible: number;
    details: any[];
  }> = [];

  for (let i = 0; i < accounts.length; i++) {
    for (let j = i + 1; j < accounts.length; j++) {
      const a = accounts[i];
      const b = accounts[j];

      const preview = await service.matchTransfers(a.id, b.id);

      if (preview.matches.length > 0) {
        allMatches.push({
          accountA: a.name,
          accountB: b.name,
          matches: preview.matches.length,
          exact: preview.summary.exactMatches,
          probable: preview.summary.probableMatches,
          possible: preview.summary.possibleMatches,
          details: preview.matches.map(m => ({
            score: m.matchScore,
            type: m.matchType,
            aPayee: m.candidateA.payee.substring(0, 60),
            aAmount: m.candidateA.amount,
            aDate: new Date(m.candidateA.date).toISOString().slice(0, 10),
            bPayee: m.candidateB.payee.substring(0, 60),
            bAmount: m.candidateB.amount,
            bDate: new Date(m.candidateB.date).toISOString().slice(0, 10),
            reasons: m.reasons.join(', '),
          })),
        });
      }
    }
  }

  if (allMatches.length === 0) {
    console.log('No matches found across any account pairs.');
    return;
  }

  console.log('=== MATCHES FOUND ===\n');
  for (const m of allMatches) {
    console.log(`${m.accountA} ↔ ${m.accountB}: ${m.matches} matches (${m.exact} exact, ${m.probable} probable, ${m.possible} possible)`);
    for (const d of m.details) {
      console.log(`  [${d.type} ${d.score}/100] ${d.aDate} "${d.aPayee}" (${d.aAmount}) ↔ ${d.bDate} "${d.bPayee}" (${d.bAmount})`);
      console.log(`    ${d.reasons}`);
    }
    console.log();
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
