import { PrismaClient } from '@prisma/client';

const DB_URL = 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db';
const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

async function main() {
  const accounts = await prisma.account.findMany({
    where: { kind: 'TRANSFER' },
    orderBy: { sortOrder: 'asc' },
  });

  for (const a of accounts) {
    const parent = a.parentId ? accounts.find(p => p.id === a.parentId) : null;
    console.log(`${parent ? '  ' : ''}${a.name.trim()} | type=${a.type} subtype=${a.subtype} | parent=${parent?.name.trim() || 'ROOT'} | id=${a.id} | parentId=${a.parentId || 'null'}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
