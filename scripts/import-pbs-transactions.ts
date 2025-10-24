import { readFileSync } from 'fs';
import Papa from 'papaparse';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CSVRow {
  [key: string]: string;
}

interface ParsedTransaction {
  date: Date;
  payee: string;
  amount: number;
  reference?: string;
}

function parseCSV(filePath: string): ParsedTransaction[] {
  const fileContent = readFileSync(filePath, 'utf-8');
  const result = Papa.parse(fileContent, {
    header: false,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const transactions: ParsedTransaction[] = [];

  for (const row of result.data as any[]) {
    if (!Array.isArray(row) || row.length < 3) continue;

    // CBA CSV format: Date, Amount, Description, Balance
    const dateStr = row[0];
    const amountStr = row[1];
    const payee = row[2];

    const date = parseDate(dateStr);

    // Remove currency symbols, commas and spaces
    const cleanAmount = amountStr
      .replace(/\$/g, '')
      .replace(/,/g, '')
      .replace(/\s/g, '')
      .trim();

    const amount = parseFloat(cleanAmount);

    if (date && !isNaN(amount) && payee) {
      transactions.push({
        date,
        payee: payee.trim(),
        amount,
      });
    }
  }

  return transactions;
}

function parseDate(dateStr: string): Date | null {
  // Handle DD/MM/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return null;
}

async function importTransactions() {
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

  console.log(`✅ Found account: ${pbsAccount.name} (${pbsAccount.id})`);

  // Find or create Uncategorized expense account for temporary categorization
  let uncategorizedExpense = await prisma.account.findFirst({
    where: {
      name: 'Uncategorized',
      type: 'EXPENSE',
      kind: 'CATEGORY',
    },
  });

  if (!uncategorizedExpense) {
    console.log('Creating Uncategorized expense account...');
    const expenseRoot = await prisma.account.findFirst({
      where: { name: 'Expense', parentId: null },
    });

    if (!expenseRoot) {
      console.error('❌ Expense root account not found!');
      process.exit(1);
    }

    uncategorizedExpense = await prisma.account.create({
      data: {
        name: 'Uncategorized',
        type: 'EXPENSE',
        kind: 'CATEGORY',
        parentId: expenseRoot.id,
        level: 1,
        isReal: true,
        isBusinessDefault: true,
        openingBalance: 0,
        openingDate: new Date('2024-07-01'),
        currency: 'AUD',
      },
    });
  }

  // Find or create Income account for deposits
  let income = await prisma.account.findFirst({
    where: {
      name: 'Business Income',
      type: 'INCOME',
    },
  });

  if (!income) {
    console.log('Creating Business Income account...');
    income = await prisma.account.create({
      data: {
        name: 'Business Income',
        type: 'INCOME',
        kind: 'CATEGORY',
        level: 0,
        isReal: true,
        isBusinessDefault: true,
        openingBalance: 0,
        openingDate: new Date('2024-07-01'),
        currency: 'AUD',
      },
    });
  }

  console.log(`✅ Using Uncategorized: ${uncategorizedExpense.id}`);
  console.log(`✅ Using Business Income: ${income.id}`);

  // Parse both CSV files
  const fy2425Path = 'c:\\Users\\grubb\\OneDrive\\Desktop\\TAX\\CBA Txn PBS.csv';
  const q1Path = 'c:\\Users\\grubb\\OneDrive\\Desktop\\TAX\\PBS Q1.csv';

  console.log('\n📄 Parsing FY 2024-25 transactions...');
  const fy2425Transactions = parseCSV(fy2425Path);
  console.log(`   Found ${fy2425Transactions.length} transactions`);

  console.log('📄 Parsing Q1 2025-26 transactions...');
  const q1Transactions = parseCSV(q1Path);
  console.log(`   Found ${q1Transactions.length} transactions`);

  // Combine all transactions
  const allTransactions = [...fy2425Transactions, ...q1Transactions];
  console.log(`\n📊 Total transactions to import: ${allTransactions.length}`);

  // Sort by date (oldest first)
  allTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());

  console.log('\n💾 Importing transactions...');
  let imported = 0;
  let skipped = 0;

  for (const txn of allTransactions) {
    // Determine if income or expense based on amount
    const isIncome = txn.amount > 0;
    const categoryAccount = isIncome ? income : uncategorizedExpense;

    // Check if transaction already exists (by date, payee, and amount)
    const existing = await prisma.transaction.findFirst({
      where: {
        date: txn.date,
        payee: txn.payee,
        postings: {
          some: {
            accountId: pbsAccount.id,
            amount: txn.amount,
          },
        },
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    try {
      // Create double-entry transaction
      // For expenses: Debit Expense, Credit Bank
      // For income: Debit Bank, Credit Income
      await prisma.transaction.create({
        data: {
          date: txn.date,
          payee: txn.payee,
          memo: txn.reference || '',
          postings: {
            create: [
              {
                // Bank account posting
                accountId: pbsAccount.id,
                amount: txn.amount,
                isBusiness: true,
                gstCode: txn.amount < 0 ? 'GST' : 'GST_FREE', // Expenses have GST, income is GST-free for services
              },
              {
                // Category posting (opposite sign)
                accountId: categoryAccount.id,
                amount: -txn.amount,
                isBusiness: true,
                gstCode: txn.amount < 0 ? 'GST' : 'GST_FREE',
              },
            ],
          },
        },
      });

      imported++;
      if (imported % 50 === 0) {
        console.log(`   Imported ${imported} transactions...`);
      }
    } catch (error) {
      console.error(`❌ Failed to import transaction: ${txn.date.toISOString()} - ${txn.payee}`);
      console.error(error);
    }
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   Imported: ${imported}`);
  console.log(`   Skipped (duplicates): ${skipped}`);
  console.log(`   Total processed: ${allTransactions.length}`);
}

importTransactions()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Import failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
