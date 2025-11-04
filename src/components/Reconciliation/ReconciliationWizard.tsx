import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, GitCompare, Calendar, DollarSign, Loader2, Upload, FileText, AlertCircle } from 'lucide-react';
import { reconciliationAPI } from '../../lib/api';
import type { AccountWithBalance } from '../../types';
import { PDFViewer } from './PDFViewer';

interface ReconciliationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  account: AccountWithBalance;
  onReconciliationStarted: (reconciliationId: string) => void;
}

export function ReconciliationWizard({
  isOpen,
  onClose,
  account,
  onReconciliationStarted,
}: ReconciliationWizardProps) {
  const [statementStartDate, setStatementStartDate] = useState('');
  const [statementEndDate, setStatementEndDate] = useState('');
  const [statementStartBalance, setStatementStartBalance] = useState('');
  const [statementEndBalance, setStatementEndBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [parsingPdf, setParsingPdf] = useState(false);
  const [pdfParseError, setPdfParseError] = useState<string | null>(null);
  const [pdfConfidence, setPdfConfidence] = useState<'high' | 'medium' | 'low' | null>(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const reconciliation = await reconciliationAPI.startReconciliation({
        accountId: account.id,
        statementStartDate: new Date(statementStartDate),
        statementEndDate: new Date(statementEndDate),
        statementStartBalance: parseFloat(statementStartBalance),
        statementEndBalance: parseFloat(statementEndBalance),
        notes: notes || undefined,
      });

      onReconciliationStarted(reconciliation.id);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setPdfParseError('Please select a PDF file');
      return;
    }

    setPdfFile(file);
    setPdfParseError(null);
    setPdfConfidence(null);

    // Auto-parse the PDF
    await handleParsePdf(file);
  };

  const handleParsePdf = async (file: File) => {
    setParsingPdf(true);
    setPdfParseError(null);

    try {
      const result = await reconciliationAPI.parsePDF(file);

      // Auto-populate form fields
      if (result.info.statementPeriod) {
        const startDate = result.info.statementPeriod.start;
        const endDate = result.info.statementPeriod.end;
        setStatementStartDate(startDate.toISOString().split('T')[0]);
        setStatementEndDate(endDate.toISOString().split('T')[0]);
      }

      if (result.info.openingBalance !== undefined) {
        setStatementStartBalance(result.info.openingBalance.toString());
      }

      if (result.info.closingBalance !== undefined) {
        setStatementEndBalance(result.info.closingBalance.toString());
      }

      if (result.info.accountNumber) {
        setNotes(`Account: ${result.info.accountNumber}`);
      }

      setPdfConfidence(result.confidence);
    } catch (err) {
      setPdfParseError((err as Error).message);
    } finally {
      setParsingPdf(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-lg shadow-xl z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <GitCompare className="w-6 h-6 text-blue-600" />
              <Dialog.Title className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Start Reconciliation
              </Dialog.Title>
            </div>
            <Dialog.Close className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X className="w-6 h-6" />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Account Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Reconciling: {account.name}
              </h3>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                Current Balance: {formatCurrency(account.currentBalance)}
              </div>
            </div>

            {/* PDF Upload */}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6">
              <div className="flex items-center justify-center gap-3 mb-3">
                <Upload className="w-5 h-5 text-slate-500" />
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  Upload Bank Statement (Optional)
                </h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-4">
                Upload a PDF statement to auto-fill dates and balances
              </p>

              <div className="flex flex-col items-center gap-3">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Choose PDF File
                  </div>
                </label>

                {pdfFile && (
                  <div className="w-full">
                    <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700 rounded-md">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-slate-900 dark:text-slate-100">{pdfFile.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPdfViewer(!showPdfViewer)}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        {showPdfViewer ? 'Hide' : 'View'} PDF
                      </button>
                    </div>

                    {parsingPdf && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-blue-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Parsing PDF...</span>
                      </div>
                    )}

                    {pdfConfidence && !parsingPdf && (
                      <div className={`flex items-center gap-2 mt-2 text-sm ${
                        pdfConfidence === 'high' ? 'text-green-600' :
                        pdfConfidence === 'medium' ? 'text-yellow-600' :
                        'text-orange-600'
                      }`}>
                        <AlertCircle className="w-4 h-4" />
                        <span>
                          Parsed with {pdfConfidence} confidence - please verify values below
                        </span>
                      </div>
                    )}

                    {pdfParseError && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
                        <AlertCircle className="w-4 h-4" />
                        <span>{pdfParseError}</span>
                      </div>
                    )}

                    {showPdfViewer && (
                      <div className="mt-3">
                        <PDFViewer file={pdfFile} className="max-h-96" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Statement Date Range */}
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Statement Period
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={statementStartDate}
                    onChange={(e) => setStatementStartDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={statementEndDate}
                    onChange={(e) => setStatementEndDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Statement Balances */}
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Statement Balances
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Opening Balance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={statementStartBalance}
                    onChange={(e) => setStatementStartBalance(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Closing Balance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={statementEndBalance}
                    onChange={(e) => setStatementEndBalance(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any notes about this reconciliation..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
                <p className="font-semibold">Error</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-md font-medium flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <GitCompare className="w-4 h-4" />
                    Start Reconciliation
                  </>
                )}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
