import { Tag, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import type { TagSummary } from '../../types';

interface TagSummaryReportProps {
  data: TagSummary[];
}

export function TagSummaryReport({ data }: TagSummaryReportProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
        <Tag className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
        <p className="text-slate-600 dark:text-slate-400">
          No tagged transactions found in this period
        </p>
      </div>
    );
  }

  const totalIncome = data.reduce((sum, t) => sum + t.income, 0);
  const totalExpenses = data.reduce((sum, t) => sum + t.expenses, 0);
  const totalNet = data.reduce((sum, t) => sum + t.net, 0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-2">
          <Tag className="w-6 h-6 text-purple-600" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Tag Summary
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Income and expenses grouped by transaction tags
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                Tag
              </th>
              <th className="text-right p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <div className="flex items-center justify-end gap-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  Income
                </div>
              </th>
              <th className="text-right p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <div className="flex items-center justify-end gap-1">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  Expenses
                </div>
              </th>
              <th className="text-right p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <div className="flex items-center justify-end gap-1">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  Net
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={item.tag}
                className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <td className="p-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
                    <Tag className="w-3.5 h-3.5" />
                    {item.tag}
                  </span>
                </td>
                <td className="p-4 text-right font-mono text-green-600 dark:text-green-400">
                  {item.income > 0 ? formatCurrency(item.income) : '-'}
                </td>
                <td className="p-4 text-right font-mono text-red-600 dark:text-red-400">
                  {item.expenses > 0 ? formatCurrency(item.expenses) : '-'}
                </td>
                <td className={`p-4 text-right font-mono font-semibold ${item.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(item.net)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 dark:border-slate-600 font-semibold">
              <td className="p-4 text-slate-900 dark:text-slate-100">Total</td>
              <td className="p-4 text-right font-mono text-green-600 dark:text-green-400">
                {formatCurrency(totalIncome)}
              </td>
              <td className="p-4 text-right font-mono text-red-600 dark:text-red-400">
                {formatCurrency(totalExpenses)}
              </td>
              <td className={`p-4 text-right font-mono ${totalNet >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(totalNet)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
