/**
 * Bank Statement Import Wizard
 * Complete workflow for importing CSV bank statements (Commonwealth Bank format)
 * NOW WITH AUTOMATIC RULE MATCHING!
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
  Sparkles,
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

interface ImportPreview {
  row: any;
  parsed: {
    date?: Date;
    payee?: string;
    amount?: number;
    reference?: string;
  };
  isDuplicate: boolean;
  matchedRule?: {
    id: string;
    name: string;
    matchType: string;
    matchValue: string;
    defaultPayee?: string;
    defaultAccountId?: string;
  };
  suggestedCategory?: {
    id: string;
    name: string;
    type: string;
  };
}

interface ColumnMapping {
  date?: string;
  payee?: string;
  description?: string;
  amount?: string;
  debit?: string;
  credit?: string;
  reference?: string;
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
  const [csvText, setCsvText] = useState('');
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [previews, setPreviews] = useState<ImportPreview[]>([]);
  const [categoryOverrides, setCategoryOverrides] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
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
      setCsvText(text);

      // Handle both Unix (\n) and Windows (\r\n) line endings
      const rows = text
        .replace(/\r\n/g, '\n')  // Normalize Windows line endings
        .replace(/\r/g, '\n')     // Normalize old Mac line endings
        .split('\n')
        .map((line) => parseCSVLine(line.trim()))  // Trim whitespace from each line
        .filter((row) => row.length > 0 && row.some(cell => cell !== ''));  // Filter out completely empty rows

      setCsvData(rows);

      // Auto-detect column mapping for CBA format
      // CBA format: Date, Amount, Description (no headers)
      if (rows.length > 0 && rows[0].length === 3) {
        setColumnMapping({
          date: '0',
          amount: '1',
          description: '2',
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

    // Always push the last cell, even if empty
    result.push(current.trim());

    return result;
  };

  // Step 2: Map columns & fetch preview from backend (WITH RULE MATCHING!)
  const handleFetchPreview = async () => {
    if (!columnMapping.date || (!columnMapping.amount && (!columnMapping.debit || !columnMapping.credit))) {
      showToast('Please map at least Date and Amount columns', 'error');
      return;
    }

    setLoading(true);
    try {
      // CBA format has no headers, so we need to prepend synthetic headers
      // Create header row with column names like "col0", "col1", "col2"
      const numColumns = csvData[0]?.length || 0;
      const syntheticHeaders = Array.from({ length: numColumns }, (_, i) => `col${i}`).join(',');

      // Normalize all rows to have the same number of columns (pad with empty strings if needed)
      const normalizedRows = csvData.map(row => {
        const normalized = [...row];
        while (normalized.length < numColumns) {
          normalized.push('');
        }
        // Trim to exact column count
        return normalized.slice(0, numColumns).map(cell => {
          // Escape quotes and wrap in quotes if contains comma
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return '"' + cell.replace(/"/g, '""') + '"';
          }
          return cell;
        }).join(',');
      });

      const csvWithHeaders = syntheticHeaders + '\n' + normalizedRows.join('\n');

      console.log('Sending CSV with', normalizedRows.length, 'data rows (after normalization)');

      // Convert column mapping from indices to column names
      const mappingWithColNames: ColumnMapping = {};
      if (columnMapping.date) mappingWithColNames.date = `col${columnMapping.date}`;
      if (columnMapping.amount) mappingWithColNames.amount = `col${columnMapping.amount}`;
      if (columnMapping.description) mappingWithColNames.description = `col${columnMapping.description}`;
      if (columnMapping.payee) mappingWithColNames.payee = `col${columnMapping.payee}`;
      if (columnMapping.debit) mappingWithColNames.debit = `col${columnMapping.debit}`;
      if (columnMapping.credit) mappingWithColNames.credit = `col${columnMapping.credit}`;
      if (columnMapping.reference) mappingWithColNames.reference = `col${columnMapping.reference}`;

      // Call backend API to get preview with rule matching
      const response = await fetch('http://localhost:3001/api/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvText: csvWithHeaders,
          mapping: mappingWithColNames,
          sourceAccountId: accountId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to preview import');
      }

      const previewData: ImportPreview[] = await response.json();
      console.log('Received preview with', previewData.length, 'transactions');
      setPreviews(previewData);

      // Count how many were matched
      const matchedCount = previewData.filter(p => p.matchedRule).length;
      if (matchedCount > 0) {
        showToast(`${matchedCount} transactions auto-matched with memorized rules!`, 'success');
      }

      setStep(3);
    } catch (error) {
      console.error('Preview failed:', error);
      showToast('Failed to preview import: ' + (error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Assign categories (with rule suggestions!)
  const handleCategoryChange = (index: number, categoryId: string | null) => {
    if (categoryId) {
      setCategoryOverrides({ ...categoryOverrides, [index]: categoryId });
    } else {
      const newOverrides = { ...categoryOverrides };
      delete newOverrides[index];
      setCategoryOverrides(newOverrides);
    }
  };

  const handleBulkCategoryAssign = (categoryId: string | null) => {
    if (!categoryId) return;

    const newOverrides = { ...categoryOverrides };
    previews.forEach((preview, idx) => {
      // Only assign to uncategorized and non-duplicate transactions
      if (!preview.isDuplicate && !preview.suggestedCategory && !categoryOverrides[idx]) {
        newOverrides[idx] = categoryId;
      }
    });
    setCategoryOverrides(newOverrides);
    showToast('Category assigned to uncategorized transactions', 'success');
  };

  const getCategoryForPreview = (preview: ImportPreview, index: number): string | null => {
    // User override takes precedence
    if (categoryOverrides[index]) {
      return categoryOverrides[index];
    }
    // Then use suggested category from rule matching
    return preview.suggestedCategory?.id || null;
  };

  // Step 4: Import using backend API
  const handleImport = async () => {
    const categorized = previews.filter((p, idx) =>
      !p.isDuplicate && getCategoryForPreview(p, idx)
    );
    const uncategorized = previews.filter((p, idx) =>
      !p.isDuplicate && !getCategoryForPreview(p, idx)
    );

    if (uncategorized.length > 0) {
      if (!confirm(`${uncategorized.length} transactions are uncategorized and will be skipped. Continue?`)) {
        return;
      }
    }

    setImporting(true);

    try {
      // Prepare data for backend import
      const previewsWithCategories = previews.map((preview, idx) => ({
        ...preview,
        selectedCategoryId: getCategoryForPreview(preview, idx),
      }));

      // Call backend import API
      const response = await fetch('http://localhost:3001/api/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previews: previewsWithCategories,
          sourceAccountId: accountId,
          sourceName: accountName,
          mapping: columnMapping,
          options: {
            applyRules: true,  // Rules were already applied in preview
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Import failed');
      }

      const result = await response.json();

      showToast(
        `Imported ${result.imported} transactions, skipped ${result.skipped} (${result.duplicates} duplicates)`,
        'success'
      );

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
    setCsvText('');
    setCsvData([]);
    setColumnMapping({});
    setPreviews([]);
    setCategoryOverrides({});
    onClose();
  };

  // Calculate stats
  const duplicateCount = previews.filter(p => p.isDuplicate).length;
  const matchedCount = previews.filter(p => p.matchedRule).length;
  const categorizedCount = previews.filter((p, idx) =>
    !p.isDuplicate && getCategoryForPreview(p, idx)
  ).length;
  const uncategorizedCount = previews.filter((p, idx) =>
    !p.isDuplicate && !getCategoryForPreview(p, idx)
  ).length;

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
                      value={columnMapping.date ?? ''}
                      onChange={(e) => setColumnMapping({ ...columnMapping, date: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                    >
                      <option value="">Select column...</option>
                      {csvData[0]?.map((_, idx) => (
                        <option key={idx} value={idx.toString()}>
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
                      value={columnMapping.amount ?? ''}
                      onChange={(e) => setColumnMapping({ ...columnMapping, amount: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                    >
                      <option value="">Select column...</option>
                      {csvData[0]?.map((_, idx) => (
                        <option key={idx} value={idx.toString()}>
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
                      value={columnMapping.description ?? ''}
                      onChange={(e) =>
                        setColumnMapping({ ...columnMapping, description: e.target.value || undefined })
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                    >
                      <option value="">Select column...</option>
                      {csvData[0]?.map((_, idx) => (
                        <option key={idx} value={idx.toString()}>
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
                                columnMapping.date === cellIdx.toString() ||
                                columnMapping.amount === cellIdx.toString() ||
                                columnMapping.description === cellIdx.toString()
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
                  onClick={handleFetchPreview}
                  disabled={loading || !columnMapping.date || !columnMapping.amount}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="inline-block animate-spin">⏳</span>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Parse Transactions
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Categorize (WITH AUTO-MATCHED RULES!) */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Assign Categories ({categorizedCount}/{previews.length - duplicateCount})
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {matchedCount > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        {matchedCount} auto-matched by rules •{' '}
                      </span>
                    )}
                    {uncategorizedCount} need categories • {duplicateCount} duplicates
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
                    {previews.map((preview, idx) => {
                      const categoryId = getCategoryForPreview(preview, idx);
                      const amount = preview.parsed.amount || 0;

                      return (
                        <tr
                          key={idx}
                          className={`border-t border-slate-200 dark:border-slate-700 ${
                            preview.isDuplicate
                              ? 'bg-yellow-50 dark:bg-yellow-900/10'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <td className="px-3 py-2 text-slate-900 dark:text-slate-100">
                            {preview.parsed.date ? new Date(preview.parsed.date).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-3 py-2 text-slate-900 dark:text-slate-100 max-w-xs truncate">
                            {preview.parsed.payee || 'No description'}
                            {preview.matchedRule && (
                              <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Matched: {preview.matchedRule.name}
                              </span>
                            )}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-medium ${
                              amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                            }`}
                          >
                            ${Math.abs(amount).toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            {preview.isDuplicate ? (
                              <span className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">
                                DUPLICATE
                              </span>
                            ) : (
                              <div className="w-64">
                                <CategorySelector
                                  value={categoryId}
                                  onChange={(catId) => handleCategoryChange(idx, catId)}
                                  type={amount < 0 ? 'EXPENSE' : 'INCOME'}
                                  placeholder="Select category..."
                                />
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">Total</div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{previews.length}</div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="text-sm text-green-700 dark:text-green-300 mb-1">Categorized</div>
                  <div className="text-2xl font-bold text-green-900 dark:text-green-100">{categorizedCount}</div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="text-sm text-yellow-700 dark:text-yellow-300 mb-1">Duplicates</div>
                  <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{duplicateCount}</div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="text-sm text-red-700 dark:text-red-300 mb-1">Uncategorized</div>
                  <div className="text-2xl font-bold text-red-900 dark:text-red-100">{uncategorizedCount}</div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Import Summary</h4>
                <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                  <li>• {categorizedCount} transactions will be imported</li>
                  <li>• {duplicateCount} duplicates will be skipped automatically</li>
                  <li>• Account: {accountName}</li>
                  {matchedCount > 0 && (
                    <li className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />• {matchedCount} auto-matched by memorized rules
                    </li>
                  )}
                  {uncategorizedCount > 0 ? (
                    <li className="text-red-600 dark:text-red-400">
                      ⚠️ {uncategorizedCount} transactions will be skipped (no category)
                    </li>
                  ) : (
                    <li className="text-green-600 dark:text-green-400">✅ All transactions categorized</li>
                  )}
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
