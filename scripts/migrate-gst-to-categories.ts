import { getPrismaClient } from '../src/lib/db';

const prisma = getPrismaClient();

async function migrateGSTToCategories() {
  console.log('Migrating GST accounts to categories...');

  // 1. Change GST Collected and GST Paid to categories
  const gstCollected = await prisma.account.findFirst({
    where: { name: 'GST Collected', type: 'LIABILITY' }
  });

  const gstPaid = await prisma.account.findFirst({
    where: { name: 'GST Paid', type: 'ASSET' }
  });

  if (gstCollected) {
    await prisma.account.update({
      where: { id: gstCollected.id },
      data: { kind: 'CATEGORY' }
    });
    console.log('✓ Changed GST Collected to CATEGORY');
  }

  if (gstPaid) {
    await prisma.account.update({
      where: { id: gstPaid.id },
      data: { kind: 'CATEGORY' }
    });
    console.log('✓ Changed GST Paid to CATEGORY');
  }

  // 2. Create GST Control virtual account (if it doesn't exist)
  const existingControl = await prisma.account.findFirst({
    where: { name: 'GST Control', type: 'LIABILITY' }
  });

  if (!existingControl) {
    await prisma.account.create({
      data: {
        name: 'GST Control',
        type: 'LIABILITY',
        kind: 'TRANSFER',
        subtype: 'GST_CONTROL',
        isReal: false,
        isBusinessDefault: true,
        level: 0,
        openingBalance: 0,
        currency: 'AUD'
      }
    });
    console.log('✓ Created GST Control virtual account');
  } else {
    console.log('GST Control account already exists');
  }

  console.log('\n✓ Migration complete!');
  console.log('\nNow:');
  console.log('- GST Collected and GST Paid are categories (appear in Categories tab)');
  console.log('- GST Control is a virtual account (appears in Accounts tab)');
  console.log('- The net GST balance = GST Collected balance - GST Paid balance');
  console.log('- BAS payments should be recorded as transfers from GST Control to your bank');

  await prisma.$disconnect();
}

migrateGSTToCategories().catch(console.error);
