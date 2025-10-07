  const [previewTransactions, setPreviewTransactions] = useState<Array<RegisterEntry & { categoryId?: string }>>([]);
  const [importMappingTemplates, setImportMappingTemplates] = useState<Array<{ name: string; mapping: CSVColumnMapping; accountId?: string }>>([]);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>('');
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [saveTemplate, setSaveTemplate] = useState<boolean>(false);

  useEffect(() => {
    // We'll ignore isOpen for now, but keep the data loading
    loadRealAccounts();
    loadCategories();
    loadMemorizedRules();
    loadImportMappingTemplates();
    // Reset state when wizard opens (only if isOpen was true, but we're debugging)
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
  }, []); // Run once on mount for debugging

  const loadImportMappingTemplates = async () => {
    try {
      const templates = await importAPI.getImportMappingTemplates();
      setImportMappingTemplates(templates);
    } catch (error) {
      console.error('Failed to load import mapping templates:', error);
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
      await importAPI.saveImportMappingTemplate(newTemplateName.trim(), columnMappings, selectedAccountId);
      alert('Mapping template saved successfully!');
      setNewTemplateName('');
      setSaveTemplate(false);
      loadImportMappingTemplates(); // Refresh templates list
    } catch (error) {
      console.error('Failed to save mapping template:', error);
      alert('Failed to save mapping template: ' + (error as Error).message);
    }
  };

  const handleTemplateSelect = (templateName: string) => {
    setSelectedTemplateName(templateName);
    const selectedTemplate = importMappingTemplates.find(t => t.name === templateName);
    if (selectedTemplate) {
      setColumnMappings(selectedTemplate.mapping);
    }
  };

  const preparePreview = async () => {
    if (!csvRows.length || !Object.keys(columnMappings).length || !selectedAccountId) {
      console.error('Missing data for preview');
      return;
    }

    const csvText = Papa.unparse(csvRows, { header: true });

    try {
      const previews = await importAPI.previewImport(
        csvText,
        columnMappings,
        selectedAccountId
      );

      // Transform ImportPreview to RegisterEntry format for display
      const transformedPreviews: Array<RegisterEntry & { categoryId?: string }> = previews.map(p => ({
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
    } catch (error) {
      console.error('Failed to prepare preview:', error);
      alert('Failed to prepare preview: ' + (error as Error).message);
    }
  };

  const handleNext = async () => {
    if (step === 1 && csvFile) {
      if (!selectedAccountId) {
        alert('Please select an account to import into.');
        return;
      }
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
      if (!Object.keys(columnMappings).length) {
        alert('Please map at least one column.');
        return;
      }
      await preparePreview();
      setStep(3);
    } else {
      setStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleImport = async () => {
    if (!selectedAccountId || !csvRows.length || !Object.keys(columnMappings).length || !previewTransactions.length) {
      alert('Missing data for import.');
      return;
    }

    // For now, assume sourceName is the CSV file name
    const sourceName = csvFile?.name || 'Import';

    try {
      // Re-transform previewTransactions back to ImportPreview format for import
      const importPreviews: ImportPreview[] = previewTransactions.map(tx => ({
        row: csvRows.find(row => row[columnMappings.payee] === tx.payee) || {}, // Find original row
        parsed: {
          date: tx.date ? new Date(tx.date) : undefined,
          payee: tx.payee,
          amount: (tx.debit ? -tx.debit : tx.credit) || 0,
          memo: tx.memo,
          reference: tx.reference,
          id: tx.id, // Pass ID for potential updates/matching
        },
        isDuplicate: tx.isDuplicate || false,
        suggestedCategory: categories.find(cat => cat.id === tx.categoryId),
        // matchedRule: tx.matchedRule, // If we add this to previewTransactions
      }));

      const result = await importAPI.importTransactions(
        importPreviews,
        selectedAccountId,
        sourceName,
        columnMappings,
        { skipDuplicates, applyRules } // Default options for now
      );

      alert(`Import successful! Imported: ${result.imported}, Skipped: ${result.skipped}`);
      onClose();
      // TODO: Refresh account data in parent component
    } catch (error) {
      console.error('Failed to import transactions:', error);
      alert('Failed to import transactions: ' + (error as Error).message);
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
              <div className="space-y-4 mb-6">
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
                        {template.name} {template.accountId ? `(for ${accounts.find(a => a.id === template.accountId)?.name || 'unknown'})` : ''}
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
                    className="rounded"
                  />
                  <label htmlFor="saveTemplate" className="text-sm font-medium">
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
                      className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                    />
                    <button
                      onClick={handleSaveTemplate}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
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
                        <td className="px-6 py-4">
                          {tx.isDuplicate && <span className="text-red-500">Yes</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-4">Confirm & Import</h3>
              <p>Ready to import {previewTransactions.length} transactions.</p>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="skipDuplicates"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="skipDuplicates" className="text-sm font-medium">
                  Skip {previewTransactions.filter(tx => tx.isDuplicate).length} identified duplicates
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="applyRules"
                  checked={applyRules}
                  onChange={(e) => setApplyRules(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="applyRules" className="text-sm font-medium">
                  Apply memorized rules during import
                </label>
              </div>
            </div>
          )}
        </main>

        <footer className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-between gap-3">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            {step < 4 && (
              <button
                onClick={handleNext}
                disabled={!selectedAccountId || !csvFile || (step === 2 && !Object.keys(columnMappings).length)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            )}
            {step === 4 && (
              <button
                onClick={handleImport}
                disabled={loading}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Importing...' : 'Import Transactions'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
