import { PrismaClient } from '@prisma/client';
const DB_URL = 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db';
const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

async function main() {
  const stripeAcctId = 'a0cc99d2-10d4-4cbc-9ecb-444662c4223a';
  const txns = await prisma.transaction.findMany({
    where: {
      postings: { some: { accountId: stripeAcctId } },
    },
    select: { payee: true, date: true, memo: true },
    orderBy: { date: 'asc' },
  });

  // Group by payee pattern
  const generic = txns.filter(t =>
    t.payee === 'Stripe Charge' ||
    t.payee === 'Payment for Invoice' ||
    t.payee.startsWith('Invoice Payment') ||
    t.payee.includes('Mcquarie Bank')
  );

  console.log(`Total Stripe transactions: ${txns.length}`);
  console.log(`Generic/wrong payees: ${generic.length}`);
  generic.forEach(t => {
    const d = new Date(t.date).toISOString().slice(0, 10);
    console.log(`  ${d} | "${t.payee}" | memo: "${t.memo}"`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
