import { getPrismaClient } from '../src/lib/db';

const prisma = getPrismaClient();

async function removeGSTControlAccount() {
  console.log('Removing GST Control account (it should be a virtual/calculated view, not a real account record)...');

  const gstControl = await prisma.account.findFirst({
    where: { name: 'GST Control' }
  });

  if (gstControl) {
    // Check if it has any postings
    const postingsCount = await prisma.posting.count({
      where: { accountId: gstControl.id }
    });

    if (postingsCount > 0) {
      console.log(`⚠️  GST Control has ${postingsCount} postings. Not deleting to preserve data.`);
    } else {
      await prisma.account.delete({
        where: { id: gstControl.id }
      });
      console.log('✓ Deleted GST Control account');
    }
  } else {
    console.log('GST Control account not found (already removed or never created)');
  }

  console.log('\nGST Collected and GST Paid remain as categories.');
  console.log('GST Control should be implemented as a virtual account (query-based view), not a database account.');

  await prisma.$disconnect();
}

removeGSTControlAccount().catch(console.error);
