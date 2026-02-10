/**
 * Simulate the matching algorithm to debug the Officeworks issue
 */
import munkres from 'munkres-js';

// PDF transactions from the statement
const pdfTransactions = [
  { date: new Date('2025-12-02'), description: 'Officeworks 0343 Mento Mentone', debit: 0.44 },
  { date: new Date('2025-12-02'), description: 'Officeworks 0343 Mento Mentone', debit: 0.11 },
  { date: new Date('2025-12-02'), description: 'Officeworks 0343 Mento Mentone', debit: 0.77 },
  { date: new Date('2025-12-02'), description: 'Officeworks 0343 Mentone', debit: 0.19 },
];

// Ledger transactions from the database
const ledgerTransactions = [
  { payee: 'Officeworks', date: new Date('2025-12-01'), amount: -0.44 },
  { payee: 'Officeworks', date: new Date('2025-12-01'), amount: -0.11 },
  { payee: 'Officeworks', date: new Date('2025-12-01'), amount: -0.77 },
  { payee: 'Officeworks', date: new Date('2025-12-01'), amount: -0.19 },
];

function calculateScore(pdfTx: any, ledgerTx: any): number {
  let score = 0;

  // Date matching
  const dateDiff = Math.abs(pdfTx.date.getTime() - ledgerTx.date.getTime()) / (1000 * 60 * 60 * 24);
  if (dateDiff === 0) score += 30;
  else if (dateDiff <= 1) score += 25;
  else if (dateDiff <= 3) score += 15;
  else if (dateDiff <= 7) score += 5;

  // Amount matching
  const pdfAmount = Math.abs((pdfTx.debit || 0) - (pdfTx.credit || 0));
  const ledgerAmount = Math.abs(ledgerTx.amount);

  if (Math.abs(pdfAmount - ledgerAmount) < 0.01) {
    score += 50; // Exact match
  } else if (Math.abs(pdfAmount - ledgerAmount) < 1) {
    score += 25;
  }

  // Description matching (simplified - just check if both contain 'officeworks')
  const pdfDesc = pdfTx.description.toLowerCase();
  const ledgerPayee = ledgerTx.payee.toLowerCase();
  if (pdfDesc.includes('officeworks') && ledgerPayee.includes('officeworks')) {
    score += 20; // High similarity
  }

  return score;
}

console.log('=== SCORE MATRIX ===');
console.log('PDF transactions:');
pdfTransactions.forEach((tx, i) => console.log(`  [${i}] $${tx.debit?.toFixed(2)} - ${tx.description}`));

console.log('\nLedger transactions:');
ledgerTransactions.forEach((tx, i) => console.log(`  [${i}] $${tx.amount.toFixed(2)} - ${tx.payee}`));

console.log('\nScore matrix:');
const scoreMatrix: number[][] = [];
for (let i = 0; i < pdfTransactions.length; i++) {
  scoreMatrix[i] = [];
  const row: string[] = [];
  for (let j = 0; j < ledgerTransactions.length; j++) {
    const score = calculateScore(pdfTransactions[i], ledgerTransactions[j]);
    scoreMatrix[i][j] = score;
    row.push(score.toString().padStart(3));
  }
  console.log(`  PDF[${i}] $${pdfTransactions[i].debit?.toFixed(2)}: [${row.join(', ')}]`);
}

// Convert to cost matrix
console.log('\n=== RUNNING HUNGARIAN ALGORITHM ===');
const maxScore = 100;
const costMatrix: number[][] = [];
for (let i = 0; i < 4; i++) {
  costMatrix[i] = [];
  for (let j = 0; j < 4; j++) {
    costMatrix[i][j] = maxScore - scoreMatrix[i][j];
  }
}

console.log('Cost matrix (100 - score):');
for (let i = 0; i < 4; i++) {
  const row = costMatrix[i].map(c => c.toString().padStart(3));
  console.log(`  [${i}]: [${row.join(', ')}]`);
}

const assignments = munkres(costMatrix);
console.log('\nHungarian algorithm assignments:', JSON.stringify(assignments));

console.log('\n=== FINAL PAIRINGS ===');
for (const [pdfIdx, ledgerIdx] of assignments) {
  const pdfTx = pdfTransactions[pdfIdx];
  const ledgerTx = ledgerTransactions[ledgerIdx];
  const score = scoreMatrix[pdfIdx][ledgerIdx];
  console.log(`PDF $${pdfTx.debit?.toFixed(2)} → Ledger $${ledgerTx.amount.toFixed(2)} (score: ${score})`);

  // Check if this is the correct pairing
  const expected = Math.abs(pdfTx.debit || 0) === Math.abs(ledgerTx.amount);
  console.log(`  ${expected ? '✅ CORRECT' : '❌ WRONG'} - amounts ${expected ? 'match' : 'do NOT match'}`);
}
