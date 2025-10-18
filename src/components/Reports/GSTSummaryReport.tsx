import { Receipt, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import type { GSTSummary } from '../../types';

interface GSTSummaryReportProps {
  data: GSTSummary;
}

export function GSTSummaryReport({ data }: GSTSummaryReportProps) {
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

  const isRefundDue = data.netGST < 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          GST Summary
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {formatDate(data.period.start)} to {formatDate(data.period.end)}
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-900 dark:text-green-100">GST Collected</span>
            </div>
            <p className="text-2xl font-bold text-green-600 font-mono">
              {formatCurrency(data.gstCollected)}
            </p>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-red-900 dark:text-red-100">GST Paid</span>
            </div>
            <p className="text-2xl font-bold text-red-600 font-mono">
              {formatCurrency(data.gstPaid)}
            </p>
          </div>

          <div className={`p-4 rounded-lg ${isRefundDue ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className={`w-5 h-5 ${isRefundDue ? 'text-blue-600' : 'text-orange-600'}`} />
              <span className={`text-sm font-medium ${isRefundDue ? 'text-blue-900 dark:text-blue-100' : 'text-orange-900 dark:text-orange-100'}`}>
                {isRefundDue ? 'Refund Due' : 'Amount Payable'}
              </span>
            </div>
            <p className={`text-2xl font-bold font-mono ${isRefundDue ? 'text-blue-600' : 'text-orange-600'}`}>
              {formatCurrency(Math.abs(data.netGST))}
            </p>
          </div>
        </div>

        {/* By Category */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            By Category
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Category</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Sales</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Purchases</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">GST Collected</th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">GST Paid</th>
                </tr>
              </thead>
              <tbody>
                {data.byCategory.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="py-2 px-4 text-slate-700 dark:text-slate-300">{item.categoryName}</td>
                    <td className="py-2 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                      {item.sales > 0 ? formatCurrency(item.sales) : '-'}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                      {item.purchases > 0 ? formatCurrency(item.purchases) : '-'}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-green-600 dark:text-green-400">
                      {item.gstCollected > 0 ? formatCurrency(item.gstCollected) : '-'}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-red-600 dark:text-red-400">
                      {item.gstPaid > 0 ? formatCurrency(item.gstPaid) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* By Payee (Top 10) */}
        {data.byPayee && data.byPayee.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Top Payees by GST
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Payee</th>
                    <th className="text-right py-2 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">GST Collected</th>
                    <th className="text-right py-2 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">GST Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byPayee.slice(0, 10).map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="py-2 px-4 text-slate-700 dark:text-slate-300">{item.payee}</td>
                      <td className="py-2 px-4 text-right font-mono text-green-600 dark:text-green-400">
                        {item.gstCollected > 0 ? formatCurrency(item.gstCollected) : '-'}
                      </td>
                      <td className="py-2 px-4 text-right font-mono text-red-600 dark:text-red-400">
                        {item.gstPaid > 0 ? formatCurrency(item.gstPaid) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
