import { FileText, AlertTriangle, DollarSign } from 'lucide-react';
import type { BASDraft } from '../../types';

interface BASDraftReportProps {
  data: BASDraft;
}

export function BASDraftReport({ data }: BASDraftReportProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-6 h-6" />
            BAS Draft
          </h2>
          <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm font-medium rounded-full">
            DRAFT ONLY
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {formatDate(data.period.start)} to {formatDate(data.period.end)}
        </p>
      </div>

      {/* Warning */}
      <div className="p-4 mx-6 mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800 dark:text-yellow-200">
            <p className="font-semibold mb-1">This is a draft calculation only</p>
            <p>Please consult with your accountant or tax professional before lodging your BAS with the ATO.</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Sales Section */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Sales and Income
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded">
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">G1</span>
                <span className="ml-2 text-slate-600 dark:text-slate-400">Total Sales</span>
              </div>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(data.g1TotalSales)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 pl-8 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded">
              <div>
                <span className="font-medium text-slate-700 dark:text-slate-300">G2</span>
                <span className="ml-2 text-slate-600 dark:text-slate-400">Export Sales</span>
              </div>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {formatCurrency(data.g2ExportSales)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 pl-8 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded">
              <div>
                <span className="font-medium text-slate-700 dark:text-slate-300">G3</span>
                <span className="ml-2 text-slate-600 dark:text-slate-400">Other GST-free Sales</span>
              </div>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {formatCurrency(data.g3OtherGSTFree)}
              </span>
            </div>
          </div>
        </div>

        {/* Purchases Section */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Purchases
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded">
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">G10</span>
                <span className="ml-2 text-slate-600 dark:text-slate-400">Capital Purchases</span>
              </div>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(data.g10CapitalPurchases)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded">
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">G11</span>
                <span className="ml-2 text-slate-600 dark:text-slate-400">Non-capital Purchases</span>
              </div>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(data.g11NonCapitalPurchases)}
              </span>
            </div>
          </div>
        </div>

        {/* GST Section */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
            GST Calculation
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
              <div>
                <span className="font-semibold text-green-900 dark:text-green-100">1A</span>
                <span className="ml-2 text-green-700 dark:text-green-300">GST on Sales</span>
              </div>
              <span className="font-mono font-semibold text-green-600">
                {formatCurrency(data.oneAGSTOnSales)}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded">
              <div>
                <span className="font-semibold text-red-900 dark:text-red-100">1B</span>
                <span className="ml-2 text-red-700 dark:text-red-300">GST on Purchases</span>
              </div>
              <span className="font-mono font-semibold text-red-600">
                {formatCurrency(data.oneBGSTOnPurchases)}
              </span>
            </div>
          </div>
        </div>

        {/* Net GST */}
        <div className={`p-4 rounded-lg ${isRefundDue ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <DollarSign className={`w-6 h-6 ${isRefundDue ? 'text-blue-600' : 'text-orange-600'}`} />
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {isRefundDue ? 'Refund Due to You' : 'Amount Payable to ATO'}
              </span>
            </div>
            <span className={`text-2xl font-bold font-mono ${isRefundDue ? 'text-blue-600' : 'text-orange-600'}`}>
              {formatCurrency(Math.abs(data.netGST))}
            </span>
          </div>
        </div>

        {/* Reconciliation Table */}
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Reconciliation
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 px-4 font-medium text-slate-600 dark:text-slate-400">Field</th>
                  <th className="text-right py-2 px-4 font-medium text-slate-600 dark:text-slate-400">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.reconciliation.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 px-4 text-slate-700 dark:text-slate-300">{item.description}</td>
                    <td className="py-2 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                      {formatCurrency(item.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-xs text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-700">
          <p>All amounts are rounded to whole dollars as required by the ATO.</p>
          <p className="mt-1">Generated by Ledgerhound on {new Date().toLocaleDateString('en-AU')}.</p>
        </div>
      </div>
    </div>
  );
}
