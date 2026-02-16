import { Building2, CreditCard, Landmark, Scale, CheckCircle, AlertTriangle } from 'lucide-react';
import type { BalanceSheet } from '../../types';

interface BalanceSheetReportProps {
  data: BalanceSheet;
}

export function BalanceSheetReport({ data }: BalanceSheetReportProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Balance Sheet
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              As of {formatDate(data.asOfDate)}
            </p>
          </div>
          {data.isBalanced ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/20 rounded-full">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">Balanced</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/20 rounded-full">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-sm font-medium text-red-700 dark:text-red-400">Unbalanced</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Assets */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Assets</h3>
          </div>
          <div className="space-y-2">
            {data.assets.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center pl-6 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded">
                <span className="text-slate-700 dark:text-slate-300">
                  {item.accountName}
                  {item.isReal && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                      Bank
                    </span>
                  )}
                </span>
                <span className="font-mono text-blue-600 dark:text-blue-400">
                  {formatCurrency(item.balance)}
                </span>
              </div>
            ))}
            {data.assets.length === 0 && (
              <p className="pl-6 py-2 text-sm text-slate-400 dark:text-slate-500 italic">No assets</p>
            )}
            <div className="flex justify-between items-center font-semibold pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-900 dark:text-slate-100">Total Assets</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">
                {formatCurrency(data.totalAssets)}
              </span>
            </div>
          </div>
        </div>

        {/* Liabilities */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-5 h-5 text-orange-600" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Liabilities</h3>
          </div>
          <div className="space-y-2">
            {data.liabilities.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center pl-6 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded">
                <span className="text-slate-700 dark:text-slate-300">
                  {item.accountName}
                  {item.isReal && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded">
                      Credit
                    </span>
                  )}
                </span>
                <span className="font-mono text-orange-600 dark:text-orange-400">
                  {formatCurrency(item.balance)}
                </span>
              </div>
            ))}
            {data.liabilities.length === 0 && (
              <p className="pl-6 py-2 text-sm text-slate-400 dark:text-slate-500 italic">No liabilities</p>
            )}
            <div className="flex justify-between items-center font-semibold pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-900 dark:text-slate-100">Total Liabilities</span>
              <span className="font-mono text-orange-600 dark:text-orange-400">
                {formatCurrency(data.totalLiabilities)}
              </span>
            </div>
          </div>
        </div>

        {/* Equity */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Landmark className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Equity</h3>
          </div>
          <div className="space-y-2">
            {data.equity.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center pl-6 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded">
                <span className="text-slate-700 dark:text-slate-300">{item.accountName}</span>
                <span className="font-mono text-purple-600 dark:text-purple-400">
                  {formatCurrency(item.balance)}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center pl-6 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded">
              <span className="text-slate-700 dark:text-slate-300 italic">Retained Earnings</span>
              <span className={`font-mono ${data.retainedEarnings >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(data.retainedEarnings)}
              </span>
            </div>
            <div className="flex justify-between items-center font-semibold pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-900 dark:text-slate-100">Total Equity</span>
              <span className="font-mono text-purple-600 dark:text-purple-400">
                {formatCurrency(data.totalEquity)}
              </span>
            </div>
          </div>
        </div>

        {/* Balance Equation */}
        <div className={`p-4 rounded-lg ${data.isBalanced ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Scale className={`w-6 h-6 ${data.isBalanced ? 'text-green-600' : 'text-red-600'}`} />
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Accounting Equation
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Assets</p>
              <p className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
                {formatCurrency(data.totalAssets)}
              </p>
            </div>
            <div className="flex items-center justify-center text-2xl font-bold text-slate-400">=</div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Liabilities + Equity</p>
              <p className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400">
                {formatCurrency(data.totalLiabilities + data.totalEquity)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
