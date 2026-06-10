/**
 * Read-only inspection of the live book DB ahead of the category cleanup.
 * Usage: npx tsx scripts/inspect-categories.ts
 */
import { PrismaClient } from '@prisma/client';

const DB = 'file:C:/Users/grubb/OneDrive/Pet Behaviour Services/Management/Dev/Ledgerhound/prisma/books/book_1770973815778_ncl6o9xkt/ledger.db';
const prisma = new PrismaClient({ datasourceUrl: DB });

async function main() {
  const categories = await prisma.account.findMany({
    where: { kind: 'CATEGORY' },
    select: {
      id: true, name: true, type: true, parentId: true, level: true,
      fullPath: true, sortOrder: true, archived: true,
      _count: { select: { postings: true, children: true } },
    },
    orderBy: [{ type: 'asc' }, { fullPath: 'asc' }],
  });

  console.log(`Total categories: ${categories.length}`);
  console.log(`Broken metadata (level=0 or fullPath null): ${categories.filter(c => c.level === 0 || !c.fullPath).length}`);
  console.log('');
  for (const c of categories) {
    const flags = [
      c.archived ? 'ARCHIVED' : '',
      c.level === 0 || !c.fullPath ? 'BROKEN-META' : '',
    ].filter(Boolean).join(' ');
    console.log(
      `${c.id.slice(0, 8)} | ${c.type.padEnd(7)} | L${c.level} | posts=${c._count.postings} kids=${c._count.children} | ${c.fullPath ?? `(null) name=${c.name} parent=${c.parentId?.slice(0, 8) ?? '-'}`} ${flags}`
    );
  }

  // The two Web Central transactions whose postings need isBusiness cleared
  for (const prefix of ['9b866845', '080438e2']) {
    const txns = await prisma.transaction.findMany({
      where: { id: { startsWith: prefix } },
      include: { postings: { select: { id: true, accountId: true, amount: true, isBusiness: true, gstCode: true, gstAmount: true } } },
    });
    for (const t of txns) {
      console.log(`\nTXN ${t.id} | ${t.date.toISOString().slice(0, 10)} | ${t.payee}`);
      for (const p of t.postings) {
        console.log(`  posting ${p.id.slice(0, 8)} acct=${p.accountId.slice(0, 8)} amt=${p.amount} isBusiness=${p.isBusiness} gst=${p.gstCode ?? '-'}/${p.gstAmount ?? '-'}`);
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
