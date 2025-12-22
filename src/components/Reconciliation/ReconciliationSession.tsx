import { useState, useEffect } from 'react';
import { Check, X, Lock, AlertCircle, Loader2, CheckCircle, Sparkles, Upload, FileText, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { reconciliationAPI, transactionAPI } from '../../lib/api';
import type { RegisterEntry } from '../../types';
import * as Dialog from '@radix-ui/react-dialog';
import { PDFViewer } from './PDFViewer';
import { TransactionContextMenu } from './TransactionContextMenu';
import { TransactionFormModal } from '../Transaction/TransactionFormModal';

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
  const [parsedTransactions, setParsedTransactions] = useState<any[] | null>(null);
  const [matchPreview, setMatchPreview] = useState<any>(null);
  const [matchingLoading, setMatchingLoading] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'pdf' | 'ledger';
    transaction?: any;
    pdfTx?: any;
  } | null>(null);

  // Transaction edit modal state
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactionToCreate, setTransactionToCreate] = useState<any>(null);

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
      // Store parsed transactions for review before matching
      setParsedTransactions(result.transactions);
    } catch (err) {
      alert('Failed to parse PDF: ' + (err as Error).message);
    } finally {
      setParsingPdf(false);
    }
  };

  const handleRunMatching = async () => {
    if (!parsedTransactions) return;
    await handleMatchTransactions(parsedTransactions);
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

  const handleClearAll = async () => {
    if (reconciledIds.size === 0) {
      alert('No transactions are currently reconciled.');
      return;
    }

    if (!confirm(`Are you sure you want to clear all ${reconciledIds.size} reconciled transactions? This will unmark them all.`)) {
      return;
    }

    // Get all posting IDs for reconciled transactions
    const postingIds: string[] = [];
    for (const txId of reconciledIds) {
      const transaction = transactions.find((t) => t.id === txId);
      if (transaction) {
        const posting = transaction.postings.find((p) => p.accountId === accountId);
        if (posting) {
          postingIds.push(posting.id);
        }
      }
    }

    try {
      await reconciliationAPI.unreconcilePostings(reconciliationId, postingIds);
      setReconciledIds(new Set());

      // Reload status
      const statusData = await reconciliationAPI.getReconciliationStatus(reconciliationId);
      setStatus(statusData);
    } catch (err) {
      alert('Failed to clear reconciliation: ' + (err as Error).message);
    }
  };

  // Context menu handlers
  const handleContextMenu = (
    e: React.MouseEvent,
    type: 'pdf' | 'ledger',
    transaction?: any,
    pdfTx?: any
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type,
      transaction,
      pdfTx,
    });
  };

  const handleEditTransaction = (txId: string) => {
    setEditingTransaction({ id: txId });
    setShowTransactionForm(true);
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      await transactionAPI.deleteTransaction(txId);
      // Refresh data
      await loadData();
      // Re-run matching if we have parsed transactions
      if (parsedTransactions) {
        await handleMatchTransactions(parsedTransactions);
      }
    } catch (err) {
      alert('Failed to delete transaction: ' + (err as Error).message);
    }
  };

  const handleAddPdfToLedger = (pdfTx: any) => {
    // Pre-populate transaction form with PDF data
    const amount = (pdfTx.debit || 0) - (pdfTx.credit || 0);
    setTransactionToCreate({
      date: new Date(pdfTx.date),
      payee: pdfTx.description,
      amount: Math.abs(amount),
      isExpense: amount > 0, // debit = expense
      memo: `Imported from PDF statement`,
    });
    setShowTransactionForm(true);
  };

  const handleTransactionSaved = async () => {
    setShowTransactionForm(false);
    setEditingTransaction(null);
    setTransactionToCreate(null);
    // Refresh data
    await loadData();
    // Re-run matching if we have parsed transactions
    if (parsedTransactions) {
      await handleMatchTransactions(parsedTransactions);
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
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">
              Transactions to Reconcile
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Click on transactions to mark them as reconciled
            </p>
          </div>
          {reconciledIds.size > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              Clear All ({reconciledIds.size})
            </button>
          )}
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
      <Dialog.Root
        open={showMatchModal}
        onOpenChange={(open) => {
          // Only allow closing via explicit close button, not from external interactions
          // This prevents the modal from closing when edit/delete dialogs are shown
          if (!open && !showTransactionForm) {
            setShowMatchModal(false);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-lg shadow-xl z-50 w-full max-w-5xl max-h-[95vh] overflow-y-auto"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => e.preventDefault()}
          >
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
              {/* Step 1: PDF Upload */}
              {!parsedTransactions && !matchPreview && (
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
                        <span>Parsing PDF...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Side-by-Side Comparison (before and after matching) */}
              {parsedTransactions && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg ${matchPreview ? 'bg-green-50 dark:bg-green-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                    <h3 className={`font-semibold mb-1 ${matchPreview ? 'text-green-900 dark:text-green-100' : 'text-blue-900 dark:text-blue-100'}`}>
                      {matchPreview ? 'Matching Complete' : 'Compare Statement with Ledger'}
                    </h3>
                    <p className={`text-sm ${matchPreview ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300'}`}>
                      {matchPreview
                        ? `Found ${matchPreview.exactMatches.length} exact and ${matchPreview.probableMatches.length} probable matches. Click rows to accept matches.`
                        : 'Review the transactions side by side, then click "Run Matching" to auto-match.'}
                    </p>
                  </div>

                  {/* Aligned side-by-side table */}
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-2">
                      {/* PDF Statement Header */}
                      <div className="bg-blue-50 dark:bg-blue-900/30 px-3 py-2 border-b border-r border-slate-200 dark:border-slate-700">
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100 text-sm">
                          PDF Statement ({parsedTransactions.length})
                        </h4>
                      </div>
                      {/* Ledger Header */}
                      <div className="bg-green-50 dark:bg-green-900/30 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                        <h4 className="font-semibold text-green-900 dark:text-green-100 text-sm">
                          Ledger ({transactions.filter(t => !reconciledIds.has(t.id)).length} unreconciled)
                        </h4>
                      </div>
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                          <tr>
                            {/* PDF columns */}
                            <th className="text-left py-1.5 px-2 font-medium text-slate-600 dark:text-slate-400 w-20">Date</th>
                            <th className="text-left py-1.5 px-2 font-medium text-slate-600 dark:text-slate-400">Description</th>
                            <th className="text-right py-1.5 px-2 font-medium text-slate-600 dark:text-slate-400 w-24">Amount</th>
                            {/* Match indicator */}
                            <th className="w-10 border-l border-slate-200 dark:border-slate-700"></th>
                            {/* Ledger columns */}
                            <th className="text-left py-1.5 px-2 font-medium text-slate-600 dark:text-slate-400 w-20">Date</th>
                            <th className="text-left py-1.5 px-2 font-medium text-slate-600 dark:text-slate-400">Payee</th>
                            <th className="text-right py-1.5 px-2 font-medium text-slate-600 dark:text-slate-400 w-24">Amount</th>
                            {matchPreview && <th className="w-16"></th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {(() => {
                            // Build aligned rows
                            const rows: Array<{
                              pdfTx: any | null;
                              ledgerTx: any | null;
                              matchType: 'exact' | 'probable' | 'possible' | 'none';
                              matchScore: number;
                              reasons: string[];
                            }> = [];

                            if (matchPreview) {
                              // After matching: show matched pairs aligned
                              const matchedPdfIndices = new Set<number>();
                              const matchedLedgerIds = new Set<string>();

                              // Add exact matches
                              matchPreview.exactMatches.forEach((match: any) => {
                                const pdfIdx = parsedTransactions.findIndex((tx: any) =>
                                  tx.description === match.statementTx.description &&
                                  tx.date.toString() === match.statementTx.date.toString()
                                );
                                if (pdfIdx >= 0) matchedPdfIndices.add(pdfIdx);
                                if (match.ledgerTx) matchedLedgerIds.add(match.ledgerTx.id);
                                rows.push({
                                  pdfTx: match.statementTx,
                                  ledgerTx: match.ledgerTx,
                                  matchType: 'exact',
                                  matchScore: match.matchScore,
                                  reasons: match.reasons,
                                });
                              });

                              // Add probable matches
                              matchPreview.probableMatches.forEach((match: any) => {
                                const pdfIdx = parsedTransactions.findIndex((tx: any) =>
                                  tx.description === match.statementTx.description &&
                                  tx.date.toString() === match.statementTx.date.toString()
                                );
                                if (pdfIdx >= 0) matchedPdfIndices.add(pdfIdx);
                                if (match.ledgerTx) matchedLedgerIds.add(match.ledgerTx.id);
                                rows.push({
                                  pdfTx: match.statementTx,
                                  ledgerTx: match.ledgerTx,
                                  matchType: 'probable',
                                  matchScore: match.matchScore,
                                  reasons: match.reasons,
                                });
                              });

                              // Add possible matches
                              matchPreview.possibleMatches.forEach((match: any) => {
                                const pdfIdx = parsedTransactions.findIndex((tx: any) =>
                                  tx.description === match.statementTx.description &&
                                  tx.date.toString() === match.statementTx.date.toString()
                                );
                                if (pdfIdx >= 0) matchedPdfIndices.add(pdfIdx);
                                if (match.ledgerTx) matchedLedgerIds.add(match.ledgerTx.id);
                                rows.push({
                                  pdfTx: match.statementTx,
                                  ledgerTx: match.ledgerTx,
                                  matchType: 'possible',
                                  matchScore: match.matchScore,
                                  reasons: match.reasons,
                                });
                              });

                              // Add unmatched PDF transactions
                              matchPreview.unmatchedStatement.forEach((tx: any) => {
                                rows.push({
                                  pdfTx: tx,
                                  ledgerTx: null,
                                  matchType: 'none',
                                  matchScore: 0,
                                  reasons: [],
                                });
                              });

                              // Add unmatched ledger transactions
                              matchPreview.unmatchedLedger.forEach((tx: any) => {
                                rows.push({
                                  pdfTx: null,
                                  ledgerTx: tx,
                                  matchType: 'none',
                                  matchScore: 0,
                                  reasons: [],
                                });
                              });
                            } else {
                              // Before matching: show side by side without alignment
                              const unreconciledLedger = transactions.filter(t => !reconciledIds.has(t.id));
                              const maxLen = Math.max(parsedTransactions.length, unreconciledLedger.length);

                              for (let i = 0; i < maxLen; i++) {
                                rows.push({
                                  pdfTx: parsedTransactions[i] || null,
                                  ledgerTx: unreconciledLedger[i] || null,
                                  matchType: 'none',
                                  matchScore: 0,
                                  reasons: [],
                                });
                              }
                            }

                            return rows.map((row, idx) => {
                              const matchColors = {
                                exact: 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30',
                                probable: 'bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30',
                                possible: 'bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30',
                                none: 'hover:bg-slate-50 dark:hover:bg-slate-700/50',
                              };

                              return (
                                <tr
                                  key={idx}
                                  className={`${matchColors[row.matchType]} ${row.matchType !== 'none' && matchPreview ? 'cursor-pointer' : ''}`}
                                  onClick={() => {
                                    if (row.matchType !== 'none' && row.ledgerTx && matchPreview) {
                                      const match = [...matchPreview.exactMatches, ...matchPreview.probableMatches, ...matchPreview.possibleMatches]
                                        .find((m: any) => m.ledgerTx?.id === row.ledgerTx.id);
                                      if (match) handleAcceptMatch(match);
                                    }
                                  }}
                                  title={row.reasons.length > 0 ? row.reasons.join(', ') : undefined}
                                >
                                  {/* PDF Transaction - right-click for context menu */}
                                  <td
                                    className="py-1.5 px-2 text-slate-700 dark:text-slate-300 whitespace-nowrap"
                                    onContextMenu={(e) => row.pdfTx && handleContextMenu(e, 'pdf', undefined, row.pdfTx)}
                                  >
                                    {row.pdfTx ? formatDate(row.pdfTx.date) : ''}
                                  </td>
                                  <td
                                    className="py-1.5 px-2 text-slate-900 dark:text-slate-100 truncate max-w-[180px]"
                                    title={row.pdfTx?.description}
                                    onContextMenu={(e) => row.pdfTx && handleContextMenu(e, 'pdf', undefined, row.pdfTx)}
                                  >
                                    {row.pdfTx?.description || ''}
                                  </td>
                                  <td
                                    className={`py-1.5 px-2 text-right font-mono whitespace-nowrap ${row.pdfTx?.credit ? 'text-green-600' : 'text-slate-700 dark:text-slate-300'}`}
                                    onContextMenu={(e) => row.pdfTx && handleContextMenu(e, 'pdf', undefined, row.pdfTx)}
                                  >
                                    {row.pdfTx ? (row.pdfTx.credit ? `-${formatCurrency(row.pdfTx.credit)}` : formatCurrency(row.pdfTx.debit || 0)) : ''}
                                  </td>

                                  {/* Match indicator */}
                                  <td className="border-l border-slate-200 dark:border-slate-700 text-center">
                                    {row.matchType === 'exact' && <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />}
                                    {row.matchType === 'probable' && <AlertCircle className="w-4 h-4 text-yellow-600 mx-auto" />}
                                    {row.matchType === 'possible' && <AlertCircle className="w-4 h-4 text-orange-600 mx-auto" />}
                                  </td>

                                  {/* Ledger Transaction - right-click for context menu */}
                                  <td
                                    className="py-1.5 px-2 text-slate-700 dark:text-slate-300 whitespace-nowrap"
                                    onContextMenu={(e) => row.ledgerTx && handleContextMenu(e, 'ledger', row.ledgerTx)}
                                  >
                                    {row.ledgerTx ? formatDate(row.ledgerTx.date) : ''}
                                  </td>
                                  <td
                                    className="py-1.5 px-2 text-slate-900 dark:text-slate-100 truncate max-w-[180px]"
                                    title={row.ledgerTx?.payee}
                                    onContextMenu={(e) => row.ledgerTx && handleContextMenu(e, 'ledger', row.ledgerTx)}
                                  >
                                    {row.ledgerTx?.payee || ''}
                                  </td>
                                  <td
                                    className={`py-1.5 px-2 text-right font-mono whitespace-nowrap text-slate-700 dark:text-slate-300`}
                                    onContextMenu={(e) => row.ledgerTx && handleContextMenu(e, 'ledger', row.ledgerTx)}
                                  >
                                    {(() => {
                                      if (!row.ledgerTx) return '';
                                      // For matched ledger transactions, get amount from postings for this account
                                      const posting = row.ledgerTx.postings?.find((p: any) => p.accountId === accountId);
                                      if (posting) {
                                        const amount = Math.abs(posting.amount);
                                        return posting.amount < 0 ? `-${formatCurrency(amount)}` : formatCurrency(amount);
                                      }
                                      // Fallback: check if it has debit/credit (RegisterEntry format)
                                      if ('debit' in row.ledgerTx || 'credit' in row.ledgerTx) {
                                        return row.ledgerTx.credit
                                          ? `-${formatCurrency(row.ledgerTx.credit)}`
                                          : formatCurrency(row.ledgerTx.debit || 0);
                                      }
                                      return '';
                                    })()}
                                  </td>

                                  {/* Accept button for matches */}
                                  {matchPreview && (
                                    <td className="py-1.5 px-2">
                                      {row.matchType !== 'none' && row.ledgerTx && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const match = [...matchPreview.exactMatches, ...matchPreview.probableMatches, ...matchPreview.possibleMatches]
                                              .find((m: any) => m.ledgerTx?.id === row.ledgerTx.id);
                                            if (match) handleAcceptMatch(match);
                                          }}
                                          className={`px-2 py-0.5 text-white rounded text-xs ${
                                            row.matchType === 'exact' ? 'bg-green-600 hover:bg-green-700' :
                                            row.matchType === 'probable' ? 'bg-yellow-600 hover:bg-yellow-700' :
                                            'bg-orange-600 hover:bg-orange-700'
                                          }`}
                                        >
                                          Accept
                                        </button>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => {
                        setParsedTransactions(null);
                        setPdfFile(null);
                        setMatchPreview(null);
                      }}
                      className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      Upload Different PDF
                    </button>
                    <div className="flex gap-2">
                      {matchPreview && matchPreview.exactMatches.length > 0 && (
                        <button
                          onClick={handleAcceptAllExact}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium text-sm"
                        >
                          Accept All Exact ({matchPreview.exactMatches.length})
                        </button>
                      )}
                      {!matchPreview && (
                        <button
                          onClick={handleRunMatching}
                          disabled={matchingLoading}
                          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md font-medium flex items-center gap-2"
                        >
                          {matchingLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Finding Matches...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              Run Matching
                            </>
                          )}
                        </button>
                      )}
                      {matchPreview && (
                        <button
                          onClick={() => {
                            setShowMatchModal(false);
                          }}
                          className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-md font-medium text-sm"
                        >
                          Done
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Context Menu */}
      {contextMenu && (
        <TransactionContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          isPdfTransaction={contextMenu.type === 'pdf'}
          pdfDescription={contextMenu.pdfTx?.description}
          transaction={contextMenu.transaction ? {
            id: contextMenu.transaction.id,
            payee: contextMenu.transaction.payee,
            date: contextMenu.transaction.date,
            amount: contextMenu.transaction.postings?.find((p: any) => p.accountId === accountId)?.amount || 0,
            metadata: contextMenu.transaction.metadata,
            originalDescription: contextMenu.transaction.metadata?.originalDescription,
          } : undefined}
          onEdit={() => {
            if (contextMenu?.transaction) {
              const txId = contextMenu.transaction.id;
              setContextMenu(null);
              handleEditTransaction(txId);
            }
          }}
          onDelete={() => {
            if (contextMenu?.transaction) {
              const txId = contextMenu.transaction.id;
              setContextMenu(null);
              handleDeleteTransaction(txId);
            }
          }}
          onAddToLedger={() => {
            if (contextMenu?.pdfTx) {
              const pdfTx = contextMenu.pdfTx;
              setContextMenu(null);
              handleAddPdfToLedger(pdfTx);
            }
          }}
        />
      )}

      {/* Transaction Edit Modal */}
      {showTransactionForm && editingTransaction && (
        <TransactionFormModal
          isOpen={showTransactionForm}
          onClose={() => {
            setShowTransactionForm(false);
            setEditingTransaction(null);
          }}
          transactionId={editingTransaction.id}
          accountId={accountId}
          onSuccess={handleTransactionSaved}
        />
      )}

      {/* Transaction Create Modal (for adding PDF transactions) */}
      {showTransactionForm && transactionToCreate && !editingTransaction && (
        <TransactionFormModal
          isOpen={showTransactionForm}
          onClose={() => {
            setShowTransactionForm(false);
            setTransactionToCreate(null);
          }}
          accountId={accountId}
          onSuccess={handleTransactionSaved}
        />
      )}
    </div>
  );
}
