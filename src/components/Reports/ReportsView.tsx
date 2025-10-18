import { useState } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import { format } from 'date-fns';
import { DateRangePicker } from './DateRangePicker';
import { ProfitAndLossReport } from './ProfitAndLossReport';
import { GSTSummaryReport } from './GSTSummaryReport';
import { BASDraftReport } from './BASDraftReport';
import { reportAPI } from '../../lib/api';
import { generateCSV, downloadCSV, formatCurrencyForCSV } from '../../lib/utils/csvExport';
import { useToast } from '../../hooks/useToast';
import type { ProfitAndLoss, GSTSummary, BASDraft } from '../../types';

type ReportType = 'profit-loss' | 'gst-summary' | 'bas-draft';

export function ReportsView() {
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<ReportType>('profit-loss');

  // Date range state (default to current financial year)
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const fyYear = currentMonth >= 7 ? currentYear + 1 : currentYear;

  const [startDate, setStartDate] = useState(`${fyYear - 1}-07-01`);
  const [endDate, setEndDate] = useState(`${fyYear}-06-30`);

  // Report data state
  const [profitLossData, setProfitLossData] = useState<ProfitAndLoss | null>(null);
  const [gstSummaryData, setGSTSummaryData] = useState<GSTSummary | null>(null);
  const [basDraftData, setBASDraftData] = useState<BASDraft | null>(null);

  // Loading and filter states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessOnly, setBusinessOnly] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      switch (activeTab) {
        case 'profit-loss':
          const plData = await reportAPI.generateProfitAndLoss(start, end, {
            businessOnly,
            gstInclusive: true,
          });
          setProfitLossData(plData);
          break;

        case 'gst-summary':
          const gstData = await reportAPI.generateGSTSummary(start, end);
          setGSTSummaryData(gstData);
          break;

        case 'bas-draft':
          const basData = await reportAPI.generateBASDraft(start, end);
          setBASDraftData(basData);
          break;
      }
    } catch (err) {
      setError((err as Error).message);
      showError('Failed to generate report', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as ReportType);
    // Clear current data when switching tabs
    setProfitLossData(null);
    setGSTSummaryData(null);
    setBASDraftData(null);
    setError(null);
  };

  const handleExportCSV = () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      switch (activeTab) {
        case 'profit-loss':
          if (!profitLossData) return;

          const plRows = [
            ...profitLossData.income.map((item) => ({
              type: 'Income',
              category: item.categoryName,
              amount: item.amount,
            })),
            { type: 'Total Income', category: '', amount: profitLossData.totalIncome },
            { type: '', category: '', amount: 0 }, // Empty row
            ...profitLossData.expenses.map((item) => ({
              type: 'Expense',
              category: item.categoryName,
              amount: item.amount,
            })),
            { type: 'Total Expenses', category: '', amount: profitLossData.totalExpenses },
            { type: '', category: '', amount: 0 }, // Empty row
            { type: 'Net Profit/Loss', category: '', amount: profitLossData.netProfit },
          ];

          const plCSV = generateCSV(plRows, [
            { header: 'Type', accessor: (row) => row.type },
            { header: 'Category', accessor: (row) => row.category },
            { header: 'Amount', accessor: (row) => row.amount !== 0 ? formatCurrencyForCSV(row.amount) : '' },
          ]);

          downloadCSV(plCSV, `profit-loss-${today}.csv`);
          showSuccess('Export complete', 'Profit & Loss report exported to CSV');
          break;

        case 'gst-summary':
          if (!gstSummaryData) return;

          const gstCSV = generateCSV(gstSummaryData.byCategory, [
            { header: 'Category', accessor: (row) => row.categoryName },
            { header: 'Sales', accessor: (row) => formatCurrencyForCSV(row.sales) },
            { header: 'Purchases', accessor: (row) => formatCurrencyForCSV(row.purchases) },
            { header: 'GST Collected', accessor: (row) => formatCurrencyForCSV(row.gstCollected) },
            { header: 'GST Paid', accessor: (row) => formatCurrencyForCSV(row.gstPaid) },
          ]);

          downloadCSV(gstCSV, `gst-summary-${today}.csv`);
          showSuccess('Export complete', 'GST Summary exported to CSV');
          break;

        case 'bas-draft':
          if (!basDraftData) return;

          const basCSV = generateCSV(basDraftData.reconciliation, [
            { header: 'Field', accessor: (row) => row.description },
            { header: 'Amount', accessor: (row) => formatCurrencyForCSV(row.value) },
          ]);

          downloadCSV(basCSV, `bas-draft-${today}.csv`);
          showSuccess('Export complete', 'BAS Draft exported to CSV');
          break;
      }
    } catch (error) {
      showError('Export failed', (error as Error).message);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Reports</h1>
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          Financial reports and GST summaries for your business
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Date Range Picker */}
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />

          {/* Report Type Tabs */}
          <Tabs.Root value={activeTab} onValueChange={handleTabChange}>
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
              <Tabs.List className="flex gap-2 mb-4">
                <Tabs.Trigger
                  value="profit-loss"
                  className="px-4 py-2 rounded-md text-sm font-medium transition-colors data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:bg-slate-100 data-[state=inactive]:text-slate-700 dark:data-[state=inactive]:bg-slate-700 dark:data-[state=inactive]:text-slate-300"
                >
                  Profit & Loss
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="gst-summary"
                  className="px-4 py-2 rounded-md text-sm font-medium transition-colors data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:bg-slate-100 data-[state=inactive]:text-slate-700 dark:data-[state=inactive]:bg-slate-700 dark:data-[state=inactive]:text-slate-300"
                >
                  GST Summary
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="bas-draft"
                  className="px-4 py-2 rounded-md text-sm font-medium transition-colors data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:bg-slate-100 data-[state=inactive]:text-slate-700 dark:data-[state=inactive]:bg-slate-700 dark:data-[state=inactive]:text-slate-300"
                >
                  BAS Draft
                </Tabs.Trigger>
              </Tabs.List>

              {/* Filters and Generate Button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {activeTab === 'profit-loss' && (
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={businessOnly}
                        onChange={(e) => setBusinessOnly(e.target.checked)}
                        className="rounded border-slate-300 dark:border-slate-600"
                      />
                      Business Only
                    </label>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={generateReport}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-md font-medium flex items-center gap-2 transition-colors"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        Generate Report
                      </>
                    )}
                  </button>

                  {(profitLossData || gstSummaryData || basDraftData) && (
                    <button
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-md font-medium flex items-center gap-2 transition-colors"
                      onClick={handleExportCSV}
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
                <p className="font-semibold">Error generating report</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}

            {/* Report Content */}
            <Tabs.Content value="profit-loss" className="focus:outline-none">
              {profitLossData ? (
                <ProfitAndLossReport data={profitLossData} />
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
                  <FileText className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <p className="text-slate-600 dark:text-slate-400">
                    Click "Generate Report" to view your Profit & Loss statement
                  </p>
                </div>
              )}
            </Tabs.Content>

            <Tabs.Content value="gst-summary" className="focus:outline-none">
              {gstSummaryData ? (
                <GSTSummaryReport data={gstSummaryData} />
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
                  <FileText className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <p className="text-slate-600 dark:text-slate-400">
                    Click "Generate Report" to view your GST summary
                  </p>
                </div>
              )}
            </Tabs.Content>

            <Tabs.Content value="bas-draft" className="focus:outline-none">
              {basDraftData ? (
                <BASDraftReport data={basDraftData} />
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
                  <FileText className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <p className="text-slate-600 dark:text-slate-400">
                    Click "Generate Report" to view your BAS draft
                  </p>
                </div>
              )}
            </Tabs.Content>
          </Tabs.Root>
        </div>
      </div>
    </div>
  );
}
