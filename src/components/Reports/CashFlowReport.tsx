import { ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, Briefcase, ArrowRightLeft } from 'lucide-react';
import type { CashFlowStatement } from '../../types';

interface CashFlowReportProps {
  data: CashFlowStatement;
}

export function CashFlowReport({ data }: CashFlowReportProps) {
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

  const netIsPositive = data.netCashChange >= 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Cash Flow Statement
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {formatDate(data.period.start)} to {formatDate(data.period.end)}
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Opening Cash */}
        <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <span className="font-medium text-slate-700 dark:text-slate-300">Opening Cash Balance</span>
          </div>
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
            {formatCurrency(data.openingCash)}
          </span>
        </div>

        {/* Operating Activities */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Operating Activities</h3>
          </div>
          <div className="space-y-2">
            {data.operating.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center pl-6 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded">
                <span className="text-slate-700 dark:text-slate-300">{item.categoryName}</span>
                <span className={`font-mono ${item.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
            {data.operating.items.length === 0 && (
              <p className="pl-6 py-2 text-sm text-slate-400 dark:text-slate-500 italic">No operating cash flows</p>
            )}
            <div className="flex justify-between items-center font-semibold pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-900 dark:text-slate-100">Net Operating Cash Flow</span>
              <span className={`font-mono ${data.operating.total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(data.operating.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Investing Activities */}
        {data.investing.items.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Investing Activities</h3>
            </div>
            <div className="space-y-2">
              {data.investing.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center pl-6 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded">
                  <span className="text-slate-700 dark:text-slate-300">{item.description}</span>
                  <span className={`font-mono ${item.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center font-semibold pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-900 dark:text-slate-100">Net Investing Cash Flow</span>
                <span className={`font-mono ${data.investing.total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(data.investing.total)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Financing Activities */}
        {data.financing.items.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ArrowRightLeft className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Transfers Between Accounts</h3>
            </div>
            <div className="space-y-2">
              {data.financing.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center pl-6 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded">
                  <span className="text-slate-700 dark:text-slate-300">{item.description}</span>
                  <span className="font-mono text-slate-600 dark:text-slate-400">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Net Cash Change */}
        <div className={`p-4 rounded-lg ${netIsPositive ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              {netIsPositive ? (
                <ArrowUpCircle className="w-6 h-6 text-green-600" />
              ) : (
                <ArrowDownCircle className="w-6 h-6 text-red-600" />
              )}
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Net Cash {netIsPositive ? 'Increase' : 'Decrease'}
              </span>
            </div>
            <span className={`text-2xl font-bold font-mono ${netIsPositive ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(data.netCashChange))}
            </span>
          </div>
        </div>

        {/* Closing Cash */}
        <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <span className="font-medium text-slate-700 dark:text-slate-300">Closing Cash Balance</span>
          </div>
          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
            {formatCurrency(data.closingCash)}
          </span>
        </div>
      </div>
    </div>
  );
}
