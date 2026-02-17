import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Search,
  X,
  Loader2,
  Trash2,
  Tag,
  Edit2,
  ExternalLink,
} from 'lucide-react';
import type { AccountWithBalance, SearchResult, SearchFilter } from '../../types';
import { transactionAPI } from '../../lib/api';
import { CategorySelector } from '../Category/CategorySelector';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import { useToast } from '../../hooks/useToast';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: AccountWithBalance[];
  initialAccountId?: string | null;
  onNavigateToTransaction: (accountId: string, transactionId: string) => void;
  onTransactionsChanged: () => Promise<void>;
}

export function SearchModal({
  isOpen,
  onClose,
  accounts,
  initialAccountId,
  onNavigateToTransaction,
  onTransactionsChanged,
}: SearchModalProps) {
  const { showSuccess, showError } = useToast();

  // Filter state
  const [scope, setScope] = useState<string>('global');
  const [payeeText, setPayeeText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  // Results state
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Batch operation state
  const [showBatchPayee, setShowBatchPayee] = useState(false);
  const [batchPayeeValue, setBatchPayeeValue] = useState('');
  const [showBatchCategory, setShowBatchCategory] = useState(false);
  const [batchCategoryId, setBatchCategoryId] = useState<string | null>(null);
  const [showBatchDelete, setShowBatchDelete] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  const payeeInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setScope(initialAccountId || 'global');
      setPayeeText('');
      setDateFrom('');
      setDateTo('');
      setAmountMin('');
      setAmountMax('');
      setCategoryId(null);
      setResults([]);
      setTotalCount(0);
      setHasSearched(false);
      setSelectedIds(new Set());
      setShowBatchPayee(false);
      setShowBatchCategory(false);

      // Focus payee input after a short delay
      setTimeout(() => payeeInputRef.current?.focus(), 100);
    }
  }, [isOpen, initialAccountId]);

  // Transfer accounts only (for scope dropdown)
  const transferAccounts = accounts.filter((a) => a.kind === 'TRANSFER');

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    setSelectedIds(new Set());

    try {
      const filter: SearchFilter = {
        scope,
        payee: payeeText || undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo + 'T23:59:59') : undefined,
        amountMin: amountMin ? parseFloat(amountMin) : undefined,
        amountMax: amountMax ? parseFloat(amountMax) : undefined,
        categoryId: categoryId || undefined,
      };

      const response = await transactionAPI.searchTransactions(filter);
      setResults(response.results);
      setTotalCount(response.totalCount);
    } catch (error) {
      showError('Search failed', (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [scope, payeeText, dateFrom, dateTo, amountMin, amountMax, categoryId, showError]);

  const handleClearFilters = () => {
    setScope('global');
    setPayeeText('');
    setDateFrom('');
    setDateTo('');
    setAmountMin('');
    setAmountMax('');
    setCategoryId(null);
    setResults([]);
    setTotalCount(0);
    setHasSearched(false);
    setSelectedIds(new Set());
  };

  // Handle Enter key in filter fields
  const handleFilterKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // Selection helpers
  const toggleSelect = (transactionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(transactionId)) {
        next.delete(transactionId);
      } else {
        next.add(transactionId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map((r) => r.transactionId)));
    }
  };

  // Navigate to transaction in register
  const handleNavigate = (result: SearchResult) => {
    onNavigateToTransaction(result.accountId, result.transactionId);
    onClose();
  };

  // Batch operations
  const handleBatchChangePayee = async () => {
    if (!batchPayeeValue.trim()) return;
    setBatchLoading(true);
    try {
      const result = await transactionAPI.bulkUpdateTransactions({
        transactionIds: Array.from(selectedIds),
        updates: { payee: batchPayeeValue.trim() },
      });
      showSuccess('Payee updated', `Updated ${result.updatedCount} transactions`);
      setShowBatchPayee(false);
      setBatchPayeeValue('');
      await handleSearch(); // Refresh results
      await onTransactionsChanged();
    } catch (error) {
      showError('Update failed', (error as Error).message);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchChangeCategory = async () => {
    if (!batchCategoryId) return;
    setBatchLoading(true);
    try {
      const result = await transactionAPI.bulkUpdateTransactions({
        transactionIds: Array.from(selectedIds),
        updates: { categoryId: batchCategoryId },
      });
      showSuccess('Category updated', `Updated ${result.updatedCount} transactions`);
      setShowBatchCategory(false);
      setBatchCategoryId(null);
      await handleSearch();
      await onTransactionsChanged();
    } catch (error) {
      showError('Update failed', (error as Error).message);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    setBatchLoading(true);
    let successCount = 0;
    try {
      for (const id of selectedIds) {
        await transactionAPI.deleteTransaction(id);
        successCount++;
      }
      showSuccess('Deleted', `Deleted ${successCount} transactions`);
      setShowBatchDelete(false);
      setSelectedIds(new Set());
      await handleSearch();
      await onTransactionsChanged();
    } catch (error) {
      showError('Delete failed', `${successCount} deleted, then: ${(error as Error).message}`);
      await handleSearch();
      await onTransactionsChanged();
    } finally {
      setBatchLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'dd/MM/yyyy');
  };

  return (
    <>
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] z-50 flex flex-col"
            onInteractOutside={(e) => e.preventDefault()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <Search className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white">
                    Search Transactions
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-slate-500 dark:text-slate-400">
                    Find transactions across all accounts or within a specific account
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </Dialog.Close>
            </div>

            {/* Filter Form */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="grid grid-cols-12 gap-3">
                {/* Scope */}
                <div className="col-span-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Scope
                  </label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="global">All Accounts</option>
                    {transferAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payee */}
                <div className="col-span-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Payee / Description
                  </label>
                  <input
                    ref={payeeInputRef}
                    type="text"
                    value={payeeText}
                    onChange={(e) => setPayeeText(e.target.value)}
                    onKeyDown={handleFilterKeyDown}
                    placeholder="e.g. Officeworks"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Category */}
                <div className="col-span-4">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Category
                  </label>
                  <CategorySelector
                    value={categoryId}
                    onChange={setCategoryId}
                    placeholder="Any category"
                  />
                </div>

                {/* Date From */}
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Date From
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    onKeyDown={handleFilterKeyDown}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Date To */}
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Date To
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    onKeyDown={handleFilterKeyDown}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Amount Min */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Amount Min
                  </label>
                  <input
                    type="number"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                    onKeyDown={handleFilterKeyDown}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Amount Max */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Amount Max
                  </label>
                  <input
                    type="number"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                    onKeyDown={handleFilterKeyDown}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Buttons */}
                <div className="col-span-2 flex items-end gap-2">
                  <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    Search
                  </button>
                  <button
                    onClick={handleClearFilters}
                    className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                    title="Clear filters"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Batch Action Toolbar */}
            {selectedIds.size > 0 && (
              <div className="px-6 py-2 border-b border-slate-200 dark:border-slate-700 bg-indigo-50 dark:bg-indigo-900/20 flex items-center gap-3">
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  {selectedIds.size} selected
                </span>
                <div className="flex items-center gap-2">
                  {showBatchPayee ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={batchPayeeValue}
                        onChange={(e) => setBatchPayeeValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleBatchChangePayee()}
                        placeholder="New payee name"
                        autoFocus
                        className="rounded-lg border border-indigo-200 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
                      />
                      <button
                        onClick={handleBatchChangePayee}
                        disabled={batchLoading || !batchPayeeValue.trim()}
                        className="px-3 py-1 bg-indigo-500 text-white rounded-lg text-xs font-semibold hover:bg-indigo-600 disabled:opacity-50"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => {
                          setShowBatchPayee(false);
                          setBatchPayeeValue('');
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setShowBatchPayee(true);
                        setShowBatchCategory(false);
                      }}
                      className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3 h-3" />
                      Change Payee
                    </button>
                  )}

                  {showBatchCategory ? (
                    <div className="flex items-center gap-2">
                      <div className="w-48">
                        <CategorySelector
                          value={batchCategoryId}
                          onChange={setBatchCategoryId}
                          placeholder="Select category"
                        />
                      </div>
                      <button
                        onClick={handleBatchChangeCategory}
                        disabled={batchLoading || !batchCategoryId}
                        className="px-3 py-1 bg-indigo-500 text-white rounded-lg text-xs font-semibold hover:bg-indigo-600 disabled:opacity-50"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => {
                          setShowBatchCategory(false);
                          setBatchCategoryId(null);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setShowBatchCategory(true);
                        setShowBatchPayee(false);
                      }}
                      className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-1.5"
                    >
                      <Tag className="w-3 h-3" />
                      Change Category
                    </button>
                  )}

                  <button
                    onClick={() => setShowBatchDelete(true)}
                    className="px-3 py-1 bg-white dark:bg-slate-700 border border-red-200 dark:border-red-800 rounded-lg text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>
            )}

            {/* Results */}
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                </div>
              ) : !hasSearched ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 dark:text-slate-500">
                  <Search className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">Enter search criteria and click Search</p>
                  <p className="text-xs mt-1">Or press Enter in any field</p>
                </div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 dark:text-slate-500">
                  <p className="text-sm font-medium">No transactions found</p>
                  <p className="text-xs mt-1">Try adjusting your search criteria</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                    <tr className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <th className="px-4 py-2 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === results.length && results.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300"
                        />
                      </th>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Account</th>
                      <th className="px-4 py-2">Payee</th>
                      <th className="px-4 py-2">Category</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                      <th className="px-4 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {results.map((result) => (
                      <tr
                        key={`${result.transactionId}-${result.accountId}`}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors ${
                          selectedIds.has(result.transactionId)
                            ? 'bg-indigo-50 dark:bg-indigo-900/10'
                            : ''
                        }`}
                        onDoubleClick={() => handleNavigate(result)}
                      >
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(result.transactionId)}
                            onChange={() => toggleSelect(result.transactionId)}
                            className="rounded border-slate-300"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap tabular-nums">
                          {formatDate(result.date)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-300">
                            {result.accountName}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-900 dark:text-white font-medium max-w-[200px] truncate">
                          {result.payee}
                          {result.isBusiness && (
                            <span className="ml-2 text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-semibold">
                              BIZ
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400 text-xs">
                          {result.categoryName || (
                            <span className="italic text-slate-300">Transfer</span>
                          )}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-medium tabular-nums whitespace-nowrap ${
                            result.amount < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {formatCurrency(result.amount)}
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => handleNavigate(result)}
                            className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                            title="Go to register"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            {hasSearched && results.length > 0 && (
              <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                <span>
                  {totalCount} result{totalCount !== 1 ? 's' : ''}
                  {totalCount > results.length && ` (showing first ${results.length})`}
                </span>
                <span className="text-xs">
                  Double-click a row to go to the register. Select rows for batch operations.
                </span>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Batch Delete Confirmation */}
      <ConfirmDialog
        isOpen={showBatchDelete}
        onClose={() => setShowBatchDelete(false)}
        onConfirm={handleBatchDelete}
        title="Delete Transactions"
        message={`Are you sure you want to delete ${selectedIds.size} transaction${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </>
  );
}
