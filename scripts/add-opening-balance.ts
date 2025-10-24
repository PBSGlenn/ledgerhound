import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addOpeningBalance() {
  console.log('🔍 Finding CBA Transaction Account (PBS)...');

  const pbsAccount = await prisma.account.findFirst({
    where: {
      name: 'CBA Transaction Account (PBS)',
      kind: 'TRANSFER',
    },
  });

  if (!pbsAccount) {
    console.error('❌ CBA Transaction Account (PBS) not found!');
    process.exit(1);
  }

  console.log(`✅ Found account: ${pbsAccount.name}`);
  console.log(`   Opening Balance: $${pbsAccount.openingBalance}`);
  console.log(`   Opening Date: ${pbsAccount.openingDate}`);

  // Check if opening balance transaction already exists
  const openingDate = new Date('2024-07-01T00:00:00.000Z');
  const existingOpening = await prisma.transaction.findFirst({
    where: {
      date: openingDate,
      payee: 'Opening Balance',
      postings: {
        some: {
          accountId: pbsAccount.id,
        },
      },
    },
  });

  if (existingOpening) {
    console.log('⚠️  Opening balance transaction already exists');
    return;
  }

  // Find or create Opening Balances equity account
  let openingBalancesAccount = await prisma.account.findFirst({
    where: {
      name: 'Opening Balances',
      type: 'EQUITY',
    },
  });

  if (!openingBalancesAccount) {
    console.log('📊 Creating Opening Balances equity account...');
    openingBalancesAccount = await prisma.account.create({
      data: {
        name: 'Opening Balances',
        type: 'EQUITY',
        kind: 'CATEGORY',
        level: 0,
        isReal: true,
        isBusinessDefault: false,
        openingBalance: 0,
        openingDate: new Date('2024-07-01'),
        currency: 'AUD',
      },
    });
    console.log(`✅ Created Opening Balances account: ${openingBalancesAccount.id}`);
  }

  // Create opening balance transaction
  console.log('\n💾 Creating opening balance transaction...');
  console.log(`   Date: 1 July 2024`);
  console.log(`   Amount: $${pbsAccount.openingBalance}`);

  const transaction = await prisma.transaction.create({
    data: {
      date: openingDate,
      payee: 'Opening Balance',
      memo: 'Starting balance as of 1 July 2024',
      postings: {
        create: [
          {
            // Debit the bank account (increase asset)
            accountId: pbsAccount.id,
            amount: pbsAccount.openingBalance,
            isBusiness: true,
            gstCode: 'GST_FREE',
          },
          {
            // Credit opening balances equity (increase equity)
            accountId: openingBalancesAccount.id,
            amount: -pbsAccount.openingBalance,
            isBusiness: false,
            gstCode: 'GST_FREE',
          },
        ],
      },
    },
    include: {
      postings: true,
    },
  });

  console.log(`✅ Created opening balance transaction: ${transaction.id}`);
  console.log(`   Postings: ${transaction.postings.length}`);
}

addOpeningBalance()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
