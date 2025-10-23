/**
 * Bank Statement Import Wizard
 * Complete workflow for importing CSV bank statements (Commonwealth Bank format)
 */

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Upload,
  FileText,
  Settings,
  Eye,
  CheckCircle,
  X,
  AlertCircle,
  Download,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { CategorySelector } from '../Category/CategorySelector';
import { useToast } from '../../hooks/useToast';
import type { AccountType } from '@prisma/client';

interface BankStatementImportProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;  // The credit card/bank account to import into
  accountName: string;
  onImportComplete: () => void;
}

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  categoryId: string | null;
  isDuplicate: boolean;
  externalId: string;  // Generated from date+amount+description for duplicate detection
}

interface ColumnMapping {
  dateColumn: number | null;
  descriptionColumn: number | null;
  amountColumn: number | null;
}

export function BankStatementImport({
  isOpen,
  onClose,
  accountId,
  accountName,
  onImportComplete,
}: BankStatementImportProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    dateColumn: null,
    descriptionColumn: null,
    amountColumn: null,
  });
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [importing, setImporting] = useState(false);

  const { showToast } = useToast();

  // Step 1: Upload CSV
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.endsWith('.csv')) {
      showToast('Please upload a CSV file', 'error');
      return;
    }

    setFile(uploadedFile);

    // Read and parse CSV
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text
        .split('\n')
        .map((line) => parseCSVLine(line))
        .filter((row) => row.length > 0);

      setCsvData(rows);

      // Auto-detect column mapping for CBA format
      // CBA format: Date, Amount, Description
      if (rows.length > 0 && rows[0].length === 3) {
        setColumnMapping({
          dateColumn: 0,
          amountColumn: 1,
          descriptionColumn: 2,
        });
      }

      setStep(2);
    };

    reader.readAsText(uploadedFile);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      result.push(current.trim());
    }

    return result;
  };

  // Step 2: Map columns & parse transactions
  const handleParseTransactions = () => {
    if (columnMapping.dateColumn === null || columnMapping.amountColumn === null || columnMapping.descriptionColumn === null) {
      showToast('Please map all required columns', 'error');
      return;
    }

    const parsed: ParsedTransaction[] = [];

    // Skip first row if it looks like a header
    const startRow = csvData[0]?.[0]?.match(/date|description/i) ? 1 : 0;

    for (let i = startRow; i < csvData.length; i++) {
      const row = csvData[i];
      if (row.length < 3) continue;

      const dateStr = row[columnMapping.dateColumn];
      const amountStr = row[columnMapping.amountColumn];
      const description = row[columnMapping.descriptionColumn];

      const date = parseDate(dateStr);
      const amount = parseFloat(amountStr);

      if (!date || isNaN(amount)) continue;

      // Generate external ID for duplicate detection
      const externalId = `${dateStr}-${amountStr}-${description}`.substring(0, 100);

      parsed.push({
        date: date.toISOString().split('T')[0],
        description,
        amount,
        categoryId: null,
        isDuplicate: false,  // Will check against database in next step
        externalId,
      });
    }

    setTransactions(parsed);
    setStep(3);
  };

  const parseDate = (dateStr: string): Date | null => {
    // Handle Australian date format: DD/MM/YYYY
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const year = parseInt(parts[2]);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return null;
  };

  // Step 3: Assign categories
  const handleCategoryChange = (index: number, categoryId: string | null) => {
    const updated = [...transactions];
    updated[index].categoryId = categoryId;
    setTransactions(updated);
  };

  const handleBulkCategoryAssign = (categoryId: string | null) => {
    const updated = transactions.map((txn) => ({
      ...txn,
      categoryId: txn.categoryId || categoryId,  // Only assign if not already assigned
    }));
    setTransactions(updated);
    showToast('Category assigned to unassigned transactions', 'success');
  };

  // Step 4: Import
  const handleImport = async () => {
    const uncategorized = transactions.filter((txn) => !txn.isDuplicate && !txn.categoryId);
    if (uncategorized.length > 0) {
      if (!confirm(`${uncategorized.length} transactions are uncategorized. Continue anyway?`)) {
        return;
      }
    }

    setImporting(true);

    try {
      // Import each transaction
      const toImport = transactions.filter((txn) => !txn.isDuplicate);
      let imported = 0;
      let skipped = 0;

      for (const txn of toImport) {
        if (!txn.categoryId) {
          skipped++;
          continue;
        }

        try {
          // Create transaction
          await fetch('http://localhost:3001/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: new Date(txn.date),
              payee: txn.description.substring(0, 50),  // Limit length
              memo: txn.description,
              externalId: txn.externalId,
              postings: [
                {
                  accountId: accountId,
                  amount: txn.amount,  // CBA uses negative for expenses
                  isBusiness: false,
                },
                {
                  accountId: txn.categoryId,
                  amount: -txn.amount,  // Double-entry: opposite sign
                  isBusiness: false,
                },
              ],
            }),
          });

          imported++;
        } catch (error) {
          console.error('Failed to import transaction:', error);
          skipped++;
        }
      }

      showToast(`Imported ${imported} transactions, skipped ${skipped}`, 'success');
      onImportComplete();
      handleClose();
    } catch (error) {
      console.error('Import failed:', error);
      showToast('Import failed: ' + (error as Error).message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setFile(null);
    setCsvData([]);
    setColumnMapping({ dateColumn: null, amountColumn: null, descriptionColumn: null });
    setTransactions([]);
    onClose();
  };

  const totalAmount = transactions.reduce((sum, txn) => sum + (txn.isDuplicate ? 0 : txn.amount), 0);
  const categorizedCount = transactions.filter((txn) => !txn.isDuplicate && txn.categoryId).length;
  const uncategorizedCount = transactions.filter((txn) => !txn.isDuplicate && !txn.categoryId).length;

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-5xl shadow-2xl z-[101] border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Import Bank Statement
          </Dialog.Title>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Importing into: <span className="font-semibold text-slate-900 dark:text-white">{accountName}</span>
          </p>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {[
              { num: 1, label: 'Upload', icon: Upload },
              { num: 2, label: 'Map Columns', icon: Settings },
              { num: 3, label: 'Categorize', icon: Eye },
              { num: 4, label: 'Review & Import', icon: CheckCircle },
            ].map(({ num, label, icon: Icon }, idx) => (
              <div key={num} className="flex items-center">
                <div
                  className={`flex flex-col items-center ${
                    step >= num ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                      step >= num
                        ? 'border-emerald-600 dark:border-emerald-400 bg-emerald-100 dark:bg-emerald-900/30'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs mt-1 font-medium">{label}</span>
                </div>
                {idx < 3 && (
                  <ChevronRight
                    className={`w-5 h-5 mx-2 ${
                      step > num ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Upload CSV */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-12 text-center">
                <Upload className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Upload CSV File
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Download your bank statement as CSV and upload it here
                </p>
                <label className="inline-block">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <span className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium cursor-pointer inline-block transition-colors">
                    Choose File
                  </span>
                </label>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Commonwealth Bank Format
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                  Expected CSV format (no headers):
                </p>
                <code className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 px-2 py-1 rounded block font-mono">
                  30/06/2025,-17,BWS LIQUOR      3064     CHELSEA     VI
                </code>
              </div>
            </div>
          )}

          {/* Step 2: Map Columns */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4">
                  Column Mapping
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Date Column
                    </label>
                    <select
                      value={columnMapping.dateColumn ?? ''}
                      onChange={(e) => setColumnMapping({ ...columnMapping, dateColumn: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                    >
                      <option value="">Select column...</option>
                      {csvData[0]?.map((_, idx) => (
                        <option key={idx} value={idx}>
                          Column {idx + 1}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Amount Column
                    </label>
                    <select
                      value={columnMapping.amountColumn ?? ''}
                      onChange={(e) => setColumnMapping({ ...columnMapping, amountColumn: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                    >
                      <option value="">Select column...</option>
                      {csvData[0]?.map((_, idx) => (
                        <option key={idx} value={idx}>
                          Column {idx + 1}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Description Column
                    </label>
                    <select
                      value={columnMapping.descriptionColumn ?? ''}
                      onChange={(e) =>
                        setColumnMapping({ ...columnMapping, descriptionColumn: parseInt(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                    >
                      <option value="">Select column...</option>
                      {csvData[0]?.map((_, idx) => (
                        <option key={idx} value={idx}>
                          Column {idx + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                  Preview (first 5 rows)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-700">
                      <tr>
                        {csvData[0]?.map((_, idx) => (
                          <th key={idx} className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">
                            Column {idx + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 5).map((row, rowIdx) => (
                        <tr key={rowIdx} className="border-t border-slate-200 dark:border-slate-700">
                          {row.map((cell, cellIdx) => (
                            <td
                              key={cellIdx}
                              className={`px-3 py-2 text-slate-900 dark:text-slate-100 ${
                                columnMapping.dateColumn === cellIdx ||
                                columnMapping.amountColumn === cellIdx ||
                                columnMapping.descriptionColumn === cellIdx
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 font-medium'
                                  : ''
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 inline mr-1" />
                  Back
                </button>
                <button
                  onClick={handleParseTransactions}
                  disabled={
                    columnMapping.dateColumn === null ||
                    columnMapping.amountColumn === null ||
                    columnMapping.descriptionColumn === null
                  }
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Parse Transactions
                  <ChevronRight className="w-4 h-4 inline ml-1" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Categorize */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Assign Categories ({categorizedCount}/{transactions.length})
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {uncategorizedCount} transactions need categories
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Bulk assign to uncategorized:
                  </span>
                  <div className="w-64">
                    <CategorySelector
                      value={null}
                      onChange={handleBulkCategoryAssign}
                      type="EXPENSE"
                      placeholder="Select category..."
                    />
                  </div>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">Description</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-700 dark:text-slate-300">Amount</th>
                      <th className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-300">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn, idx) => (
                      <tr key={idx} className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-3 py-2 text-slate-900 dark:text-slate-100">{txn.date}</td>
                        <td className="px-3 py-2 text-slate-900 dark:text-slate-100 max-w-xs truncate">{txn.description}</td>
                        <td className={`px-3 py-2 text-right font-medium ${txn.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          ${Math.abs(txn.amount).toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="w-64">
                            <CategorySelector
                              value={txn.categoryId}
                              onChange={(categoryId) => handleCategoryChange(idx, categoryId)}
                              type={txn.amount < 0 ? 'EXPENSE' : 'INCOME'}
                              placeholder="Select category..."
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 inline mr-1" />
                  Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                >
                  Review & Import
                  <ChevronRight className="w-4 h-4 inline ml-1" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review & Import */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">Total Transactions</div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{transactions.length}</div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="text-sm text-green-700 dark:text-green-300 mb-1">Categorized</div>
                  <div className="text-2xl font-bold text-green-900 dark:text-green-100">{categorizedCount}</div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="text-sm text-red-700 dark:text-red-300 mb-1">Uncategorized</div>
                  <div className="text-2xl font-bold text-red-900 dark:text-red-100">{uncategorizedCount}</div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Import Summary</h4>
                <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                  <li>• {transactions.length} transactions will be imported</li>
                  <li>• Total amount: ${Math.abs(totalAmount).toFixed(2)}</li>
                  <li>• Account: {accountName}</li>
                  <li>• {uncategorizedCount > 0 ? `⚠️ ${uncategorizedCount} transactions will be skipped (no category)` : '✅ All transactions categorized'}</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 inline mr-1" />
                  Back to Categorize
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || categorizedCount === 0}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {importing ? (
                    <>
                      <span className="inline-block animate-spin mr-2">⏳</span>
                      Importing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 inline mr-2" />
                      Import {categorizedCount} Transactions
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Close Button */}
          <Dialog.Close asChild>
            <button
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
