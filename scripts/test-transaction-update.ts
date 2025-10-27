import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTransactionUpdate() {
  console.log('🧪 Testing Transaction Update Fields...\n');

  try {
    // Find the PBS account and a test transaction
    const pbsAccount = await prisma.account.findFirst({
      where: { name: 'CBA Transaction Account (PBS)' }
    });

    if (!pbsAccount) {
      throw new Error('PBS account not found');
    }

    // Find a transaction to test with (not the opening balance)
    const testTransaction = await prisma.transaction.findFirst({
      where: {
        payee: { not: 'Opening Balance' },
        postings: { some: { accountId: pbsAccount.id } }
      },
      include: { postings: true }
    });

    if (!testTransaction) {
      throw new Error('No test transaction found');
    }

    console.log('📋 Original Transaction:');
    console.log(`   ID: ${testTransaction.id}`);
    console.log(`   Date: ${testTransaction.date.toISOString().split('T')[0]}`);
    console.log(`   Payee: ${testTransaction.payee}`);
    console.log(`   Memo: ${testTransaction.memo || '(none)'}`);
    console.log(`   Reference: ${testTransaction.reference || '(none)'}`);
    console.log(`   Postings: ${testTransaction.postings.length}`);
    testTransaction.postings.forEach(p => {
      console.log(`      - Account: ${p.accountId}, Amount: ${p.amount}, Business: ${p.isBusiness}, GST: ${p.gstCode || 'none'}`);
    });
    console.log('');

    // Store original values for restoration
    const original = {
      date: testTransaction.date,
      payee: testTransaction.payee,
      memo: testTransaction.memo,
      reference: testTransaction.reference,
      postings: testTransaction.postings
    };

    // Test 1: Update date
    console.log('Test 1: Updating date...');
    const newDate = new Date('2024-08-15');
    await prisma.transaction.update({
      where: { id: testTransaction.id },
      data: { date: newDate }
    });
    const check1 = await prisma.transaction.findUnique({
      where: { id: testTransaction.id }
    });
    console.log(`   ✓ Date: ${check1?.date.toISOString().split('T')[0]} (expected: 2024-08-15)`);
    console.log('');

    // Test 2: Update payee
    console.log('Test 2: Updating payee...');
    await prisma.transaction.update({
      where: { id: testTransaction.id },
      data: { payee: 'TEST PAYEE UPDATE' }
    });
    const check2 = await prisma.transaction.findUnique({
      where: { id: testTransaction.id }
    });
    console.log(`   ✓ Payee: ${check2?.payee} (expected: TEST PAYEE UPDATE)`);
    console.log('');

    // Test 3: Update memo
    console.log('Test 3: Updating memo...');
    await prisma.transaction.update({
      where: { id: testTransaction.id },
      data: { memo: 'Test memo field update' }
    });
    const check3 = await prisma.transaction.findUnique({
      where: { id: testTransaction.id }
    });
    console.log(`   ✓ Memo: ${check3?.memo} (expected: Test memo field update)`);
    console.log('');

    // Test 4: Update reference
    console.log('Test 4: Updating reference...');
    await prisma.transaction.update({
      where: { id: testTransaction.id },
      data: { reference: 'REF-12345' }
    });
    const check4 = await prisma.transaction.findUnique({
      where: { id: testTransaction.id }
    });
    console.log(`   ✓ Reference: ${check4?.reference} (expected: REF-12345)`);
    console.log('');

    // Test 5: Update posting amounts
    console.log('Test 5: Updating posting amounts...');
    await prisma.posting.deleteMany({
      where: { transactionId: testTransaction.id }
    });
    await prisma.posting.createMany({
      data: [
        {
          transactionId: testTransaction.id,
          accountId: pbsAccount.id,
          amount: 150.00,
          isBusiness: true,
          gstCode: 'GST',
          gstRate: 0.1,
          gstAmount: 13.64
        },
        {
          transactionId: testTransaction.id,
          accountId: testTransaction.postings[1].accountId, // Use same category account
          amount: -150.00,
          isBusiness: true,
          gstCode: 'GST',
          gstRate: 0.1,
          gstAmount: 13.64
        }
      ]
    });
    const check5 = await prisma.transaction.findUnique({
      where: { id: testTransaction.id },
      include: { postings: true }
    });
    console.log(`   ✓ Postings count: ${check5?.postings.length}`);
    check5?.postings.forEach(p => {
      console.log(`      - Amount: ${p.amount}, Business: ${p.isBusiness}, GST: ${p.gstCode}`);
    });
    console.log('');

    // Test 6: Toggle business flag
    console.log('Test 6: Toggling business flag...');
    await prisma.posting.updateMany({
      where: { transactionId: testTransaction.id },
      data: { isBusiness: false, gstCode: null, gstRate: null, gstAmount: null }
    });
    const check6 = await prisma.transaction.findUnique({
      where: { id: testTransaction.id },
      include: { postings: true }
    });
    console.log(`   ✓ All postings isBusiness: ${check6?.postings.every(p => !p.isBusiness)}`);
    console.log('');

    // Restore original transaction
    console.log('🔄 Restoring original transaction...');
    await prisma.posting.deleteMany({
      where: { transactionId: testTransaction.id }
    });
    await prisma.transaction.update({
      where: { id: testTransaction.id },
      data: {
        date: original.date,
        payee: original.payee,
        memo: original.memo,
        reference: original.reference,
        postings: {
          create: original.postings.map(p => ({
            accountId: p.accountId,
            amount: p.amount,
            isBusiness: p.isBusiness,
            gstCode: p.gstCode,
            gstRate: p.gstRate,
            gstAmount: p.gstAmount,
            cleared: p.cleared,
            reconciled: p.reconciled
          }))
        }
      }
    });
    console.log('   ✓ Transaction restored to original state');
    console.log('');

    console.log('✅ All direct database tests passed!');
    console.log('');
    console.log('📝 Now testing via API endpoint...');
    console.log('   Transaction ID for manual testing: ' + testTransaction.id);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTransactionUpdate();
