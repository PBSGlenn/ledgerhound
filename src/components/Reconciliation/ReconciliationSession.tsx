import { useState, useEffect } from 'react';
import { Check, X, Lock, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { reconciliationAPI, transactionAPI } from '../../lib/api';
import type { RegisterEntry } from '../../types';

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
    </div>
  );
}
