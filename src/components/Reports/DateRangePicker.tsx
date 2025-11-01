import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateRangePickerProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const currentQuarter = Math.ceil(currentMonth / 3);
  const currentDay = new Date().getDate();
  const today = new Date();

  // Helper to format date as YYYY-MM-DD
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Helper to get last day of month
  const getLastDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  // Quick select presets
  const selectThisMonth = () => {
    onStartDateChange(`${currentYear}-${String(currentMonth).padStart(2, '0')}-01`);
    const lastDay = getLastDayOfMonth(currentYear, currentMonth);
    onEndDateChange(`${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
  };

  const selectLastMonth = () => {
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    onStartDateChange(`${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-01`);
    const lastDay = getLastDayOfMonth(lastMonthYear, lastMonth);
    onEndDateChange(`${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
  };

  const selectQuarter = (quarter: number, year: number) => {
    const quarters = [
      { start: `${year}-01-01`, end: `${year}-03-31` },
      { start: `${year}-04-01`, end: `${year}-06-30` },
      { start: `${year}-07-01`, end: `${year}-09-30` },
      { start: `${year}-10-01`, end: `${year}-12-31` },
    ];
    const q = quarters[quarter - 1];
    onStartDateChange(q.start);
    onEndDateChange(q.end);
  };

  const selectLastQuarter = () => {
    const lastQ = currentQuarter === 1 ? 4 : currentQuarter - 1;
    const lastQYear = currentQuarter === 1 ? currentYear - 1 : currentYear;
    selectQuarter(lastQ, lastQYear);
  };

  const selectYearToDate = () => {
    onStartDateChange(`${currentYear}-01-01`);
    onEndDateChange(formatDate(today));
  };

  const selectThisYear = () => {
    onStartDateChange(`${currentYear}-01-01`);
    onEndDateChange(`${currentYear}-12-31`);
  };

  const selectLastYear = () => {
    onStartDateChange(`${currentYear - 1}-01-01`);
    onEndDateChange(`${currentYear - 1}-12-31`);
  };

  const selectFinancialYear = (endYear: number) => {
    onStartDateChange(`${endYear - 1}-07-01`);
    onEndDateChange(`${endYear}-06-30`);
  };

  const selectLastFinancialYear = () => {
    const fyYear = currentMonth >= 7 ? currentYear : currentYear - 1;
    selectFinancialYear(fyYear);
  };

  const selectCurrentFinancialYear = () => {
    const fyYear = currentMonth >= 7 ? currentYear + 1 : currentYear;
    selectFinancialYear(fyYear);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center gap-4 mb-4">
        <Calendar className="w-5 h-5 text-slate-500" />
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Date Range</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Quick Select:</p>
        <div className="flex flex-wrap gap-2">
          {/* Month Options */}
          <button
            onClick={selectThisMonth}
            className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md text-slate-700 dark:text-slate-300"
          >
            This Month
          </button>
          <button
            onClick={selectLastMonth}
            className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md text-slate-700 dark:text-slate-300"
          >
            Last Month
          </button>

          {/* Quarter Options */}
          <button
            onClick={() => selectQuarter(currentQuarter, currentYear)}
            className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md text-slate-700 dark:text-slate-300"
          >
            This Quarter
          </button>
          <button
            onClick={selectLastQuarter}
            className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md text-slate-700 dark:text-slate-300"
          >
            Last Quarter
          </button>

          {/* Calendar Year Options */}
          <button
            onClick={selectYearToDate}
            className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md text-slate-700 dark:text-slate-300"
          >
            Year to Date
          </button>
          <button
            onClick={selectThisYear}
            className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md text-slate-700 dark:text-slate-300"
          >
            This Year
          </button>
          <button
            onClick={selectLastYear}
            className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md text-slate-700 dark:text-slate-300"
          >
            Last Year
          </button>

          {/* Financial Year Options */}
          <button
            onClick={selectCurrentFinancialYear}
            className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md text-slate-700 dark:text-slate-300"
          >
            This FY
          </button>
          <button
            onClick={selectLastFinancialYear}
            className="px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md text-slate-700 dark:text-slate-300"
          >
            Last FY
          </button>
        </div>
      </div>
    </div>
  );
}
