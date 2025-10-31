import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Download, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface StripeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface DatePreset {
  label: string;
  startDate: Date;
  endDate: Date;
}

export function StripeImportModal({ isOpen, onClose, onSuccess }: StripeImportModalProps) {
  const [importing, setImporting] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Calculate date presets
  const getDatePresets = (): DatePreset[] => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const quarter = Math.floor(month / 3);

    // Financial year in Australia: July 1 - June 30
    const currentFYStart = month >= 6 ? new Date(year, 6, 1) : new Date(year - 1, 6, 1);
    const currentFYEnd = month >= 6 ? new Date(year + 1, 5, 30) : new Date(year, 5, 30);
    const lastFYStart = new Date(currentFYStart.getFullYear() - 1, 6, 1);
    const lastFYEnd = new Date(currentFYStart.getFullYear(), 5, 30);

    return [
      {
        label: 'Year to Date',
        startDate: new Date(year, 0, 1),
        endDate: now,
      },
      {
        label: 'Last Calendar Year',
        startDate: new Date(year - 1, 0, 1),
        endDate: new Date(year - 1, 11, 31),
      },
      {
        label: 'Financial Year to Date',
        startDate: currentFYStart,
        endDate: now,
      },
      {
        label: 'Last Financial Year',
        startDate: lastFYStart,
        endDate: lastFYEnd,
      },
      {
        label: 'Present Quarter',
        startDate: new Date(year, quarter * 3, 1),
        endDate: now,
      },
      {
        label: 'Last Quarter',
        startDate: new Date(year, (quarter - 1) * 3, 1),
        endDate: new Date(year, quarter * 3, 0),
      },
      {
        label: 'Present Month',
        startDate: new Date(year, month, 1),
        endDate: now,
      },
      {
        label: 'Last Month',
        startDate: new Date(year, month - 1, 1),
        endDate: new Date(year, month, 0),
      },
    ];
  };

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handlePresetClick = (preset: DatePreset) => {
    setStartDate(formatDateForInput(preset.startDate));
    setEndDate(formatDateForInput(preset.endDate));
  };

  const handleImport = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select a date range');
      return;
    }

    setImporting(true);
    try {
      const response = await fetch('http://localhost:3001/api/stripe/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }

      const result = await response.json();

      toast.success(
        `Imported ${result.imported} transactions, skipped ${result.skipped}`,
        { duration: 5000 }
      );

      if (result.errors && result.errors.length > 0) {
        console.error('Import errors:', result.errors);
        toast.error(`${result.errors.length} errors occurred. Check console for details.`);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Import failed:', error);
      toast.error((error as Error).message || 'Failed to import transactions');
    } finally {
      setImporting(false);
    }
  };

  const presets = getDatePresets();

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl z-50 max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <Download className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <Dialog.Title className="text-xl font-bold text-slate-900 dark:text-white">
                    Sync from Stripe
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-slate-600 dark:text-slate-400">
                    Import transactions from Stripe Balance API
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </Dialog.Close>
            </div>

            {/* Date Range Presets */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Quick Select
              </label>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className="px-4 py-2 text-sm text-left border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Custom Date Range
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    Start Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                    End Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                What will be imported?
              </h4>
              <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-400">
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span><strong>Customer charges</strong> with income, fees, and GST</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span><strong>Stripe fees</strong> (invoicing, adjustments)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span><strong>Payouts</strong> (if destination account configured)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>Existing transactions will be skipped (deduplication)</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={importing}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || !startDate || !endDate}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {importing ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Importing...
                  </span>
                ) : (
                  'Import Transactions'
                )}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
