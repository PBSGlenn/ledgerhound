import { useState, useEffect } from 'react';
import { GitCompare, Plus, Loader2 } from 'lucide-react';
import { ReconciliationWizard } from './ReconciliationWizard';
import { ReconciliationSession } from './ReconciliationSession';
import { reconciliationAPI } from '../../lib/api';
import type { AccountWithBalance } from '../../types';

interface ReconciliationViewProps {
  account: AccountWithBalance;
}

export function ReconciliationView({ account }: ReconciliationViewProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [activeReconciliationId, setActiveReconciliationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for in-progress reconciliation on mount
  useEffect(() => {
    const checkInProgress = async () => {
      try {
        const inProgress = await reconciliationAPI.getInProgressReconciliation(account.id);
        if (inProgress) {
          setActiveReconciliationId(inProgress.id);
        }
      } catch (error) {
        console.error('Failed to check for in-progress reconciliation:', error);
      } finally {
        setLoading(false);
      }
    };
    checkInProgress();
  }, [account.id]);

  const handleReconciliationStarted = (reconciliationId: string) => {
    setActiveReconciliationId(reconciliationId);
    setShowWizard(false);
  };

  const handleReconciliationComplete = () => {
    setActiveReconciliationId(null);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitCompare className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                Reconciliation
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Reconcile {account.name} with your bank statement
              </p>
            </div>
          </div>

          {!loading && !activeReconciliationId && (
            <button
              onClick={() => setShowWizard(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Start Reconciliation
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : activeReconciliationId ? (
          <ReconciliationSession
            reconciliationId={activeReconciliationId}
            accountId={account.id}
            onComplete={handleReconciliationComplete}
          />
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
              <GitCompare className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                No Active Reconciliation
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Start a new reconciliation to match your transactions with your bank statement.
              </p>
              <button
                onClick={() => setShowWizard(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Start Reconciliation
              </button>
            </div>

            {/* Instructions */}
            <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                How to Reconcile
              </h3>
              <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <li className="flex gap-2">
                  <span className="font-semibold">1.</span>
                  <span>Have your bank statement ready with opening and closing balances</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold">2.</span>
                  <span>Click "Start Reconciliation" and enter your statement details</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold">3.</span>
                  <span>Click on transactions to mark them as reconciled</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold">4.</span>
                  <span>When the difference reaches $0.00, lock the reconciliation</span>
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Wizard Modal */}
      <ReconciliationWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        account={account}
        onReconciliationStarted={handleReconciliationStarted}
      />
    </div>
  );
}
