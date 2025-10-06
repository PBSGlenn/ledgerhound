import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Check, Filter, Tag, Briefcase, User, Loader2, Trash2, Edit2, AlertCircle } from 'lucide-react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import type { RegisterEntry, RegisterFilter } from '../../types';
import { transactionAPI } from '../../lib/api';
import { TransactionFormModal } from '../Transaction/TransactionFormModal';

interface RegisterGridProps {
  accountId: string;
}

export function RegisterGrid({ accountId }: RegisterGridProps) {
  const [entries, setEntries] = useState<RegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<RegisterFilter>({});
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [operationLoading, setOperationLoading] = useState<string | null>(null);

  useEffect(() => {
    loadEntries();
  }, [accountId, filter]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const data = await transactionAPI.getRegisterEntries(accountId, filter);
      setEntries(data);
    } catch (error) {
      console.error('Failed to load register entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return format(new Date(date), 'dd/MM/yyyy');
  };

  const getRowClassName = (entry: RegisterEntry, idx: number) => {
    const baseClasses = 'transition-colors cursor-pointer';
    const focusClasses = focusedIndex === idx ? 'ring-2 ring-blue-500 ring-inset' : '';
    const selectionClasses = selectedTransactionId === entry.id ? 'bg-blue-100 dark:bg-blue-900/20' : '';
    const hoverClasses = 'hover:bg-slate-100 dark:hover:bg-slate-700/50';
    const zebraClasses = idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50/50 dark:bg-slate-900/30';
    const loadingClasses = operationLoading === 'edit' && selectedTransactionId === entry.id ? 'opacity-50' : '';
    
    return `${baseClasses} ${focusClasses} ${selectionClasses} ${hoverClasses} ${zebraClasses} ${loadingClasses}`;
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)));
    }
  };

  const handleMarkCleared = async () => {
    const postingIds = entries
      .filter((e) => selectedIds.has(e.id))
      .flatMap((e) => e.postings.filter((p) => p.accountId === accountId).map((p) => p.id));

    try {
      await transactionAPI.markCleared(postingIds, true);
      await loadEntries();
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to mark as cleared:', error);
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      await transactionAPI.deleteTransaction(transactionId);
      await loadEntries();
      setDeletingTransactionId(null);
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      alert('Failed to delete transaction: ' + (error as Error).message);
    }
  };

  const handleEditTransaction = async (transactionId: string) => {
    setOperationLoading('edit');
    try {
      setEditingTransactionId(transactionId);
      setIsCreateMode(false);
      setSelectedTransactionId(transactionId);
    } finally {
      setOperationLoading(null);
    }
  };

  const handleCreateTransaction = () => {
    setEditingTransactionId(null);
    setIsCreateMode(true);
    setSelectedTransactionId(null);
  };

  const handleModalClose = () => {
    setEditingTransactionId(null);
    setIsCreateMode(false);
    setSelectedTransactionId(null);
  };

  const handleRowClick = (transactionId: string, e: React.MouseEvent) => {
    // Don't trigger if clicking on checkbox, buttons, or action elements
    const target = e.target as HTMLElement;
    if (
      target.type === 'checkbox' ||
      target.closest('button') ||
      target.closest('[data-action]') ||
      target.closest('input') ||
      target.closest('select')
    ) {
      return;
    }
    
    // Set as selected and open edit modal
    setSelectedTransactionId(transactionId);
    handleEditTransaction(transactionId);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const selectedEntry = focusedIndex >= 0 ? entries[focusedIndex] : null;

      switch (e.key.toLowerCase()) {
        case 'e':
          if (selectedEntry) {
            handleEditTransaction(selectedEntry.id);
          }
          break;
        case 'd':
          if (selectedEntry) {
            setDeletingTransactionId(selectedEntry.id);
          }
          break;
        case 'c':
          if (selectedEntry) {
            toggleSelection(selectedEntry.id);
          }
          break;
        case 'arrowdown':
          e.preventDefault();
          setFocusedIndex(prev => Math.min(prev + 1, entries.length - 1));
          break;
        case 'arrowup':
          e.preventDefault();
          setFocusedIndex(prev => Math.max(prev - 1, 0));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [entries, focusedIndex]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <div className="text-slate-600 dark:text-slate-400">Loading transactions...</div>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12">
        <div className="text-center max-w-sm mx-auto">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            No transactions yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Get started by adding your first transaction to this account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters and actions */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-800 px-4 py-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selectedIds.size === entries.length && entries.length > 0}
            onChange={toggleAll}
            className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
          </span>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkCleared}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Mark Cleared
            </button>
            <button
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Tag className="w-4 h-4" />
              Add Tag
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter({ ...filter, businessOnly: !filter.businessOnly })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              filter.businessOnly
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Business Only
          </button>
          <button
            onClick={() => setFilter({ ...filter, personalOnly: !filter.personalOnly })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              filter.personalOnly
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            <User className="w-4 h-4" />
            Personal Only
          </button>
        </div>
      </div>

      {/* Register table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="w-12 px-4 py-3"></th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Date
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Payee
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Debit
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Credit
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Balance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {entries.map((entry, idx) => (
              <tr
                key={entry.id}
                onClick={(e) => handleRowClick(entry.id, e)}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={getRowClassName(entry, idx)}
                data-selected={selectedTransactionId === entry.id}
                data-focused={focusedIndex === idx}
                data-loading={operationLoading}
              >
                {/* Row 1: Main transaction info */}
                <td className="px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(entry.id)}
                    onChange={() => toggleSelection(entry.id)}
                    className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {formatDate(entry.date)}
                    </span>
                    {/* Row 2: Category, memo, tags */}
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-1.5 items-center">
                      {entry.postings
                        .filter((p) => p.accountId !== accountId)
                        .map((p, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 && <span className="text-slate-300 dark:text-slate-600">•</span>}
                            <span className="font-medium">{p.account.name}</span>
                            {p.isBusiness && (
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium">
                                BIZ
                              </span>
                            )}
                            {p.gstCode && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                {p.gstCode}
                              </span>
                            )}
                          </span>
                        ))}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {entry.payee}
                    </span>
                    {/* Memo and tags on second line */}
                    {(entry.memo || (entry.tags && entry.tags.length > 0)) && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-1.5 items-center">
                        {entry.memo && <span>{entry.memo}</span>}
                        {entry.tags && entry.tags.length > 0 && entry.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-medium"
                          >
                            #{ tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="text-sm text-red-600 dark:text-red-400 font-semibold tabular-nums">
                    {entry.debit ? formatCurrency(entry.debit) : ''}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                    {entry.credit ? formatCurrency(entry.credit) : ''}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-sm font-bold tabular-nums ${
                      entry.runningBalance >= 0
                        ? 'text-slate-900 dark:text-white'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatCurrency(entry.runningBalance)}
                    </span>
                    {/* Cleared/reconciled badges */}
                    {(entry.cleared || entry.reconciled) && (
                      <div className="flex gap-1">
                        {entry.cleared && (
                          <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-semibold">
                            CLEARED
                          </span>
                        )}
                        {entry.reconciled && (
                          <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded font-semibold">
                            RECONCILED
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 px-6 py-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {entries.length} transaction{entries.length !== 1 ? 's' : ''}
            </span>
            {selectedIds.size > 0 && (
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {selectedIds.size} selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Ending balance:
            </span>
            <span className={`text-lg font-bold tabular-nums ${
              entries.length > 0 && entries[0].runningBalance >= 0
                ? 'text-slate-900 dark:text-white'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {entries.length > 0 && formatCurrency(entries[0].runningBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts help */}
      <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
        Keyboard shortcuts: <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">E</kbd> Edit, <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">D</kbd> Delete, <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">C</kbd> Select, <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">↑</kbd><kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">↓</kbd> Navigate
      </div>

      {/* Edit Transaction Modal */}
      {(editingTransactionId || isCreateMode) && (
        <TransactionFormModal
          isOpen={true}
          onClose={handleModalClose}
          accountId={accountId}
          transactionId={editingTransactionId}
          onSuccess={() => {
            loadEntries();
            handleModalClose();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog.Root open={!!deletingTransactionId} onOpenChange={(open) => !open && setDeletingTransactionId(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <AlertDialog.Title className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Delete Transaction
                </AlertDialog.Title>
                <AlertDialog.Description className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                  Are you sure you want to delete this transaction? This action cannot be undone.
                </AlertDialog.Description>
                <div className="flex items-center gap-3 justify-end">
                  <AlertDialog.Cancel asChild>
                    <button className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                      Cancel
                    </button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action asChild>
                    <button
                      onClick={() => deletingTransactionId && handleDeleteTransaction(deletingTransactionId)}
                      className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </AlertDialog.Action>
                </div>
              </div>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}

