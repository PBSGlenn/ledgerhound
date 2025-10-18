import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Papa from 'papaparse';
import { X, UploadCloud, FileText, Map, Eye, CheckCircle, ArrowLeft, ArrowRight, Save, Loader2, AlertCircle, } from 'lucide-react';
import type { Account, AccountWithBalance, CSVColumnMapping, ImportPreview, RegisterEntry, MemorizedRule, } from '../../types';
import { accountAPI, importAPI, memorizedRuleAPI } from '../../lib/api';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export function ImportWizard({ isOpen, onClose, onImportSuccess }: ImportWizardProps) {
  const [step, setStep] = useState(1);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [categories, setCategories] = useState<Account[]>([]);
  const [memorizedRules, setMemorizedRules] = useState<MemorizedRule[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [columnMappings, setColumnMappings] = useState<CSVColumnMapping>({});
  const [previewTransactions, setPreviewTransactions] = useState<Array<RegisterEntry & { categoryId?: string; isDuplicate?: boolean }>>([]);
  const [importMappingTemplates, setImportMappingTemplates] = useState<Array<{ name: string; mapping: CSVColumnMapping; accountId?: string }>>([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [newTemplateName, setNewTemplateName] = useState('');
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [applyRules, setApplyRules] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('ImportWizard isOpen:', isOpen);
    if (isOpen) {
      loadInitialData();
      // Reset state when wizard opens
      setStep(1);
      setSelectedAccountId('');
      setCsvFile(null);
      setCsvHeaders([]);
      setCsvRows([]);
      setColumnMappings({});
      setPreviewTransactions([]);
      setSelectedTemplateName('');
      setNewTemplateName('');
      setSaveTemplate(false);
      setSkipDuplicates(true);
      setApplyRules(true);
      setLoading(false);
      setError(null);
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [allAccounts, allCategories, allRules, allTemplates] = await Promise.all([
        accountAPI.getAllAccountsWithBalances(),
        accountAPI.getCategories(),
        memorizedRuleAPI.getAllRules(),
        importAPI.getImportMappingTemplates(),
      ]);
      setAccounts(allAccounts);
      setCategories(allCategories);
      setMemorizedRules(allRules);
      setImportMappingTemplates(allTemplates);
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setError('Failed to load initial data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      alert('Please enter a name for the mapping template.');
      return;
    }
    if (!Object.keys(columnMappings).length) {
      alert('Please map at least one column before saving a template.');
      return;
    }
    try {
      await importAPI.saveImportMappingTemplate(
        newTemplateName.trim(),
        columnMappings,
        selectedAccountId
      );
      alert('Mapping template saved successfully!');
      setNewTemplateName('');
      setSaveTemplate(false);
      loadInitialData(); // Refresh templates list
    } catch (err) {
      console.error('Failed to save mapping template:', err);
      setError('Failed to save mapping template: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (templateName: string) => {
    setSelectedTemplateName(templateName);
    const selectedTemplate = importMappingTemplates.find((t) => t.name === templateName);
    if (selectedTemplate) {
      setColumnMappings(selectedTemplate.mapping);
      if (selectedTemplate.accountId) {
        setSelectedAccountId(selectedTemplate.accountId);
      }
    }
  };

  const preparePreview = async () => {
    if (!csvRows.length || !Object.keys(columnMappings).length || !selectedAccountId) {
      setError('Missing data for preview. Please ensure CSV is loaded, columns are mapped, and an account is selected.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const csvText = Papa.unparse(csvRows, { header: true });
      const previews = await importAPI.previewImport(csvText, columnMappings, selectedAccountId);

      const transformedPreviews: Array<RegisterEntry & { categoryId?: string; isDuplicate?: boolean }> = previews.map(p => ({
        id: p.parsed.id || Math.random().toString(), // Use parsed ID or generate temp
        date: p.parsed.date ? new Date(p.parsed.date).toISOString() : '',
        payee: p.parsed.payee || '',
        memo: p.parsed.memo || '',
        reference: p.parsed.reference || '',
        debit: p.parsed.amount && p.parsed.amount < 0 ? Math.abs(p.parsed.amount) : undefined,
        credit: p.parsed.amount && p.parsed.amount > 0 ? p.parsed.amount : undefined,
        // For now, use suggestedCategory.id, will be updated by user in UI
        categoryId: p.suggestedCategory?.id,
        isDuplicate: p.isDuplicate,
        // Add other fields as needed for display
      }));

      setPreviewTransactions(transformedPreviews);
      setStep(3); // Move to preview step
    } catch (err) {
      console.error('Failed to prepare preview:', err);
      setError('Failed to prepare preview: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    setError(null);
    if (step === 1) {
      if (!selectedAccountId) {
        setError('Please select an account to import into.');
        return;
      }
      if (!csvFile) {
        setError('Please upload a CSV file.');
        return;
      }
      setLoading(true);
      Papa.parse(csvFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setCsvHeaders(results.meta.fields || []);
          setCsvRows(results.data as any[]);
          setLoading(false);
          setStep(2);
        },
        error: (err) => {
          console.error('CSV parsing error:', err);
          setError('Failed to parse CSV file. Please check its format.');
          setLoading(false);
        },
      });
    } else if (step === 2) {
      if (!Object.keys(columnMappings).length) {
        setError('Please map at least one column.');
        return;
      }
      await preparePreview(); // This will set step to 3
    } else {
      setStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleImport = async () => {
    if (!selectedAccountId || !csvRows.length || !Object.keys(columnMappings).length || !previewTransactions.length) {
      setError('Missing data for import. Please ensure all steps are completed.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Re-transform previewTransactions back to ImportPreview format for import
      const importPreviews: ImportPreview[] = previewTransactions.map((tx) => ({
        row: csvRows.find((row) => row[columnMappings.payee || ''] === tx.payee) || {}, // Find original row
        parsed: {
          date: tx.date ? new Date(tx.date) : undefined,
          payee: tx.payee,
          amount: (tx.debit ? -tx.debit : tx.credit) || 0,
          memo: tx.memo,
          reference: tx.reference,
          id: tx.id, // Pass ID for potential updates/matching
        },
        isDuplicate: tx.isDuplicate || false,
        suggestedCategory: categories.find((cat) => cat.id === tx.categoryId),
        // matchedRule: tx.matchedRule, // If we add this to previewTransactions
      }));

      const result = await importAPI.importTransactions(
        importPreviews,
        selectedAccountId,
        csvFile?.name || 'Import', // For now, assume sourceName is the CSV file name
        columnMappings,
        { skipDuplicates, applyRules } // Default options for now
      );

      alert(`Import successful! Imported: ${result.imported}, Skipped: ${result.skipped}`);
      onImportSuccess(); // Notify parent to refresh data
      onClose();
    } catch (err) {
      console.error('Failed to import transactions:', err);
      setError('Failed to import transactions: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const getStepIcon = (stepNum: number, currentStep: number) => {
    if (stepNum < currentStep) {
      return <CheckCircle className="w-4 h-4 text-white" />;
    } else if (stepNum === currentStep) {
      return <span className="font-bold text-white">{stepNum}</span>;
    }
    return <span className="font-bold text-slate-500">{stepNum}</span>;
  };

  const getStepClass = (stepNum: number, currentStep: number) => {
    if (stepNum < currentStep) {
      return 'bg-blue-500';
    } else if (stepNum === currentStep) {
      return 'bg-blue-600';
    }
    return 'bg-slate-200 dark:bg-slate-700';
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[99] bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col z-[100] border border-slate-200 dark:border-slate-700 bg-pink-300 border-4 border-pink-700">
          <header className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">CSV Import Wizard</h2>
            <Dialog.Close asChild>
              <button
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </header>

          {/* Progress Indicator */}
          <div className="flex justify-around p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${getStepClass(1, step)}`}>
                {getStepIcon(1, step)}
              </div>
              <span className={`text-sm font-medium ${step >= 1 ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                Upload CSV
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${getStepClass(2, step)}`}>
                {getStepIcon(2, step)}
              </div>
              <span className={`text-sm font-medium ${step >= 2 ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                Map Columns
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${getStepClass(3, step)}`}>
                {getStepIcon(3, step)}
              </div>
              <span className={`text-sm font-medium ${step >= 3 ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                Preview
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${getStepClass(4, step)}`}>
                {getStepIcon(4, step)}
              </div>
              <span className={`text-sm font-medium ${step >= 4 ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                Confirm
              </span>
            </div>
          </div>

          <main className="flex-1 p-6 overflow-y-auto">
            {error && (
              <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="ml-3 text-slate-600 dark:text-slate-400">Loading...</span>
              </div>
            )}

            {!loading && step === 1 && (
              <div className="space-y-6">
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
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center hover:border-blue-500 transition-colors cursor-pointer">
                  <label htmlFor="csv-file" className="block cursor-pointer">
                    <UploadCloud className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <span className="text-lg font-medium text-slate-700 dark:text-slate-300">
                      Drag & Drop your CSV here, or{' '}
                      <span className="text-blue-600 hover:text-blue-700">browse</span>
                    </span>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {csvFile ? csvFile.name : 'Only .csv files are supported'}
                    </p>
                    <input
                      id="csv-file"
                      type="file"
                      accept=".csv"
                      onChange={(e) => setCsvFile(e.target.files ? e.target.files[0] : null)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
            {!loading && step === 2 && (
              <div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Map className="w-5 h-5 text-blue-600" /> Map Columns
                </h3>
                <div className="space-y-4 mb-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div>
                    <label htmlFor="template-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Load Mapping Template
                    </label>
                    <select
                      id="template-select"
                      value={selectedTemplateName}
                      onChange={(e) => handleTemplateSelect(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white transition-colors"
                    >
                      <option value="">-- Select a template --</option>
                      {importMappingTemplates.map((template) => (
                        <option key={template.name} value={template.name}>
                          {template.name}{' '}
                          {template.accountId
                            ? `(for ${accounts.find((a) => a.id === template.accountId)?.name || 'unknown'})`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="saveTemplate"
                      checked={saveTemplate}
                      onChange={(e) => setSaveTemplate(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="saveTemplate" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Save current mapping as new template
                    </label>
                  </div>
                  {saveTemplate && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Template Name"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={handleSaveTemplate}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" /> Save
                      </button>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
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
                        Map "{header}" to:
                      </label>
                      <select
                        id={`mapping-${header}`}
                        value={Object.keys(columnMappings).find((key) => columnMappings[key] === header) || ''}
                        onChange={(e) => {
                          const newMappings = { ...columnMappings };
                          // Remove previous mapping for this header
                          Object.keys(newMappings).forEach((key) => {
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
                        <option value="amount">Amount (single column)</option>
                        <option value="debit">Debit (for two-column format)</option>
                        <option value="credit">Credit (for two-column format)</option>
                        <option value="memo">Memo</option>
                        <option value="reference">Reference</option>
                        <option value="externalId">External ID (for deduplication)</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!loading && step === 3 && (
              <div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-600" /> Preview & Edit
                </h3>
                <div className="flex items-center gap-4 mb-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="skipDuplicates"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="skipDuplicates" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Skip {previewTransactions.filter((tx) => tx.isDuplicate).length} identified duplicates
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="applyRules"
                      checked={applyRules}
                      onChange={(e) => setApplyRules(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="applyRules" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Apply memorized rules during import
                    </label>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
                    <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-400">
                      <tr>
                        <th scope="col" className="px-6 py-3">Date</th>
                        <th scope="col" className="px-6 py-3">Payee</th>
                        <th scope="col" className="px-6 py-3">Amount</th>
                        <th scope="col" className="px-6 py-3">Category</th>
                        <th scope="col" className="px-6 py-3">Memo</th>
                        <th scope="col" className="px-6 py-3">Duplicate</th>
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
                              className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 font-semibold">
                            {(tx.debit ? '-' : '') + (tx.debit || tx.credit)}
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={tx.categoryId || ''}
                              onChange={(e) => {
                                const newTxs = [...previewTransactions];
                                newTxs[index].categoryId = e.target.value;
                                setPreviewTransactions(newTxs);
                              }}
                              className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">Select a category...</option>
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={tx.memo || ''}
                              onChange={(e) => {
                                const newTxs = [...previewTransactions];
                                newTxs[index].memo = e.target.value;
                                setPreviewTransactions(newTxs);
                              }}
                              className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4 text-center">
                            {tx.isDuplicate && (
                              <span className="inline-flex items-center gap-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full text-xs font-medium">
                                <AlertCircle className="w-3 h-3" /> Duplicate
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {!loading && step === 4 && (
              <div className="space-y-4 text-center py-12">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Ready to Import!</h3>
                <p className="text-lg text-slate-600 dark:text-slate-400">
                  You are about to import {previewTransactions.length} transactions into your account.
                </p>
                <div className="flex items-center justify-center gap-4 mt-6">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="skipDuplicatesConfirm"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="skipDuplicatesConfirm" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Skip {previewTransactions.filter((tx) => tx.isDuplicate).length} identified duplicates
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="applyRulesConfirm"
                      checked={applyRules}
                      onChange={(e) => setApplyRules(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="applyRulesConfirm" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Apply memorized rules during import
                    </label>
                  </div>
                </div>
              </div>
            )}
          </main>

          <footer className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-between gap-3">
            <button
              onClick={handleBack}
              disabled={step === 1 || loading}
              className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              {step < 4 && (
                <button
                  onClick={handleNext}
                  disabled={
                    loading ||
                    (step === 1 && (!selectedAccountId || !csvFile)) ||
                    (step === 2 && !Object.keys(columnMappings).length)
                  }
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              )}
              {step === 4 && (
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Importing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" /> Import Transactions
                    </>
                  )}
                </button>
              )}
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
