/**
 * EMERGENCY TAX CALCULATOR
 * For BAS Q1 (Jul-Sep 2025) and Income Tax (FY 2024-25)
 *
 * Reads CSVs directly and calculates tax obligations
 */

import * as fs from 'fs';
import * as path from 'path';

// Date helpers
function parseDate(dateStr: string): Date {
  // Handle DD/MM/YYYY format
  const [day, month, year] = dateStr.split('/').map(Number);
  return new Date(year, month - 1, day);
}

function isInDateRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

// Parse currency strings like "$1,234.56" or "-$1,234.56"
function parseCurrency(str: string): number {
  const cleaned = str.replace(/[$,]/g, '');
  return parseFloat(cleaned);
}

// CSV parsers
interface Transaction {
  date: Date;
  amount: number;
  description: string;
  balance?: number;
}

function parseCSV(filePath: string, hasHeader: boolean = true): Transaction[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  const startIdx = hasHeader ? 1 : 0;
  const transactions: Transaction[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split by comma but handle quoted fields
    const parts = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
    if (!parts || parts.length < 2) continue;

    const dateStr = parts[0].replace(/"/g, '');
    const amountStr = parts[1].replace(/"/g, '');
    const description = parts[2]?.replace(/"/g, '') || '';
    const balanceStr = parts[3]?.replace(/"/g, '');

    // Skip if date is invalid
    if (!dateStr.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) continue;

    try {
      const date = parseDate(dateStr);
      const amount = parseCurrency(amountStr);
      const balance = balanceStr ? parseCurrency(balanceStr) : undefined;

      transactions.push({ date, amount, description, balance });
    } catch (e) {
      console.warn(`Skipping invalid line: ${line}`);
    }
  }

  return transactions;
}

// Tax calculations
const TAX_DIR = 'c:\\Users\\grubb\\OneDrive\\Desktop\\TAX';

// Financial Year 2024-25
const FY_START = new Date(2024, 6, 1); // 1 Jul 2024
const FY_END = new Date(2025, 5, 30);   // 30 Jun 2025

// BAS Q1 FY 2025-26 (Jul-Sep 2025)
const BAS_Q1_START = new Date(2025, 6, 1);  // 1 Jul 2025
const BAS_Q1_END = new Date(2025, 8, 30);   // 30 Sep 2025

console.log('🧮 EMERGENCY TAX CALCULATOR\n');
console.log(`Tax Directory: ${TAX_DIR}\n`);

// ============================================
// 1. BUSINESS TRANSACTIONS (Complete Account)
// ============================================
console.log('📊 BUSINESS TRANSACTION ACCOUNT');
console.log('================================\n');

// FY 2024-25 transactions
const businessFile = path.join(TAX_DIR, 'CBA Txn PBS.csv');
const businessTransactions = parseCSV(businessFile, false); // No header

// Q1 2025-26 transactions
const q1File = path.join(TAX_DIR, 'PBS Q1.csv');
const q1Transactions = parseCSV(q1File, false); // No header

// Separate income and expenses
const incomeInFY = businessTransactions.filter(t =>
  isInDateRange(t.date, FY_START, FY_END) &&
  t.amount > 0 &&
  t.description.includes('STRIPE')
);

const expensesInFY = businessTransactions.filter(t =>
  isInDateRange(t.date, FY_START, FY_END) &&
  t.amount < 0 &&
  !t.description.toLowerCase().includes('transfer to macbank') // Exclude drawings
);

const incomeInQ1 = q1Transactions.filter(t =>
  isInDateRange(t.date, BAS_Q1_START, BAS_Q1_END) &&
  t.amount > 0 &&
  t.description.includes('STRIPE')
);

const expensesInQ1 = q1Transactions.filter(t =>
  isInDateRange(t.date, BAS_Q1_START, BAS_Q1_END) &&
  t.amount < 0 &&
  !t.description.toLowerCase().includes('transfer to macbank')
);

const totalIncomeFY = incomeInFY.reduce((sum, t) => sum + t.amount, 0);
const totalIncomeQ1 = incomeInQ1.reduce((sum, t) => sum + t.amount, 0);
const totalExpensesFY = Math.abs(expensesInFY.reduce((sum, t) => sum + t.amount, 0));
const totalExpensesQ1 = Math.abs(expensesInQ1.reduce((sum, t) => sum + t.amount, 0));

console.log('FY 2024-25 Business Income (Stripe):');
console.log(`  Total: $${totalIncomeFY.toFixed(2)}`);
console.log(`  Transactions: ${incomeInFY.length}`);
console.log();

console.log('FY 2024-25 Business Expenses:');
console.log(`  Total: $${totalExpensesFY.toFixed(2)}`);
console.log(`  Transactions: ${expensesInFY.length}`);
console.log();

console.log('BAS Q1 2025-26 (Jul-Sep 2025):');
console.log(`  Income: $${totalIncomeQ1.toFixed(2)} (${incomeInQ1.length} transactions)`);
console.log(`  Expenses: $${totalExpensesQ1.toFixed(2)} (${expensesInQ1.length} transactions)`);
console.log();

// ============================================
// 3. BAS Q1 CALCULATION (Jul-Sep 2025)
// ============================================
console.log('📋 BAS Q1 (Jul-Sep 2025) - GST CALCULATION');
console.log('===========================================\n');

// G1: Total sales (GST inclusive)
const g1 = totalIncomeQ1;

// G11: Non-capital purchases (GST inclusive)
const g11 = totalExpensesQ1;

// 1A: GST on sales (1/11th of G1)
const gst1A = g1 / 11;

// 1B: GST on purchases (1/11th of G11)
const gst1B = g11 / 11;

// 7: GST payable (or refundable if negative)
const gst7 = gst1A - gst1B;

console.log(`G1  - Total Sales (GST inc):           $${g1.toFixed(2)}`);
console.log(`G11 - Non-Capital Purchases (GST inc): $${g11.toFixed(2)}`);
console.log();
console.log(`1A  - GST on Sales:                    $${gst1A.toFixed(2)}`);
console.log(`1B  - GST on Purchases:                $${gst1B.toFixed(2)}`);
console.log();
console.log(`7   - GST Payable:                     $${gst7.toFixed(2)}`);
console.log();

if (gst7 > 0) {
  console.log(`✅ You OWE the ATO: $${gst7.toFixed(2)}`);
} else {
  console.log(`✅ ATO OWES YOU (Refund): $${Math.abs(gst7).toFixed(2)}`);
}
console.log();

// ============================================
// 4. INCOME TAX CALCULATION (FY 2024-25)
// ============================================
console.log('💰 INCOME TAX RETURN (FY 2024-25)');
console.log('==================================\n');

// Net business income
const netBusinessIncome = totalIncomeFY - totalExpensesFY;

console.log(`Business Income:    $${totalIncomeFY.toFixed(2)}`);
console.log(`Business Expenses: -$${totalExpensesFY.toFixed(2)}`);
console.log(`                    ${'-'.repeat(25)}`);
console.log(`Net Business Income: $${netBusinessIncome.toFixed(2)}`);
console.log();

// Tax brackets 2024-25
const taxBrackets = [
  { min: 0,      max: 18200,   base: 0,     rate: 0.00 },
  { min: 18201,  max: 45000,   base: 0,     rate: 0.19 },
  { min: 45001,  max: 120000,  base: 5092,  rate: 0.325 },
  { min: 120001, max: 180000,  base: 29467, rate: 0.37 },
  { min: 180001, max: Infinity, base: 51667, rate: 0.45 },
];

function calculateTax(income: number): number {
  for (let i = taxBrackets.length - 1; i >= 0; i--) {
    const bracket = taxBrackets[i];
    if (income > bracket.min) {
      const taxableInBracket = income - bracket.min + 1;
      return bracket.base + (taxableInBracket * bracket.rate);
    }
  }
  return 0;
}

// Assuming no other income or deductions for now
const taxableIncome = netBusinessIncome;
const taxPayable = calculateTax(taxableIncome);
const medicareLevy = taxableIncome * 0.02;
const totalTax = taxPayable + medicareLevy;

console.log(`Taxable Income:     $${taxableIncome.toFixed(2)}`);
console.log(`Tax Payable:        $${taxPayable.toFixed(2)}`);
console.log(`Medicare Levy (2%): $${medicareLevy.toFixed(2)}`);
console.log(`                    ${'-'.repeat(25)}`);
console.log(`TOTAL TAX OWED:     $${totalTax.toFixed(2)}`);
console.log();

// ============================================
// SUMMARY FOR LODGEMENT
// ============================================
console.log('📝 SUMMARY FOR LODGEMENT');
console.log('========================\n');

console.log('BAS Q1 (Due 28 Oct 2025):');
console.log(`  G1:  $${g1.toFixed(2)}`);
console.log(`  G11: $${g11.toFixed(2)}`);
console.log(`  1A:  $${gst1A.toFixed(2)}`);
console.log(`  1B:  $${gst1B.toFixed(2)}`);
console.log(`  7:   $${gst7.toFixed(2)} ${gst7 > 0 ? '(PAY)' : '(REFUND)'}`);
console.log();

console.log('Income Tax Return (Due 31 Oct 2025):');
console.log(`  Business Income (Item 13):  $${totalIncomeFY.toFixed(2)}`);
console.log(`  Business Expenses:         -$${totalExpensesFY.toFixed(2)}`);
console.log(`  Net Business Income:        $${netBusinessIncome.toFixed(2)}`);
console.log(`  Taxable Income:             $${taxableIncome.toFixed(2)}`);
console.log(`  Tax Payable:                $${totalTax.toFixed(2)}`);
console.log();

console.log('⚠️  NOTES:');
console.log('  - Review transactions for any missing business expenses');
console.log('  - Add any personal deductions (donations, etc.)');
console.log('  - Add interest income from RBB/MacBank if applicable');
console.log('  - This is a quick estimate - verify all amounts before lodging');
