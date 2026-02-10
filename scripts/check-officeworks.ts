import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for Officeworks transactions...\n');

  // Check reconciliation status
  const recons = await prisma.reconciliation.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  if (recons.length > 0) {
    console.log('Latest reconciliation:');
    console.log(`  Start: ${recons[0].statementStartDate}`);
    console.log(`  End: ${recons[0].statementEndDate}`);
    console.log(`  Account ID: ${recons[0].accountId}`);
    console.log('')
  }

  const txs = await prisma.transaction.findMany({
    where: {
      OR: [
        { payee: { contains: 'office' } },
        { payee: { contains: 'Office' } },
        { payee: { contains: 'Officeworks' } }
      ]
    },
    include: { postings: true },
    take: 10
  });

  console.log('Found', txs.length, 'Officeworks transactions:');
  for (const tx of txs) {
    console.log(`  ${tx.date.toISOString().slice(0,10)} | ${tx.payee} | amounts: ${tx.postings.map(p => p.amount.toFixed(2)).join(', ')}`);
  }

  console.log('\n\nChecking for memorized rules matching Officeworks...');

  const rules = await prisma.memorizedRule.findMany({
    where: {
      OR: [
        { matchValue: { contains: 'office' } },
        { matchValue: { contains: 'Office' } },
        { matchValue: { contains: 'OFFICE' } }
      ]
    }
  });

  console.log('Found', rules.length, 'matching rules:');
  for (const r of rules) {
    console.log(`  ${r.name}: pattern="${r.matchValue}" -> payee="${r.defaultPayee}"`);
  }

  // Also check transactions from 02 Dec
  console.log('\n\nChecking all transactions from 02 Dec 2025...');
  const decTxs = await prisma.transaction.findMany({
    where: {
      date: {
        gte: new Date('2025-12-02'),
        lt: new Date('2025-12-03')
      }
    },
    include: { postings: true }
  });

  console.log('Found', decTxs.length, 'transactions on 02 Dec:');
  for (const tx of decTxs) {
    console.log(`  ${tx.payee} | amounts: ${tx.postings.map(p => p.amount.toFixed(2)).join(', ')}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
