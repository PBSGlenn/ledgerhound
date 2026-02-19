import { FileText, Briefcase, DollarSign, Receipt } from 'lucide-react';
import type { TaxSummary, TaxSummaryItem } from '../../types';

interface TaxSummaryReportProps {
  data: TaxSummary;
}

export function TaxSummaryReport({ data }: TaxSummaryReportProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Tax Summary for Lodgement
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          FY {data.financialYear} &mdash; {formatDate(data.period.start)} to {formatDate(data.period.end)}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
          Categories grouped by ATO tax return labels. Assign labels in Settings &gt; Categories or Account Settings.
        </p>
      </div>

      <div className="p-6 space-y-8">
        {/* Business Schedule */}
        <Section
          icon={<Briefcase className="w-5 h-5 text-blue-600" />}
          title="Business Schedule (Sole Trader)"
          items={data.businessSchedule}
          formatCurrency={formatCurrency}
        />

        {data.businessSchedule.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-2">
            <SummaryRow label="Total Business Income" amount={data.totalBusinessIncome} formatCurrency={formatCurrency} />
            <SummaryRow label="Total Business Expenses" amount={data.totalBusinessExpenses} formatCurrency={formatCurrency} negative />
            <div className="border-t border-blue-200 dark:border-blue-700 pt-2">
              <SummaryRow label="Net Business Income" amount={data.netBusinessIncome} formatCurrency={formatCurrency} bold />
            </div>
          </div>
        )}

        {/* Other Income */}
        <Section
          icon={<DollarSign className="w-5 h-5 text-green-600" />}
          title="Other Income Items"
          items={data.otherIncome}
          formatCurrency={formatCurrency}
          emptyMessage="No other income categories with ATO labels found."
        />

        {data.otherIncome.length > 0 && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <SummaryRow label="Total Other Income" amount={data.totalOtherIncome} formatCurrency={formatCurrency} bold />
          </div>
        )}

        {/* Personal Deductions */}
        <Section
          icon={<Receipt className="w-5 h-5 text-purple-600" />}
          title="Personal Deductions"
          items={data.personalDeductions}
          formatCurrency={formatCurrency}
          emptyMessage="No personal deduction categories with ATO labels found."
        />

        {data.personalDeductions.length > 0 && (
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <SummaryRow label="Total Personal Deductions" amount={data.totalPersonalDeductions} formatCurrency={formatCurrency} bold />
          </div>
        )}

        {/* Overall Summary */}
        <div className="border-t-2 border-slate-300 dark:border-slate-600 pt-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Taxable Income Summary</h3>
          <div className="space-y-2">
            <SummaryRow label="Net Business Income" amount={data.netBusinessIncome} formatCurrency={formatCurrency} />
            <SummaryRow label="Other Income" amount={data.totalOtherIncome} formatCurrency={formatCurrency} />
            <SummaryRow label="Personal Deductions" amount={-data.totalPersonalDeductions} formatCurrency={formatCurrency} negative />
            <div className="border-t-2 border-slate-400 dark:border-slate-500 pt-3">
              <SummaryRow label="Estimated Taxable Income" amount={data.taxableIncome} formatCurrency={formatCurrency} bold />
            </div>
          </div>
        </div>

        {/* No labels hint */}
        {data.businessSchedule.length === 0 && data.otherIncome.length === 0 && data.personalDeductions.length === 0 && (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">
              No categories have been assigned ATO labels yet.
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              Business categories will automatically appear under "Business Schedule".
              For other income and deductions, assign ATO labels in category settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  items,
  formatCurrency,
  emptyMessage,
}: {
  icon: React.ReactNode;
  title: string;
  items: TaxSummaryItem[];
  formatCurrency: (n: number) => string;
  emptyMessage?: string;
}) {
  if (items.length === 0 && emptyMessage) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        </div>
        <p className="text-sm text-slate-400 dark:text-slate-500 pl-7">{emptyMessage}</p>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      </div>
      <div className="space-y-4 pl-7">
        {items.map((item) => (
          <div key={item.atoLabel}>
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {item.atoLabelDescription}
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(item.total)}
              </span>
            </div>
            {item.categories.length > 1 && (
              <div className="pl-4 space-y-0.5">
                {item.categories.map((cat, idx) => (
                  <div key={idx} className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>{cat.name}</span>
                    <span className="font-mono">{formatCurrency(cat.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  amount,
  formatCurrency,
  bold,
  negative,
}: {
  label: string;
  amount: number;
  formatCurrency: (n: number) => string;
  bold?: boolean;
  negative?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center ${bold ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
      <span>{label}</span>
      <span className={`font-mono ${negative ? 'text-red-600 dark:text-red-400' : ''}`}>
        {formatCurrency(amount)}
      </span>
    </div>
  );
}
