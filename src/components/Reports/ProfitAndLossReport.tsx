import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import type { ProfitAndLoss } from '../../types';

interface ProfitAndLossReportProps {
  data: ProfitAndLoss;
}

export function ProfitAndLossReport({ data }: ProfitAndLossReportProps) {
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

  const isProfitable = data.netProfit >= 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Profit & Loss Statement
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {formatDate(data.period.start)} to {formatDate(data.period.end)}
          {data.businessOnly && <span className="ml-2 text-blue-600">(Business Only)</span>}
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Income Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Income</h3>
          </div>
          <div className="space-y-2">
            {data.income.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center pl-6 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded">
                <span className="text-slate-700 dark:text-slate-300">{item.categoryName}</span>
                <span className="font-mono text-green-600 dark:text-green-400">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center font-semibold pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-900 dark:text-slate-100">Total Income</span>
              <span className="font-mono text-green-600 dark:text-green-400">
                {formatCurrency(data.totalIncome)}
              </span>
            </div>
          </div>
        </div>

        {/* Expenses Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Expenses</h3>
          </div>
          <div className="space-y-2">
            {data.expenses.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center pl-6 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded">
                <span className="text-slate-700 dark:text-slate-300">{item.categoryName}</span>
                <span className="font-mono text-red-600 dark:text-red-400">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
            <div className="flex justify-between items-center font-semibold pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-slate-900 dark:text-slate-100">Total Expenses</span>
              <span className="font-mono text-red-600 dark:text-red-400">
                {formatCurrency(data.totalExpenses)}
              </span>
            </div>
          </div>
        </div>

        {/* Net Profit/Loss */}
        <div className={`p-4 rounded-lg ${isProfitable ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <DollarSign className={`w-6 h-6 ${isProfitable ? 'text-green-600' : 'text-red-600'}`} />
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Net {isProfitable ? 'Profit' : 'Loss'}
              </span>
            </div>
            <span className={`text-2xl font-bold font-mono ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(data.netProfit))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
