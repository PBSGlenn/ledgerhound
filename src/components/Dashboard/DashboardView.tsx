import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Wallet, AlertCircle, Clock, Briefcase, User } from 'lucide-react';
import type { AccountWithBalance, RegisterEntry } from '../../types';
import { transactionAPI } from '../../lib/api';

interface DashboardProps {
  accounts: AccountWithBalance[];
  onSelectAccount: (accountId: string) => void;
  onShowAccountSetup?: () => void;
}

interface Summary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  personalNetWorth: number;
  businessNetWorth: number;
  totalIncome: number;
  totalExpenses: number;
  gstLiability: number;
}

export function DashboardView({ accounts, onSelectAccount, onShowAccountSetup: _onShowAccountSetup }: DashboardProps) {
  const [recentTransactions, setRecentTransactions] = useState<RegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecentTransactions();
  }, [accounts]);

  const loadRecentTransactions = async () => {
    setLoading(true);
    try {
      // Get recent transactions from all accounts
      const allTransactions: RegisterEntry[] = [];

      for (const account of accounts.filter(a => a.type === 'ASSET' || a.type === 'LIABILITY')) {
        try {
          const entries = await transactionAPI.getRegisterEntries(account.id);
          allTransactions.push(...entries.slice(0, 5)); // Get last 5 from each
        } catch (err) {
          console.error(`Failed to load transactions for ${account.name}:`, err);
        }
      }

      // Sort by date descending and take top 10
      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentTransactions(allTransactions.slice(0, 10));
    } catch (error) {
      console.error('Failed to load recent transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (): Summary => {
    const assets = accounts.filter(a => a.type === 'ASSET');
    const liabilities = accounts.filter(a => a.type === 'LIABILITY');
    const income = accounts.filter(a => a.type === 'INCOME');
    const expenses = accounts.filter(a => a.type === 'EXPENSE');

    const totalAssets = assets.reduce((sum, a) => sum + a.currentBalance, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + Math.abs(a.currentBalance), 0);
    const netWorth = totalAssets - totalLiabilities;

    // Split personal vs business
    const personalAssets = assets.filter(a => !a.isBusinessDefault).reduce((sum, a) => sum + a.currentBalance, 0);
    const personalLiabilities = liabilities.filter(a => !a.isBusinessDefault).reduce((sum, a) => sum + Math.abs(a.currentBalance), 0);
    const businessAssets = assets.filter(a => a.isBusinessDefault).reduce((sum, a) => sum + a.currentBalance, 0);
    const businessLiabilities = liabilities.filter(a => a.isBusinessDefault).reduce((sum, a) => sum + Math.abs(a.currentBalance), 0);

    const personalNetWorth = personalAssets - personalLiabilities;
    const businessNetWorth = businessAssets - businessLiabilities;

    const totalIncome = income.reduce((sum, a) => sum + a.currentBalance, 0);
    const totalExpenses = expenses.reduce((sum, a) => sum + a.currentBalance, 0);

    // GST liability from GST Control account
    const gstControl = accounts.find(a => a.name.includes('GST Control'));
    const gstLiability = gstControl ? Math.abs(gstControl.currentBalance) : 0;

    return {
      totalAssets,
      totalLiabilities,
      netWorth,
      personalNetWorth,
      businessNetWorth,
      totalIncome,
      totalExpenses,
      gstLiability,
    };
  };

  const summary = calculateSummary();
  const hasBusinessAccounts = accounts.some(a => a.isBusinessDefault);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-AU', {
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400">Your financial overview at a glance</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Worth */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Net Worth</span>
            <Wallet className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(summary.netWorth)}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <TrendingUp className="w-3 h-3" />
            <span>Assets: {formatCurrency(summary.totalAssets)}</span>
          </div>
        </div>

        {/* Cash Flow */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Cash Flow</span>
            {summary.totalIncome >= summary.totalExpenses ? (
              <TrendingUp className="w-5 h-5 text-green-500" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-500" />
            )}
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(summary.totalIncome - summary.totalExpenses)}
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs">
            <span className="text-green-600 dark:text-green-400">
              ↑ {formatCurrency(summary.totalIncome)}
            </span>
            <span className="text-red-600 dark:text-red-400">
              ↓ {formatCurrency(summary.totalExpenses)}
            </span>
          </div>
        </div>

        {/* Personal */}
        {hasBusinessAccounts && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Personal</span>
              <User className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(summary.personalNetWorth)}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Net worth (personal accounts)
            </div>
          </div>
        )}

        {/* Business / GST */}
        {hasBusinessAccounts ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Business</span>
              <Briefcase className="w-5 h-5 text-purple-500" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(summary.businessNetWorth)}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              GST Liability: {formatCurrency(summary.gstLiability)}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Liabilities</span>
              <AlertCircle className="w-5 h-5 text-orange-500" />
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(summary.totalLiabilities)}
            </div>
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Total owed
            </div>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Transactions</h2>
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">Last 10</span>
          </div>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {loading ? (
            <div className="p-4 text-center text-slate-500 dark:text-slate-400">
              Loading transactions...
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="p-4 text-center text-slate-500 dark:text-slate-400">
              No transactions yet. Create your first transaction to get started!
            </div>
          ) : (
            recentTransactions.map((entry) => (
              <div
                key={entry.id}
                className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
                onClick={() => onSelectAccount(entry.accountId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-white truncate">
                        {entry.payee || 'Unknown'}
                      </span>
                      {entry.isBusiness && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          <Briefcase className="w-3 h-3 mr-1" />
                          Business
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-500 dark:text-slate-400">
                      <span>{formatDate(entry.date)}</span>
                      <span>•</span>
                      <span className="truncate">{entry.categoryName || entry.memo || 'No category'}</span>
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div className={`font-semibold ${
                      entry.amount >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {entry.amount >= 0 ? '+' : ''}{formatCurrency(entry.amount)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Bal: {formatCurrency(entry.balance)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions (if no transactions) */}
      {!loading && recentTransactions.length === 0 && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Get Started</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                1
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Select an account</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Click on any account in the sidebar to view its register
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                2
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Add transactions</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Click "+ New Transaction" to record income or expenses
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                3
              </div>
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Track your finances</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  View reports, reconcile accounts, and manage GST (for business)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
