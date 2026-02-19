import { AlertTriangle, TrendingUp, TrendingDown, DollarSign, Percent, ArrowDown, ArrowUp } from 'lucide-react';
import type { TaxEstimation } from '../../types';

interface TaxEstimationReportProps {
  data: TaxEstimation;
}

export function TaxEstimationReport({ data }: TaxEstimationReportProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });

  const isRefund = data.estimatedBalance < 0;

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Estimate Only</p>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            This is an estimate based on your recorded transactions. Always consult your tax agent for accurate tax advice.
            Medicare levy surcharge, private health insurance rebate, and other adjustments are not included.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Income Tax Estimation
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            FY {data.financialYear} &mdash; {formatDate(data.period.start)} to {formatDate(data.period.end)}
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Business Income */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Business Income</h3>
            </div>
            <div className="space-y-2 pl-6">
              <Row label="Gross Business Income" amount={data.grossBusinessIncome} color="green" />
              <Row label="Business Expenses" amount={-data.businessExpenses} color="red" />
              <TotalRow label="Net Business Income" amount={data.netBusinessIncome} />
            </div>
          </div>

          {/* Other Income */}
          {data.otherIncome.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Other Income</h3>
              </div>
              <div className="space-y-2 pl-6">
                {data.otherIncome.map((item, idx) => (
                  <Row key={idx} label={item.label} amount={item.amount} color="green" />
                ))}
                <TotalRow label="Total Other Income" amount={data.totalOtherIncome} />
              </div>
            </div>
          )}

          {/* Personal Deductions */}
          {data.personalDeductions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Personal Deductions</h3>
              </div>
              <div className="space-y-2 pl-6">
                {data.personalDeductions.map((item, idx) => (
                  <Row key={idx} label={item.label} amount={-item.amount} color="purple" />
                ))}
                <TotalRow label="Total Deductions" amount={-data.totalPersonalDeductions} />
              </div>
            </div>
          )}

          {/* Tax Calculation Waterfall */}
          <div className="border-t-2 border-slate-300 dark:border-slate-600 pt-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Tax Calculation</h3>
            <div className="space-y-3">
              <WaterfallRow label="Taxable Income" amount={data.taxableIncome} bold />
              <WaterfallRow label="Income Tax on Taxable Income" amount={data.incomeTax} indent />
              <WaterfallRow label="Medicare Levy (2%)" amount={data.medicareLevy} indent add />
              <WaterfallRow label="Low Income Tax Offset (LITO)" amount={-data.lito} indent subtract />
              <WaterfallRow label="Small Business Income Tax Offset" amount={-data.smallBusinessOffset} indent subtract />
              <div className="border-t-2 border-slate-400 dark:border-slate-500 pt-3">
                <WaterfallRow label="Total Tax Payable" amount={data.totalTaxPayable} bold />
              </div>
              <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5" />
                  Effective Tax Rate
                </span>
                <span className="font-mono">{data.effectiveRate.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          {/* PAYG and Balance */}
          <div className={`p-4 rounded-lg ${isRefund ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-700 dark:text-slate-300">Total Tax Payable</span>
                <span className="font-mono font-medium">{formatCurrency(data.totalTaxPayable)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-700 dark:text-slate-300">PAYG Installments Paid</span>
                <span className="font-mono font-medium text-green-600">-{formatCurrency(data.paygPaid)}</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {isRefund ? (
                      <ArrowDown className="w-5 h-5 text-green-600" />
                    ) : (
                      <ArrowUp className="w-5 h-5 text-red-600" />
                    )}
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Estimated {isRefund ? 'Refund' : 'Balance Owing'}
                    </span>
                  </div>
                  <span className={`text-2xl font-bold font-mono ${isRefund ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(Math.abs(data.estimatedBalance))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper components
function Row({ label, amount, color }: { label: string; amount: number; color: string }) {
  const formatCurrency = (a: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(a);

  const colorClasses: Record<string, string> = {
    green: 'text-green-600 dark:text-green-400',
    red: 'text-red-600 dark:text-red-400',
    purple: 'text-purple-600 dark:text-purple-400',
    blue: 'text-blue-600 dark:text-blue-400',
  };

  return (
    <div className="flex justify-between items-center py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded px-2">
      <span className="text-slate-700 dark:text-slate-300">{label}</span>
      <span className={`font-mono ${colorClasses[color] ?? 'text-slate-700'}`}>
        {formatCurrency(amount)}
      </span>
    </div>
  );
}

function TotalRow({ label, amount }: { label: string; amount: number }) {
  const formatCurrency = (a: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(a);

  return (
    <div className="flex justify-between items-center font-semibold pt-2 border-t border-slate-200 dark:border-slate-700 px-2">
      <span className="text-slate-900 dark:text-slate-100">{label}</span>
      <span className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(amount)}</span>
    </div>
  );
}

function WaterfallRow({
  label,
  amount,
  bold,
  indent,
  add,
  subtract,
}: {
  label: string;
  amount: number;
  bold?: boolean;
  indent?: boolean;
  add?: boolean;
  subtract?: boolean;
}) {
  const formatCurrency = (a: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Math.abs(a));

  const prefix = add ? '+ ' : subtract ? '- ' : '';

  return (
    <div className={`flex justify-between items-center ${indent ? 'pl-4' : ''}`}>
      <span className={`${bold ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
        {label}
      </span>
      <span className={`font-mono ${bold ? 'font-semibold text-slate-900 dark:text-slate-100' : subtract ? 'text-green-600' : add ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
        {prefix}{formatCurrency(amount)}
      </span>
    </div>
  );
}
