import { useState } from 'react';
import { Plus, Upload, GitCompare, BarChart3, Settings } from 'lucide-react';
import type { AccountWithBalance } from '../../types';
import { TransactionFormModal } from '../Transaction/TransactionFormModal';

interface TopBarProps {
  selectedAccount?: AccountWithBalance;
  onRefresh?: () => void;
  onImportClick?: () => void;
}

export function TopBar({ selectedAccount, onRefresh, onImportClick }: TopBarProps) {
  const [showTransactionForm, setShowTransactionForm] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-5 shadow-sm">
      <div className="flex items-center justify-between">
        {/* Account info */}
        <div>
          {selectedAccount ? (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                  {selectedAccount.name}
                </h1>
                {selectedAccount.isBusinessDefault && (
                  <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-full font-semibold">
                    BUSINESS ACCOUNT
                  </span>
                )}
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    Current:
                  </span>
                  <span className={`text-lg font-bold tabular-nums ${
                    selectedAccount.currentBalance >= 0
                      ? 'text-slate-900 dark:text-white'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(selectedAccount.currentBalance)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    Cleared:
                  </span>
                  <span className="text-base font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                    {formatCurrency(selectedAccount.clearedBalance)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Dashboard
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Select an account to get started
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTransactionForm(true)}
            disabled={!selectedAccount}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-blue-500 disabled:hover:to-indigo-600 transition-all duration-150 shadow-sm hover:shadow flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Transaction
          </button>
          <button
            onClick={onImportClick}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2"
          >
          <button className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2">
            <GitCompare className="w-4 h-4" />
            Reconcile
          </button>
          <button className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Reports
          </button>
        </div>
      </div>

      {/* Transaction Form Modal */}
      <TransactionFormModal
        isOpen={showTransactionForm}
        onClose={() => setShowTransactionForm(false)}
        accountId={selectedAccount?.id}
        onSuccess={() => {
          if (onRefresh) {
            onRefresh();
          }
        }}
      />
    </header>
  );
}
