import { getPrismaClient } from '../src/lib/db';
import { AccountType } from '@prisma/client';

const prisma = getPrismaClient();

async function migrateGSTPostings() {
  console.log('Migrating business transactions to use explicit GST postings...\n');

  // Find GST accounts
  const gstPaid = await prisma.account.findFirst({
    where: { name: 'GST Paid', type: AccountType.ASSET }
  });

  const gstCollected = await prisma.account.findFirst({
    where: { name: 'GST Collected', type: AccountType.LIABILITY }
  });

  if (!gstPaid || !gstCollected) {
    console.error('❌ GST Paid or GST Collected account not found!');
    console.log('Please run: npm run script scripts/migrate-gst-to-categories.ts');
    await prisma.$disconnect();
    return;
  }

  console.log('✓ Found GST accounts:');
  console.log(`  - GST Paid: ${gstPaid.id}`);
  console.log(`  - GST Collected: ${gstCollected.id}\n`);

  // Find all transactions with business postings that have gstAmount
  const transactions = await prisma.transaction.findMany({
    include: {
      postings: {
        include: {
          account: true
        }
      }
    }
  });

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const transaction of transactions) {
    // Check if this transaction has any business postings with GST
    const businessPostings = transaction.postings.filter(
      p => p.isBusiness && p.gstAmount && Math.abs(p.gstAmount) > 0.01
    );

    if (businessPostings.length === 0) {
      continue;
    }

    // Check if GST postings already exist
    const hasGstPosting = transaction.postings.some(
      p => p.accountId === gstPaid.id || p.accountId === gstCollected.id
    );

    if (hasGstPosting) {
      console.log(`⊘ Skipping ${transaction.payee} (already has GST postings)`);
      skippedCount++;
      continue;
    }

    console.log(`\n→ Migrating: ${transaction.payee} (${transaction.date.toISOString().split('T')[0]})`);

    try {
      for (const posting of businessPostings) {
        const gstAmount = posting.gstAmount!;
        const currentAmount = posting.amount;

        // Determine if this is income or expense based on posting amount
        // For category postings: positive = expense, negative = income
        const isExpense = currentAmount > 0;
        const gstAccountId = isExpense ? gstPaid.id : gstCollected.id;
        const gstAccountName = isExpense ? 'GST Paid' : 'GST Collected';

        // Calculate GST-exclusive amount (remove GST from current amount)
        const gstExclusiveAmount = currentAmount - gstAmount;

        console.log(`  • ${posting.account.name}:`);
        console.log(`    Current: $${currentAmount.toFixed(2)}`);
        console.log(`    GST Exclusive: $${gstExclusiveAmount.toFixed(2)}`);
        console.log(`    GST Amount: $${gstAmount.toFixed(2)} → ${gstAccountName}`);

        // Update the posting to GST-exclusive amount
        await prisma.posting.update({
          where: { id: posting.id },
          data: { amount: gstExclusiveAmount }
        });

        // Create GST posting
        await prisma.posting.create({
          data: {
            transactionId: transaction.id,
            accountId: gstAccountId,
            amount: gstAmount,
            isBusiness: false, // GST postings themselves don't have GST
            cleared: posting.cleared,
            reconciled: posting.reconciled,
          }
        });

        console.log(`  ✓ Created ${gstAccountName} posting`);
      }

      migratedCount++;
    } catch (error) {
      console.error(`  ❌ Error migrating transaction: ${error}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Migration complete!');
  console.log('='.repeat(60));
  console.log(`✓ Migrated: ${migratedCount} transactions`);
  console.log(`⊘ Skipped: ${skippedCount} transactions (already migrated)`);
  if (errorCount > 0) {
    console.log(`❌ Errors: ${errorCount} transactions`);
  }
  console.log('\nAll business transactions now have explicit GST Paid/Collected postings.');

  await prisma.$disconnect();
}

migrateGSTPostings().catch(console.error);
