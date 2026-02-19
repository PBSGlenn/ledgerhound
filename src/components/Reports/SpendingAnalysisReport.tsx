import { useState, useMemo } from 'react';
import { BarChart3, Users, Layers, DollarSign, TrendingUp, TrendingDown, Hash, Loader2, FileText, Download, X } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { DateRangePicker } from './DateRangePicker';
import { CategoryMultiSelect } from './CategoryMultiSelect';
import { reportAPI } from '../../lib/api';
import { generateCSV, downloadCSV, formatCurrencyForCSV } from '../../lib/utils/csvExport';
import type { SpendingAnalysisResponse, SpendingGranularity } from '../../types';

const CHART_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

type SubView = 'by-category' | 'by-payee' | 'combined';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

const formatCompact = (amount: number) => {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${amount.toFixed(0)}`;
};

export function SpendingAnalysisReport() {
  // Date state (default to current financial year)
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const fyYear = currentMonth >= 7 ? currentYear + 1 : currentYear;

  const [startDate, setStartDate] = useState(`${fyYear - 1}-07-01`);
  const [endDate, setEndDate] = useState(`${fyYear}-06-30`);

  // Filter state
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [payees, setPayees] = useState<string[]>([]);
  const [payeeInput, setPayeeInput] = useState('');
  const [granularity, setGranularity] = useState<SpendingGranularity>('monthly');
  const [businessOnly, setBusinessOnly] = useState(false);
  const [includeIncome, setIncludeIncome] = useState(false);

  // Data state
  const [data, setData] = useState<SpendingAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sub-view state
  const [subView, setSubView] = useState<SubView>('by-category');

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await reportAPI.generateSpendingAnalysis({
        startDate,
        endDate,
        categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        payees: payees.length > 0 ? payees : undefined,
        granularity,
        businessOnly: businessOnly || undefined,
        includeIncome: includeIncome || undefined,
      });
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const addPayee = () => {
    const trimmed = payeeInput.trim();
    if (trimmed && !payees.includes(trimmed)) {
      setPayees([...payees, trimmed]);
    }
    setPayeeInput('');
  };

  const removePayee = (payee: string) => {
    setPayees(payees.filter(p => p !== payee));
  };

  const handleExportCSV = () => {
    if (!data) return;
    const today = new Date().toISOString().split('T')[0];

    if (subView === 'by-category') {
      const csv = generateCSV(data.byCategory, [
        { header: 'Category', accessor: (r) => r.categoryName },
        { header: 'Full Path', accessor: (r) => r.categoryFullPath || '' },
        { header: 'Total', accessor: (r) => formatCurrencyForCSV(r.total) },
        { header: 'Percentage', accessor: (r) => r.percentage.toFixed(1) + '%' },
      ]);
      downloadCSV(csv, `spending-by-category-${today}.csv`);
    } else if (subView === 'by-payee') {
      const csv = generateCSV(data.byPayee, [
        { header: 'Payee', accessor: (r) => r.payee },
        { header: 'Total', accessor: (r) => formatCurrencyForCSV(r.total) },
        { header: 'Percentage', accessor: (r) => r.percentage.toFixed(1) + '%' },
      ]);
      downloadCSV(csv, `spending-by-payee-${today}.csv`);
    } else {
      const rows = data.byPayee.flatMap((p) =>
        p.categoryBreakdown.map((c) => ({ payee: p.payee, category: c.categoryName, amount: c.amount }))
      );
      const csv = generateCSV(rows, [
        { header: 'Payee', accessor: (r) => r.payee },
        { header: 'Category', accessor: (r) => r.category },
        { header: 'Amount', accessor: (r) => formatCurrencyForCSV(r.amount) },
      ]);
      downloadCSV(csv, `spending-combined-${today}.csv`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters Panel */}
      <DateRangePicker
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CategoryMultiSelect
            value={selectedCategoryIds}
            onChange={setSelectedCategoryIds}
          />

          {/* Payee Tag Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Payees / Shops
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={payeeInput}
                onChange={(e) => setPayeeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPayee();
                  }
                }}
                placeholder="Type payee name and press Enter..."
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400"
              />
              <button
                type="button"
                onClick={addPayee}
                disabled={!payeeInput.trim()}
                className="px-3 py-2 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 disabled:opacity-50 rounded-md text-sm text-slate-700 dark:text-slate-300"
              >
                Add
              </button>
            </div>
            {payees.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {payees.map((payee) => (
                  <span
                    key={payee}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full"
                  >
                    {payee}
                    <button onClick={() => removePayee(payee)} className="hover:text-green-900 dark:hover:text-green-100">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-200 dark:border-slate-700">
          {/* Granularity Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">Period:</span>
            <div className="flex rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden">
              <button
                onClick={() => setGranularity('monthly')}
                className={`px-3 py-1 text-sm ${
                  granularity === 'monthly'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setGranularity('weekly')}
                className={`px-3 py-1 text-sm ${
                  granularity === 'weekly'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                }`}
              >
                Weekly
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={businessOnly}
              onChange={(e) => setBusinessOnly(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            Business Only
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={includeIncome}
              onChange={(e) => setIncludeIncome(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            Include Income
          </label>

          <div className="flex-1" />

          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-md font-medium flex items-center gap-2 transition-colors text-sm"
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

            {data && (
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-md font-medium flex items-center gap-2 transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          <p className="font-semibold">Error generating report</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Results */}
      {data && <SpendingResults data={data} subView={subView} onSubViewChange={setSubView} />}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
          <BarChart3 className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-slate-600 dark:text-slate-400">
            Configure your filters and click "Generate Report" to analyse your spending
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Results Component
// ============================================================================

function SpendingResults({
  data,
  subView,
  onSubViewChange,
}: {
  data: SpendingAnalysisResponse;
  subView: SubView;
  onSubViewChange: (v: SubView) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Total Spending"
          value={formatCurrency(data.grandTotal)}
          color="blue"
        />
        <SummaryCard
          icon={<Hash className="w-5 h-5" />}
          label="Transactions"
          value={data.transactionCount.toLocaleString()}
          color="slate"
        />
        <SummaryCard
          icon={<TrendingUp className="w-5 h-5" />}
          label={`Avg / ${data.granularity === 'monthly' ? 'Month' : 'Week'}`}
          value={formatCurrency(data.averagePerBucket)}
          color="green"
        />
        <SummaryCard
          icon={<TrendingDown className="w-5 h-5" />}
          label={`Highest: ${data.highestBucket.label}`}
          value={formatCurrency(data.highestBucket.amount)}
          color="red"
        />
      </div>

      {/* Time Series Chart */}
      {data.timeSeries.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Spending Over Time
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.timeSeries} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="bucketLabel"
                tick={{ fontSize: 12, fill: '#64748b' }}
                interval={data.timeSeries.length > 20 ? Math.floor(data.timeSeries.length / 10) : 0}
              />
              <YAxis
                tickFormatter={formatCompact}
                tick={{ fontSize: 12, fill: '#64748b' }}
              />
              <Tooltip
                formatter={(value: any) => [formatCurrency(value as number), 'Spending']}
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sub-View Tabs */}
      <div className="flex gap-2">
        <SubViewTab
          active={subView === 'by-category'}
          onClick={() => onSubViewChange('by-category')}
          icon={<BarChart3 className="w-4 h-4" />}
          label="By Category"
        />
        <SubViewTab
          active={subView === 'by-payee'}
          onClick={() => onSubViewChange('by-payee')}
          icon={<Users className="w-4 h-4" />}
          label="By Payee"
        />
        <SubViewTab
          active={subView === 'combined'}
          onClick={() => onSubViewChange('combined')}
          icon={<Layers className="w-4 h-4" />}
          label="Combined"
        />
      </div>

      {/* Sub-View Content */}
      {subView === 'by-category' && <CategoryView data={data} />}
      {subView === 'by-payee' && <PayeeView data={data} />}
      {subView === 'combined' && <CombinedView data={data} />}
    </div>
  );
}

// ============================================================================
// Sub-View Components
// ============================================================================

function CategoryView({ data }: { data: SpendingAnalysisResponse }) {
  const [sortField, setSortField] = useState<'name' | 'total'>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const items = [...data.byCategory];
    items.sort((a, b) => {
      const val = sortField === 'name'
        ? a.categoryName.localeCompare(b.categoryName)
        : a.total - b.total;
      return sortDir === 'desc' ? -val : val;
    });
    return items;
  }, [data.byCategory, sortField, sortDir]);

  const top10 = data.byCategory.slice(0, 10);
  const pieData = useMemo(() => {
    const top8 = data.byCategory.slice(0, 8);
    const rest = data.byCategory.slice(8);
    const otherTotal = rest.reduce((s, r) => s + r.total, 0);
    const result = top8.map(c => ({ name: c.categoryName, value: c.total }));
    if (otherTotal > 0) result.push({ name: 'Other', value: otherTotal });
    return result;
  }, [data.byCategory]);

  const toggleSort = (field: 'name' | 'total') => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'total' ? 'desc' : 'asc');
    }
  };

  const maxAmount = top10[0]?.total || 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        {top10.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Top Categories</h4>
            <ResponsiveContainer width="100%" height={Math.max(200, top10.length * 36)}>
              <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tickFormatter={formatCompact} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  type="category"
                  dataKey="categoryName"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  width={95}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(value as number), 'Amount']}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9' }}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {top10.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pie Chart */}
        {pieData.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Distribution</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => formatCurrency(value as number)}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <th
                className="text-left px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => toggleSort('name')}
              >
                Category {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 w-48">
                Bar
              </th>
              <th
                className="text-right px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => toggleSort('total')}
              >
                Total {sortField === 'total' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, i) => (
              <tr
                key={item.categoryId}
                className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100">
                  <div>{item.categoryName}</div>
                  {item.categoryFullPath && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                      {item.categoryFullPath}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${(item.total / maxAmount) * 100}%`,
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </td>
                <td className="px-4 py-2.5 text-sm font-mono text-right text-slate-900 dark:text-slate-100">
                  {formatCurrency(item.total)}
                </td>
                <td className="px-4 py-2.5 text-sm text-right text-slate-500 dark:text-slate-400">
                  {item.percentage.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 dark:bg-slate-700/50 font-semibold">
              <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">Total</td>
              <td />
              <td className="px-4 py-3 text-sm font-mono text-right text-slate-900 dark:text-slate-100">
                {formatCurrency(data.grandTotal)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-slate-500 dark:text-slate-400">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function PayeeView({ data }: { data: SpendingAnalysisResponse }) {
  const [sortField, setSortField] = useState<'name' | 'total'>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const items = [...data.byPayee];
    items.sort((a, b) => {
      const val = sortField === 'name'
        ? a.payee.localeCompare(b.payee)
        : a.total - b.total;
      return sortDir === 'desc' ? -val : val;
    });
    return items;
  }, [data.byPayee, sortField, sortDir]);

  const top10 = data.byPayee.slice(0, 10);
  const pieData = useMemo(() => {
    const top8 = data.byPayee.slice(0, 8);
    const rest = data.byPayee.slice(8);
    const otherTotal = rest.reduce((s, r) => s + r.total, 0);
    const result = top8.map(p => ({ name: p.payee, value: p.total }));
    if (otherTotal > 0) result.push({ name: 'Other', value: otherTotal });
    return result;
  }, [data.byPayee]);

  const toggleSort = (field: 'name' | 'total') => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'total' ? 'desc' : 'asc');
    }
  };

  const maxAmount = top10[0]?.total || 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        {top10.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Top Payees</h4>
            <ResponsiveContainer width="100%" height={Math.max(200, top10.length * 36)}>
              <BarChart data={top10} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tickFormatter={formatCompact} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  type="category"
                  dataKey="payee"
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  width={95}
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(value as number), 'Amount']}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9' }}
                />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {top10.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pie Chart */}
        {pieData.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Distribution</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => formatCurrency(value as number)}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <th
                className="text-left px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => toggleSort('name')}
              >
                Payee {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 w-48">
                Bar
              </th>
              <th
                className="text-right px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => toggleSort('total')}
              >
                Total {sortField === 'total' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                %
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item, i) => (
              <tr
                key={item.payee}
                className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <td className="px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100">
                  {item.payee}
                </td>
                <td className="px-4 py-2.5">
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${(item.total / maxAmount) * 100}%`,
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </td>
                <td className="px-4 py-2.5 text-sm font-mono text-right text-slate-900 dark:text-slate-100">
                  {formatCurrency(item.total)}
                </td>
                <td className="px-4 py-2.5 text-sm text-right text-slate-500 dark:text-slate-400">
                  {item.percentage.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 dark:bg-slate-700/50 font-semibold">
              <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">Total</td>
              <td />
              <td className="px-4 py-3 text-sm font-mono text-right text-slate-900 dark:text-slate-100">
                {formatCurrency(data.grandTotal)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-slate-500 dark:text-slate-400">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function CombinedView({ data }: { data: SpendingAnalysisResponse }) {
  // Build stacked bar data: for each payee (top 15), show category breakdown
  const top15 = data.byPayee.slice(0, 15);

  // Get all unique categories across top payees
  const allCategoryIds = new Set<string>();
  const categoryNames = new Map<string, string>();
  for (const payee of top15) {
    for (const cat of payee.categoryBreakdown) {
      allCategoryIds.add(cat.categoryId);
      categoryNames.set(cat.categoryId, cat.categoryName);
    }
  }
  const categoryIds = Array.from(allCategoryIds);

  // Build chart data
  const chartData = top15.map(payee => {
    const row: Record<string, any> = { payee: payee.payee };
    for (const catId of categoryIds) {
      const match = payee.categoryBreakdown.find(c => c.categoryId === catId);
      row[catId] = match?.amount || 0;
    }
    return row;
  });

  return (
    <div className="space-y-6">
      {/* Stacked Bar Chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Category Breakdown by Payee
          </h4>
          <ResponsiveContainer width="100%" height={Math.max(300, top15.length * 36)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tickFormatter={formatCompact} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis
                type="category"
                dataKey="payee"
                tick={{ fontSize: 12, fill: '#64748b' }}
                width={115}
              />
              <Tooltip
                formatter={(value: any, name: any) => [
                  formatCurrency(value as number),
                  categoryNames.get(name as string) || name,
                ]}
                contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f1f5f9' }}
              />
              <Legend formatter={(value) => categoryNames.get(value) || value} />
              {categoryIds.map((catId, i) => (
                <Bar
                  key={catId}
                  dataKey={catId}
                  stackId="a"
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detailed Table */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                Payee
              </th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                Category
              </th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {data.byPayee.map((payee) => (
              payee.categoryBreakdown.map((cat, catIdx) => (
                <tr
                  key={`${payee.payee}-${cat.categoryId}`}
                  className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                >
                  {catIdx === 0 ? (
                    <td
                      className="px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 align-top"
                      rowSpan={payee.categoryBreakdown.length}
                    >
                      <div>{payee.payee}</div>
                      <div className="text-xs text-slate-500 font-normal">
                        Total: {formatCurrency(payee.total)}
                      </div>
                    </td>
                  ) : null}
                  <td className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300">
                    {cat.categoryName}
                  </td>
                  <td className="px-4 py-2.5 text-sm font-mono text-right text-slate-900 dark:text-slate-100">
                    {formatCurrency(cat.amount)}
                  </td>
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'red' | 'slate';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    slate: 'bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <div className={`inline-flex p-2 rounded-lg mb-2 ${colorClasses[color]}`}>
        {icon}
      </div>
      <div className="text-sm text-slate-600 dark:text-slate-400">{label}</div>
      <div className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">{value}</div>
    </div>
  );
}

function SubViewTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
