import { PrismaClient } from '@prisma/client';

const DB_URL = 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db';
const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });

const ACCOUNTS = [
  { name: 'Apple Pay', type: 'ASSET', subtype: 'PSP' },
  { name: 'PayPal', type: 'ASSET', subtype: 'PSP' },
  { name: 'Google Wallet', type: 'ASSET', subtype: 'PSP' },
];

async function main() {
  for (const acct of ACCOUNTS) {
    const existing = await prisma.account.findFirst({
      where: { name: acct.name, kind: 'TRANSFER' },
    });
    if (existing) {
      console.log(`SKIP: "${acct.name}" already exists (${existing.id})`);
      continue;
    }

    const created = await prisma.account.create({
      data: {
        name: acct.name,
        kind: 'TRANSFER',
        type: acct.type,
        subtype: acct.subtype,
        isReal: false,
        openingBalance: 0,
        openingDate: new Date(),
        archived: false,
      },
    });
    console.log(`CREATED: "${acct.name}" → ${created.id}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
