import { useState, useEffect } from 'react';
import { Check, X, Lock, AlertCircle, Loader2, CheckCircle, Sparkles, Upload, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { reconciliationAPI, transactionAPI } from '../../lib/api';
import type { RegisterEntry } from '../../types';
import * as Dialog from '@radix-ui/react-dialog';
import { PDFViewer } from './PDFViewer';

interface ReconciliationSessionProps {
  reconciliationId: string;
  accountId: string;
  onComplete: () => void;
}

export function ReconciliationSession({
  reconciliationId,
  accountId,
  onComplete,
}: ReconciliationSessionProps) {
  const [transactions, setTransactions] = useState<RegisterEntry[]>([]);
  const [reconciledIds, setReconciledIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lockLoading, setLockLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Smart matching state
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [parsingPdf, setParsingPdf] = useState(false);
  const [matchPreview, setMatchPreview] = useState<any>(null);
  const [matchingLoading, setMatchingLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [reconciliationId, accountId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [reconciliation, statusData] = await Promise.all([
        reconciliationAPI.getReconciliation(reconciliationId),
        reconciliationAPI.getReconciliationStatus(reconciliationId),
      ]);

      setStatus(statusData);

      // Load transactions for the statement period
      const txns = await transactionAPI.getRegisterEntries(accountId, {
        dateFrom: new Date(reconciliation.statementStartDate),
        dateTo: new Date(reconciliation.statementEndDate),
      });

      setTransactions(txns);

      // Set initially reconciled IDs
      const reconciled = new Set<string>();
      txns.forEach((txn) => {
        const posting = txn.postings.find((p) => p.accountId === accountId);
        if (posting?.reconciled) {
          reconciled.add(txn.id);
        }
      });
      setReconciledIds(reconciled);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleReconciled = async (transactionId: string) => {
    const transaction = transactions.find((t) => t.id === transactionId);
    if (!transaction) return;

    const posting = transaction.postings.find((p) => p.accountId === accountId);
    if (!posting) return;

    try {
      if (reconciledIds.has(transactionId)) {
        await reconciliationAPI.unreconcilePostings(reconciliationId, [posting.id]);
        setReconciledIds((prev) => {
          const next = new Set(prev);
          next.delete(transactionId);
          return next;
        });
      } else {
        await reconciliationAPI.reconcilePostings(reconciliationId, [posting.id]);
        setReconciledIds((prev) => new Set(prev).add(transactionId));
      }

      // Reload status
      const statusData = await reconciliationAPI.getReconciliationStatus(reconciliationId);
      setStatus(statusData);
    } catch (err) {
      alert('Failed to toggle reconciliation: ' + (err as Error).message);
    }
  };

  const handleLock = async () => {
    if (!status?.isBalanced) {
      alert('Cannot lock reconciliation until it is balanced.');
      return;
    }

    setLockLoading(true);
    try {
      await reconciliationAPI.lockReconciliation(reconciliationId);
      alert('Reconciliation locked successfully!');
      onComplete();
    } catch (err) {
      alert('Failed to lock reconciliation: ' + (err as Error).message);
    } finally {
      setLockLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file');
      return;
    }

    setPdfFile(file);
    await handleParsePdf(file);
  };

  const handleParsePdf = async (file: File) => {
    setParsingPdf(true);
    try {
      const result = await reconciliationAPI.parsePDF(file);

      // Now match the parsed transactions
      await handleMatchTransactions(result.transactions);
    } catch (err) {
      alert('Failed to parse PDF: ' + (err as Error).message);
    } finally {
      setParsingPdf(false);
    }
  };

  const handleMatchTransactions = async (statementTransactions: any[]) => {
    setMatchingLoading(true);
    try {
      const preview = await reconciliationAPI.matchTransactions(
        reconciliationId,
        statementTransactions
      );
      setMatchPreview(preview);
    } catch (err) {
      alert('Failed to match transactions: ' + (err as Error).message);
    } finally {
      setMatchingLoading(false);
    }
  };

  const handleAcceptMatch = async (match: any) => {
    if (!match.ledgerTx) return;

    const posting = match.ledgerTx.postings.find((p: any) => p.accountId === accountId);
    if (!posting) return;

    try {
      await reconciliationAPI.reconcilePostings(reconciliationId, [posting.id]);
      setReconciledIds((prev) => new Set(prev).add(match.ledgerTx.id));

      // Reload status
      const statusData = await reconciliationAPI.getReconciliationStatus(reconciliationId);
      setStatus(statusData);

      // Remove from preview
      if (matchPreview) {
        setMatchPreview({
          ...matchPreview,
          exactMatches: matchPreview.exactMatches.filter((m: any) => m !== match),
          probableMatches: matchPreview.probableMatches.filter((m: any) => m !== match),
          possibleMatches: matchPreview.possibleMatches.filter((m: any) => m !== match),
        });
      }
    } catch (err) {
      alert('Failed to accept match: ' + (err as Error).message);
    }
  };

  const handleAcceptAllExact = async () => {
    if (!matchPreview?.exactMatches?.length) return;

    const postingIds: string[] = [];
    const txIds: string[] = [];

    for (const match of matchPreview.exactMatches) {
      if (match.ledgerTx) {
        const posting = match.ledgerTx.postings.find((p: any) => p.accountId === accountId);
        if (posting) {
          postingIds.push(posting.id);
          txIds.push(match.ledgerTx.id);
        }
      }
    }

    try {
      await reconciliationAPI.reconcilePostings(reconciliationId, postingIds);
      setReconciledIds((prev) => {
        const next = new Set(prev);
        txIds.forEach((id) => next.add(id));
        return next;
      });

      // Reload status
      const statusData = await reconciliationAPI.getReconciliationStatus(reconciliationId);
      setStatus(statusData);

      // Clear exact matches from preview
      setMatchPreview({
        ...matchPreview,
        exactMatches: [],
      });
    } catch (err) {
      alert('Failed to accept matches: ' + (err as Error).message);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return format(new Date(date), 'dd/MM/yyyy');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="font-semibold text-red-900 dark:text-red-100">Error</p>
        <p className="text-sm text-red-800 dark:text-red-200 mt-1">{error}</p>
      </div>
    );
  }

  const isBalanced = status?.isBalanced ?? false;
  const difference = status?.difference ?? 0;

  return (
    <div className="space-y-6">
      {/* Status Panel */}
      <div className={`p-6 rounded-lg border-2 ${
        isBalanced
          ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
          : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
      }`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {isBalanced ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            )}
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {isBalanced ? 'Balanced!' : 'Not Balanced'}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {isBalanced
                  ? 'Your reconciliation is balanced and ready to lock.'
                  : 'Continue marking transactions to balance your reconciliation.'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowMatchModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Auto-Match
            </button>
            <button
              onClick={handleLock}
              disabled={!isBalanced || lockLoading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white rounded-md font-medium flex items-center gap-2"
            >
              {lockLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Locking...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Lock Reconciliation
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Statement Balance</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(status?.statementBalance ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Cleared Balance</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(status?.clearedBalance ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Difference</p>
            <p className={`text-xl font-bold ${
              Math.abs(difference) < 0.01
                ? 'text-green-600'
                : 'text-red-600'
            }`}>
              {formatCurrency(difference)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Reconciled</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {reconciledIds.size} / {transactions.length}
            </p>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">
            Transactions to Reconcile
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Click on transactions to mark them as reconciled
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400 w-12"></th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Payee</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Memo</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Debit</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Credit</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn, idx) => {
                const isReconciled = reconciledIds.has(txn.id);
                return (
                  <tr
                    key={txn.id}
                    onClick={() => toggleReconciled(txn.id)}
                    className={`border-b border-slate-100 dark:border-slate-800 cursor-pointer transition-colors ${
                      isReconciled
                        ? 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                        isReconciled
                          ? 'bg-green-600 border-green-600'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {isReconciled && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {formatDate(txn.date)}
                    </td>
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">
                      {txn.payee}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-sm">
                      {txn.memo || '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                      {txn.debit ? formatCurrency(txn.debit) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                      {txn.credit ? formatCurrency(txn.credit) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {transactions.length === 0 && (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            No transactions found in this statement period
          </div>
        )}
      </div>

      {/* Auto-Match Modal */}
      <Dialog.Root open={showMatchModal} onOpenChange={setShowMatchModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-lg shadow-xl z-50 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-blue-600" />
                <div>
                  <Dialog.Title className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Smart Transaction Matching
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-slate-600 dark:text-slate-400">
                    Upload your bank statement to automatically match transactions
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-6 h-6" />
              </Dialog.Close>
            </div>

            <div className="p-6 space-y-6">
              {/* PDF Upload */}
              {!matchPreview && (
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8">
                  <div className="flex flex-col items-center gap-4">
                    <Upload className="w-12 h-12 text-slate-400" />
                    <div className="text-center">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                        Upload Bank Statement PDF
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Upload your PDF statement to extract and match transactions
                      </p>
                    </div>

                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <div className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Choose PDF File
                      </div>
                    </label>

                    {parsingPdf && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Parsing PDF and matching transactions...</span>
                      </div>
                    )}

                    {matchingLoading && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Finding matches...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Match Results */}
              {matchPreview && (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                      Matching Summary
                    </h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-blue-700 dark:text-blue-300">Total Statement Transactions</p>
                        <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                          {matchPreview.summary.totalStatement}
                        </p>
                      </div>
                      <div>
                        <p className="text-blue-700 dark:text-blue-300">Matched</p>
                        <p className="text-lg font-bold text-green-600">
                          {matchPreview.summary.totalMatched}
                        </p>
                      </div>
                      <div>
                        <p className="text-blue-700 dark:text-blue-300">Unmatched</p>
                        <p className="text-lg font-bold text-orange-600">
                          {matchPreview.summary.totalUnmatched}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Exact Matches */}
                  {matchPreview.exactMatches?.length > 0 && (
                    <div className="border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 border-b border-green-200 dark:border-green-800 flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5" />
                            Exact Matches ({matchPreview.exactMatches.length})
                          </h3>
                          <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                            High confidence - these transactions match perfectly
                          </p>
                        </div>
                        <button
                          onClick={handleAcceptAllExact}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium"
                        >
                          Accept All
                        </button>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {matchPreview.exactMatches.map((match: any, idx: number) => (
                          <div key={idx} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs font-medium rounded">
                                    {match.matchScore}% match
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Statement</p>
                                    <p className="font-medium text-slate-900 dark:text-slate-100">
                                      {match.statementTx.description}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                      {formatDate(match.statementTx.date)} • {formatCurrency(match.statementTx.debit || match.statementTx.credit || 0)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Ledger</p>
                                    <p className="font-medium text-slate-900 dark:text-slate-100">
                                      {match.ledgerTx?.payee}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                      {match.ledgerTx && formatDate(match.ledgerTx.date)}
                                    </p>
                                  </div>
                                </div>
                                {match.reasons?.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      {match.reasons.join(', ')}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => handleAcceptMatch(match)}
                                className="ml-4 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                              >
                                Accept
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Probable Matches */}
                  {matchPreview.probableMatches?.length > 0 && (
                    <div className="border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 border-b border-yellow-200 dark:border-yellow-800">
                        <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 flex items-center gap-2">
                          <AlertCircle className="w-5 h-5" />
                          Probable Matches ({matchPreview.probableMatches.length})
                        </h3>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          Medium confidence - please review before accepting
                        </p>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {matchPreview.probableMatches.map((match: any, idx: number) => (
                          <div key={idx} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs font-medium rounded">
                                    {match.matchScore}% match
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Statement</p>
                                    <p className="font-medium text-slate-900 dark:text-slate-100">
                                      {match.statementTx.description}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                      {formatDate(match.statementTx.date)} • {formatCurrency(match.statementTx.debit || match.statementTx.credit || 0)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Ledger</p>
                                    <p className="font-medium text-slate-900 dark:text-slate-100">
                                      {match.ledgerTx?.payee}
                                    </p>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                      {match.ledgerTx && formatDate(match.ledgerTx.date)}
                                    </p>
                                  </div>
                                </div>
                                {match.reasons?.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      {match.reasons.join(', ')}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => handleAcceptMatch(match)}
                                className="ml-4 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm"
                              >
                                Accept
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => {
                        setMatchPreview(null);
                        setPdfFile(null);
                        setShowMatchModal(false);
                      }}
                      className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
