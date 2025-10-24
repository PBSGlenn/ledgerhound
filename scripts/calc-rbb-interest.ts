import * as fs from 'fs';

const file = 'c:\\Users\\grubb\\Downloads\\rabobank_transactions.csv';
const content = fs.readFileSync(file, 'utf-8');
const lines = content.split('\n');

let totalInterest = 0;
const interestEntries: Array<{date: string, amount: number, description: string}> = [];

// FY 2024-25 dates
const fyStart = new Date(2024, 6, 1);  // 1 Jul 2024
const fyEnd = new Date(2025, 5, 30);   // 30 Jun 2025

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;

  const parts = line.split(',');
  if (parts.length < 10) continue;

  const dateStr = parts[5];
  const description = parts[6];
  const creditStr = parts[8];

  // Check if it's interest
  if (description && description.toLowerCase().includes('interest')) {
    const credit = parseFloat(creditStr);

    if (!isNaN(credit) && credit > 0) {
      // Parse date (format: YYYY-MM-DD)
      const date = new Date(dateStr);

      // Check if in FY 2024-25
      if (date >= fyStart && date <= fyEnd) {
        totalInterest += credit;
        interestEntries.push({ date: dateStr, amount: credit, description });
      }
    }
  }
}

console.log('RaboDirect Bank (RBB) Interest - FY 2024-25\n');
console.log('Joint Account: Glenn Mark Tobiansky - Yuko Fujita');
console.log('Your share (50%):\n');

interestEntries.forEach(entry => {
  console.log(`${entry.date}: $${entry.amount.toFixed(2)} - ${entry.description}`);
});

console.log(`\n${'='.repeat(50)}`);
console.log(`Total Interest (100%): $${totalInterest.toFixed(2)}`);
console.log(`Your Share (50%):      $${(totalInterest / 2).toFixed(2)}`);
