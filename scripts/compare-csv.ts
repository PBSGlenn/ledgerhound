import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient({ datasources: { db: { url: 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db' } } });

const MQB_TXN_ID = '69f5e434-cd1f-4754-8a05-f8b3f4d4a410';

interface CsvEntry {
  date: string; // YYYY-MM-DD
  payee: string;
  amount: number; // positive=credit, negative=debit
  balance: number;
}

function parseCsv(path: string): CsvEntry[] {
  const content = fs.readFileSync(path, 'utf-8');
  const lines = content.split('\n').slice(1).filter(l => l.trim());
  return lines.map(line => {
    // Parse CSV with quoted fields
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { fields.push(current); current = ''; continue; }
      current += ch;
    }
    fields.push(current);

    const [dateStr, details, , , , , , debit, credit, balance] = fields;

    // Parse date: "31 Jan 2026" → "2026-01-31"
    const parts = dateStr.trim().split(' ');
    const months: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
    const isoDate = `${parts[2]}-${months[parts[1]]}-${parts[0].padStart(2, '0')}`;

    const debitAmt = parseFloat(debit) || 0;
    const creditAmt = parseFloat(credit) || 0;
    const amount = creditAmt - debitAmt; // credit=positive, debit=negative

    return {
      date: isoDate,
      payee: details.trim(),
      amount,
      balance: parseFloat(balance) || 0,
    };
  }).reverse(); // oldest first
}

async function run() {
  const csvEntries = parseCsv('C:\\Users\\grubb\\Downloads\\transactions(1).csv');

  console.log(`CSV entries: ${csvEntries.length}`);
  console.log(`CSV expected balance: ${csvEntries[csvEntries.length - 1].balance}\n`);

  // Get DB entries
  const dbTxns = await prisma.transaction.findMany({
    where: { postings: { some: { accountId: MQB_TXN_ID } } },
    include: { postings: { include: { account: true } } },
    orderBy: { date: 'asc' },
  });

  console.log(`DB entries: ${dbTxns.length}\n`);

  // Compare CSV sum vs DB sum
  const csvSum = csvEntries.reduce((s, e) => s + e.amount, 0);
  const dbSum = dbTxns.reduce((s, tx) => {
    const p = tx.postings.find(p => p.accountId === MQB_TXN_ID)!;
    return s + p.amount;
  }, 0);

  console.log(`CSV sum: ${csvSum.toFixed(2)}`);
  console.log(`DB sum:  ${dbSum.toFixed(2)}`);
  console.log(`Difference: ${(dbSum - csvSum).toFixed(2)}\n`);

  // Build a list of DB entries for matching
  // DB dates are UTC (1 day earlier than AEST CSV dates)
  const dbEntries = dbTxns.map(tx => {
    const p = tx.postings.find(p => p.accountId === MQB_TXN_ID)!;
    return {
      date: new Date(tx.date).toISOString().slice(0, 10),
      payee: tx.payee,
      amount: p.amount,
      txId: tx.id,
      matched: false,
    };
  });

  // Try to match each CSV entry to a DB entry
  // Allow date to be off by 1 (timezone) and payee to be substring match
  console.log('=== CSV vs DB Matching ===\n');
  const csvMatched = new Set<number>();

  for (let i = 0; i < csvEntries.length; i++) {
    const csv = csvEntries[i];
    const csvDateObj = new Date(csv.date);
    const prevDay = new Date(csvDateObj.getTime() - 86400000).toISOString().slice(0, 10);

    // Find matching DB entry (same amount, date within 1 day)
    let bestMatch = -1;
    for (let j = 0; j < dbEntries.length; j++) {
      if (dbEntries[j].matched) continue;
      const db = dbEntries[j];

      // Amount must match exactly
      if (Math.abs(db.amount - csv.amount) > 0.01) continue;

      // Date must be within 1 day (UTC vs AEST)
      if (db.date !== csv.date && db.date !== prevDay) continue;

      bestMatch = j;
      break;
    }

    if (bestMatch >= 0) {
      dbEntries[bestMatch].matched = true;
      csvMatched.add(i);
    } else {
      console.log(`CSV UNMATCHED: ${csv.date} | ${csv.payee.substring(0, 50)} | amt=${csv.amount}`);
    }
  }

  // Show unmatched DB entries
  for (const db of dbEntries) {
    if (!db.matched) {
      console.log(`DB  UNMATCHED: ${db.date} | ${db.payee.substring(0, 50)} | amt=${db.amount}`);
    }
  }

  const csvUnmatched = csvEntries.length - csvMatched.size;
  const dbUnmatched = dbEntries.filter(d => !d.matched).length;
  console.log(`\nCSV unmatched: ${csvUnmatched}`);
  console.log(`DB unmatched:  ${dbUnmatched}`);

  // Also show the sum of unmatched entries
  let csvUnmatchedSum = 0;
  for (let i = 0; i < csvEntries.length; i++) {
    if (!csvMatched.has(i)) csvUnmatchedSum += csvEntries[i].amount;
  }
  let dbUnmatchedSum = 0;
  for (const db of dbEntries) {
    if (!db.matched) dbUnmatchedSum += db.amount;
  }
  console.log(`CSV unmatched sum: ${csvUnmatchedSum.toFixed(2)}`);
  console.log(`DB unmatched sum:  ${dbUnmatchedSum.toFixed(2)}`);
  console.log(`\nExpected fix: DB sum would become ${(dbSum - dbUnmatchedSum + csvUnmatchedSum).toFixed(2)} (target: ${csvSum.toFixed(2)})`);

  await prisma.$disconnect();
}
run();
