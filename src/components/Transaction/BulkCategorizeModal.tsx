/**
 * Bulk Categorize Modal
 * Groups uncategorized transactions by payee and lets users assign categories
 * with optional memorized rule creation for each payee.
 */

import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  Tag,
  CheckCircle,
  Bookmark,
} from 'lucide-react';
import { CategorySelector } from '../Category/CategorySelector';
import { useToast } from '../../hooks/useToast';
import { transactionAPI } from '../../lib/api';

interface PayeeSummary {
  payee: string;
  count: number;
  totalAmount: number;
  earliestDate: string;
  latestDate: string;
  transactionIds: string[];
}

interface Assignment {
  categoryId: string | null;
  createRule: boolean;
}

interface BulkCategorizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void | Promise<void>;
  accountId?: string;
}

export function BulkCategorizeModal({ isOpen, onClose, onComplete, accountId }: BulkCategorizeModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payees, setPayees] = useState<PayeeSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadSummary();
    }
  }, [isOpen]);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const data = await transactionAPI.getUncategorizedSummary(accountId);
      setPayees(data.payees);
      setTotalCount(data.totalCount);

      // Initialize assignments with createRule=true by default
      const initial: Record<string, Assignment> = {};
      for (const p of data.payees) {
        initial[p.payee] = { categoryId: null, createRule: true };
      }
      setAssignments(initial);
    } catch (error) {
      showToast('error', 'Failed to load uncategorized transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (payee: string, categoryId: string | null) => {
    setAssignments(prev => ({
      ...prev,
      [payee]: { ...prev[payee], categoryId },
    }));
  };

  const handleRuleToggle = (payee: string) => {
    setAssignments(prev => ({
      ...prev,
      [payee]: { ...prev[payee], createRule: !prev[payee].createRule },
    }));
  };

  const assignedCount = Object.values(assignments).filter(a => a.categoryId).length;

  const handleSubmit = async () => {
    const toSubmit = Object.entries(assignments)
      .filter(([, a]) => a.categoryId)
      .map(([payee, a]) => ({
        payee,
        categoryId: a.categoryId!,
        createRule: a.createRule,
      }));

    if (toSubmit.length === 0) {
      showToast('error', 'Please assign at least one category');
      return;
    }

    try {
      setSubmitting(true);
      const result = await transactionAPI.bulkRecategorize(toSubmit, accountId);
      showToast('success',
        `Recategorized ${result.updated} transactions` +
        (result.rulesCreated > 0 ? `, created ${result.rulesCreated} rules` : '')
      );
      await onComplete();
      onClose();
    } catch (error) {
      showToast('error', (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] bg-white dark:bg-slate-900 rounded-xl shadow-xl z-50 w-[95vw] max-w-3xl max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
            <div>
              <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-500" />
                Bulk Categorize
              </Dialog.Title>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {totalCount} uncategorized transactions across {payees.length} payees
              </p>
            </div>
            <Dialog.Close asChild>
              <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="text-center py-12 text-slate-500">Loading...</div>
            ) : payees.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-lg font-medium text-slate-900 dark:text-white">All categorized!</p>
                <p className="text-sm text-slate-500 mt-1">No uncategorized transactions found.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payees.map((p) => {
                  const assignment = assignments[p.payee];
                  const isAssigned = !!assignment?.categoryId;

                  return (
                    <div
                      key={p.payee}
                      className={`border rounded-lg p-4 transition-colors ${
                        isAssigned
                          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Payee info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900 dark:text-white truncate">
                              {p.payee}
                            </span>
                            {isAssigned && (
                              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                            <span>{p.count} transaction{p.count > 1 ? 's' : ''}</span>
                            <span>{formatCurrency(p.totalAmount)}</span>
                            <span>
                              {formatDate(p.earliestDate)}
                              {p.earliestDate !== p.latestDate && ` — ${formatDate(p.latestDate)}`}
                            </span>
                          </div>
                        </div>

                        {/* Category selector + rule toggle */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-56">
                            <CategorySelector
                              value={assignment?.categoryId ?? null}
                              onChange={(id) => handleCategoryChange(p.payee, id)}
                              type="EXPENSE"
                              placeholder="Select category..."
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRuleToggle(p.payee)}
                            title={assignment?.createRule ? 'Will create a rule for future imports' : 'No rule will be created'}
                            className={`p-2 rounded-md transition-colors ${
                              assignment?.createRule
                                ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400'
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <Bookmark className={`w-4 h-4 ${assignment?.createRule ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {payees.length > 0 && (
            <div className="flex items-center justify-between p-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Bookmark className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>= create rule for future imports</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">
                  {assignedCount} of {payees.length} assigned
                </span>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || assignedCount === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                >
                  {submitting ? 'Applying...' : `Apply ${assignedCount} Categories`}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
