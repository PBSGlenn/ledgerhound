/**
 * Set up all accounts for FY 2024-25 import
 * Opening balances as of 1 July 2024
 */

import { accountAPI } from '../src/lib/api';

async function setupAccounts() {
  console.log('🏦 Setting up accounts for FY 2024-25\n');

  try {
    // Business Accounts
    console.log('Creating Business Accounts...');

    const pbsTransaction = await accountAPI.createAccount({
      name: 'CBA Transaction Account (PBS)',
      type: 'ASSET',
      kind: 'TRANSFER',
      openingBalance: 2148.0, // Calculated from first transaction
      openingDate: new Date('2024-07-01'),
    });
    console.log(`✅ Created: ${pbsTransaction.name} (Opening: $${pbsTransaction.openingBalance})`);

    // Note: PBS GST Savings - waiting for CSV data
    // const pbsGST = await accountAPI.createAccount({
    //   name: 'CBA Savings Account (PBS GST)',
    //   type: 'ASSET',
    //   kind: 'TRANSFER',
    //   openingBalance: 0, // TBD - need CSV
    //   openingDate: new Date('2024-07-01'),
    // });

    // Personal Accounts
    console.log('\nCreating Personal Accounts...');

    const cbaAccess = await accountAPI.createAccount({
      name: 'CBA Access Account',
      type: 'ASSET',
      kind: 'TRANSFER',
      openingBalance: 1445.05,
      openingDate: new Date('2024-07-01'),
    });
    console.log(`✅ Created: ${cbaAccess.name} (Opening: $${cbaAccess.openingBalance})`);

    const macBank = await accountAPI.createAccount({
      name: 'MacBank Savings',
      type: 'ASSET',
      kind: 'TRANSFER',
      openingBalance: 0, // Started in Jan 2025
      openingDate: new Date('2024-07-01'),
    });
    console.log(`✅ Created: ${macBank.name} (Opening: $${macBank.openingBalance})`);

    const rbb = await accountAPI.createAccount({
      name: 'RaboDirect (RBB) Savings',
      type: 'ASSET',
      kind: 'TRANSFER',
      openingBalance: 0, // Started Aug 2024
      openingDate: new Date('2024-07-01'),
    });
    console.log(`✅ Created: ${rbb.name} (Opening: $${rbb.openingBalance})`);

    // CBA Mastercard already exists - just need to set opening balance
    console.log('\nChecking existing CBA Mastercard...');
    const accounts = await accountAPI.getAllAccountsWithBalances({ kind: 'TRANSFER' });
    const cbaMC = accounts.find(a => a.name.includes('Mastercard') || a.name.includes('MC'));

    if (cbaMC) {
      console.log(`✅ Found: ${cbaMC.name} (already created)`);
      console.log(`   Note: Opening balance needs to be set for 1 Jul 2024`);
    }

    console.log('\n✅ Account setup complete!');
    console.log('\nNext steps:');
    console.log('1. Import PBS Transaction Account transactions');
    console.log('2. Import CBA Access Account transactions');
    console.log('3. Import CBA Mastercard transactions (both halves)');
    console.log('4. Import MacBank transactions (from PDF/CSV)');
    console.log('5. Import RBB transactions');

    return {
      pbsTransaction,
      cbaAccess,
      macBank,
      rbb,
    };

  } catch (error) {
    console.error('❌ Error creating accounts:', error);
    throw error;
  }
}

// Run immediately
setupAccounts()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
