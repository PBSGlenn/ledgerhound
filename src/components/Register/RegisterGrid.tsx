import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Check, Filter, Tag, Briefcase, User, Loader2 } from 'lucide-react';
import type { RegisterEntry, RegisterFilter } from '../../types';
import { transactionAPI } from '../../lib/api';

interface RegisterGridProps {
  accountId: string;
}

export function RegisterGrid({ accountId }: RegisterGridProps) {
  const [entries, setEntries] = useState<RegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<RegisterFilter>({});

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
                className={`transition-colors cursor-pointer ${
                  selectedIds.has(entry.id)
                    ? 'bg-blue-50 dark:bg-blue-900/10'
                    : idx % 2 === 0
                    ? 'bg-white dark:bg-slate-800'
                    : 'bg-slate-50/50 dark:bg-slate-900/30'
                } hover:bg-slate-100 dark:hover:bg-slate-700/50`}
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
    </div>
  );
}
