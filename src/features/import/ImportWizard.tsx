import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { accountAPI, memorizedRuleAPI } from '../../lib/api';
import type { AccountWithBalance, MemorizedRule } from '../../types';
import type { RegisterEntry } from '../../types';

interface ImportWizardProps {
  onClose: () => void;
}

export function ImportWizard({ onClose }: ImportWizardProps) {
  const [step, setStep] = useState(1);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [categories, setCategories] = useState<AccountWithBalance[]>([]);
  const [memorizedRules, setMemorizedRules] = useState<MemorizedRule[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<{[key: string]: string}[]>([]);
  const [columnMappings, setColumnMappings] = useState<{[key: string]: string}>({});
  const [previewTransactions, setPreviewTransactions] = useState<Array<RegisterEntry & { categoryId?: string }>>([]);

  useEffect(() => {
    loadRealAccounts();
    loadCategories();
    loadMemorizedRules();
  }, []);

  const loadMemorizedRules = async () => {
    try {
      const rules = await memorizedRuleAPI.getAllRules();
      setMemorizedRules(rules);
    } catch (error) {
      console.error('Failed to load memorized rules:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const categoryAccounts = await accountAPI.getAllAccountsWithBalances({ kind: 'CATEGORY' });
      setCategories(categoryAccounts);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadRealAccounts = async () => {
    try {
      const realAccounts = await accountAPI.getAllAccountsWithBalances({ isReal: true });
      setAccounts(realAccounts);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const handleNext = () => {
    if (step === 1 && csvFile) {
      Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setCsvHeaders(results.meta.fields || []);
          setCsvRows(results.data as any[]);
          setStep(2);
        },
      });
    } else if (step === 2) {
      preparePreview();
      setStep(3);
    } else {
      setStep(prev => Math.min(prev + 1, 4));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <header className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">CSV Import Wizard</h2>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="account-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Account to Import Into
                </label>
                <select
                  id="account-select"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white transition-colors"
                >
                  <option value="">Select an account...</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="csv-file" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Upload CSV File
                </label>
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files ? e.target.files[0] : null)}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
            </div>
          )}
          {step === 2 && (
            <div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">Map Columns</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                  <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
                    <tr>
                      {csvHeaders.map((header) => (
                        <th key={header} scope="col" className="px-6 py-3">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="bg-white border-b dark:bg-slate-800 dark:border-slate-700">
                        {csvHeaders.map((header) => (
                          <td key={header} className="px-6 py-4">
                            {row[header]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-6">
                {csvHeaders.map((header) => (
                  <div key={header}>
                    <label htmlFor={`mapping-${header}`} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      {header}
                    </label>
                    <select
                      id={`mapping-${header}`}
                      value={Object.keys(columnMappings).find(key => columnMappings[key] === header) || ''}
                      onChange={(e) => {
                        const newMappings = { ...columnMappings };
                        // Remove previous mapping for this header
                        Object.keys(newMappings).forEach(key => {
                          if (newMappings[key] === header) {
                            delete newMappings[key];
                          }
                        });
                        if (e.target.value) {
                          newMappings[e.target.value] = header;
                        }
                        setColumnMappings(newMappings);
                      }}
                      className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white transition-colors"
                    >
                      <option value="">Ignore</option>
                      <option value="date">Date</option>
                      <option value="payee">Payee</option>
                      <option value="amount">Amount</option>
                      <option value="memo">Memo</option>
                      <option value="reference">Reference</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">Preview & Edit</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                  <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
                    <tr>
                      <th scope="col" className="px-6 py-3">Date</th>
                      <th scope="col" className="px-6 py-3">Payee</th>
                      <th scope="col" className="px-6 py-3">Category</th>
                      <th scope="col" className="px-6 py-3">Memo</th>
                      <th scope="col" className="px-6 py-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewTransactions.map((tx, index) => (
                      <tr key={tx.id} className="bg-white border-b dark:bg-slate-800 dark:border-slate-700">
                        <td className="px-6 py-4">{new Date(tx.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={tx.payee}
                            onChange={(e) => {
                              const newTxs = [...previewTransactions];
                              newTxs[index].payee = e.target.value;
                              setPreviewTransactions(newTxs);
                            }}
                            className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={tx.categoryId || ''}
                            onChange={(e) => {
                              const newTxs = [...previewTransactions];
                              newTxs[index].categoryId = e.target.value;
                              setPreviewTransactions(newTxs);
                            }}
                            className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                          >
                            <option value="">Select a category...</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4">{tx.memo}</td>
                        <td className="px-6 py-4">{tx.debit || tx.credit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {step === 4 && <div>Step 4: Confirm & Import</div>}
        </main>

        <footer className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleNext}
            disabled={!selectedAccountId || !csvFile}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </footer>
      </div>
    </div>
  );
}
