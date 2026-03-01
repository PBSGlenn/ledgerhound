import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { Check, CheckCircle, Filter, Tag, Briefcase, User, Loader2, Trash2, Edit2, AlertCircle, Download, Upload, ArrowLeftRight, ExternalLink, Search, FolderInput, Shield, MoveRight } from 'lucide-react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import type { RegisterEntry, RegisterFilter, Account, AccountWithBalance } from '../../types';
import { transactionAPI, accountAPI } from '../../lib/api';
import { TransactionFormModal } from '../Transaction/TransactionFormModal';
import { AccountSettingsModal } from '../Account/AccountSettingsModal';
import { BankStatementImport } from '../Import/BankStatementImport';
import { StripeImportModal } from '../Stripe/StripeImportModal';
import { BulkCategorizeModal } from '../Transaction/BulkCategorizeModal';
import { CategorySelector } from '../Category/CategorySelector';
import * as Dialog from '@radix-ui/react-dialog';
import { generateCSV, downloadCSV, formatDateForCSV, formatCurrencyForCSV } from '../../lib/utils/csvExport';
import { useToast } from '../../hooks/useToast';

import { useDebounce } from '../../hooks/useDebounce';

interface RegisterGridProps {
  accountId: string;
  highlightTransactionId?: string | null;
  onNavigateToAccount?: (accountId: string, transactionId: string) => void;
  onSearchPayee?: (payee: string) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  entry: RegisterEntry;
}

export function RegisterGrid({ accountId, highlightTransactionId, onNavigateToAccount, onSearchPayee }: RegisterGridProps) {
  const { showSuccess, showError } = useToast();
  const [entries, setEntries] = useState<RegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<RegisterFilter>({});
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const lastRowRef = useRef<HTMLTableRowElement>(null);
  const selectedRowRef = useRef<HTMLTableRowElement>(null);
  const highlightRowRef = useRef<HTMLTableRowElement>(null);
  const [scrollToSelected, setScrollToSelected] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  useEffect(() => {
    setFilter(prev => ({ ...prev, search: debouncedSearchTerm }));
  }, [debouncedSearchTerm]);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showStripeImportModal, setShowStripeImportModal] = useState(false);
  const [showBulkCategorize, setShowBulkCategorize] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [recategorizingEntry, setRecategorizingEntry] = useState<RegisterEntry | null>(null);
  const [recategorizeCategory, setRecategorizeCategory] = useState<string | null>(null);
  const [movingEntry, setMovingEntry] = useState<RegisterEntry | null>(null);
  const [moveTargetAccountId, setMoveTargetAccountId] = useState<string | null>(null);
  const [transferAccounts, setTransferAccounts] = useState<AccountWithBalance[]>([]);

  useEffect(() => {
    loadEntries();
  }, [accountId, filter]);

  // Load account details
  useEffect(() => {
    const loadAccount = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/accounts/${accountId}`);
        if (response.ok) {
          const data = await response.json();
          setAccount(data);
        }
      } catch (error) {
        console.error('Failed to load account:', error);
      }
    };
    loadAccount();
  }, [accountId]);

  // Auto-scroll to most recent transaction (bottom of list) when entries first load
  // Skip when there's a highlight target (let the highlight scroll handle it)
  useEffect(() => {
    if (!loading && entries.length > 0 && !scrollToSelected && !highlightTransactionId && lastRowRef.current) {
      // Use a small delay to ensure DOM is fully rendered
      setTimeout(() => {
        lastRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
    }
  }, [loading, entries.length, highlightTransactionId]);

  // Scroll to the selected/saved transaction after entries reload
  useEffect(() => {
    if (!loading && scrollToSelected && selectedRowRef.current) {
      setTimeout(() => {
        selectedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      setScrollToSelected(false);
    }
  }, [loading, scrollToSelected, entries]);

  // Step 1: Set highlighted ID when data finishes loading
  useEffect(() => {
    if (!loading && highlightTransactionId && entries.length > 0) {
      const found = entries.some(e => e.id === highlightTransactionId);
      console.log('[Highlight] Setting highlight:', highlightTransactionId, 'found in entries:', found, 'entries count:', entries.length);
      setHighlightedId(highlightTransactionId);
    }
  }, [loading, highlightTransactionId, entries]);

  // Step 2: Scroll to the highlighted row once it renders, then clear after 3s
  useEffect(() => {
    if (!highlightedId) return;
    // Refs are assigned during commit phase (before this effect runs),
    // but use a short delay for layout to stabilize after data load
    const scrollTimer = setTimeout(() => {
      console.log('[Highlight] Scrolling to ref:', highlightRowRef.current ? 'found' : 'NULL');
      highlightRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
    const clearTimer = setTimeout(() => setHighlightedId(null), 3000);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [highlightedId]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const data = await transactionAPI.getRegisterEntries(accountId, filter);
      setEntries(data);
    } catch (error) {
      showError('Failed to load transactions', (error as Error).message);
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
    const isSelected = selectedTransactionId === entry.id;
    const baseClasses = 'transition-colors cursor-pointer';
    const focusClasses = focusedIndex === idx ? 'ring-2 ring-blue-500 ring-inset' : '';
    const bgClasses = isSelected
      ? 'bg-emerald-100 dark:bg-emerald-900/30'
      : idx % 2 === 0
        ? 'bg-white dark:bg-slate-800'
        : 'bg-slate-50/50 dark:bg-slate-900/30';
    const hoverClasses = isSelected ? '' : 'hover:bg-slate-100 dark:hover:bg-slate-700/50';
    const loadingClasses = operationLoading === 'edit' && isSelected ? 'opacity-50' : '';

    return `${baseClasses} ${focusClasses} ${bgClasses} ${hoverClasses} ${loadingClasses}`;
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

  const [taggingTransactionIds, setTaggingTransactionIds] = useState<string[]>([]);

  const handleAddTag = () => {
    setTaggingTransactionIds(Array.from(selectedIds));
  };

  const handleTagSubmit = async (tag: string) => {
    try {
      await transactionAPI.bulkAddTags(taggingTransactionIds, [tag]);
      await loadEntries();
      setTaggingTransactionIds([]);
      setSelectedIds(new Set());
      showSuccess('Tags added', `Tag "${tag}" has been added to ${taggingTransactionIds.length} transaction(s)`);
    } catch (error) {
      showError('Failed to add tag', (error as Error).message);
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
      showSuccess('Transactions cleared', `${postingIds.length} transaction(s) marked as cleared`);
    } catch (error) {
      showError('Failed to mark as cleared', (error as Error).message);
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      await transactionAPI.deleteTransaction(transactionId);
      await loadEntries();
      setDeletingTransactionId(null);
      showSuccess('Transaction deleted', 'The transaction has been successfully deleted');
    } catch (error) {
      showError('Failed to delete transaction', (error as Error).message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = confirm(
      `Are you sure you want to delete ${selectedIds.size} transaction(s)? This action cannot be undone.`
    );

    if (!confirmed) return;

    const transactionIds = Array.from(selectedIds);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const transactionId of transactionIds) {
        try {
          await transactionAPI.deleteTransaction(transactionId);
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Failed to delete transaction ${transactionId}:`, error);
        }
      }

      await loadEntries();
      setSelectedIds(new Set());

      if (errorCount === 0) {
        showSuccess('Transactions deleted', `${successCount} transaction(s) successfully deleted`);
      } else {
        showError('Partial deletion', `${successCount} deleted, ${errorCount} failed`);
      }
    } catch (error) {
      showError('Failed to delete transactions', (error as Error).message);
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
    // Keep selectedTransactionId so the row stays highlighted after modal close
  };

  const handleExportCSV = () => {
    try {
      const csv = generateCSV(entries, [
        { header: 'Date', accessor: (row) => formatDateForCSV(row.date) },
        { header: 'Payee', accessor: (row) => row.payee },
        { header: 'Memo', accessor: (row) => row.memo || '' },
        { header: 'Category', accessor: (row) => row.postings.filter((p: any) => p.accountId !== accountId).map((p: any) => p.account.name).join('; ') },
        { header: 'Debit', accessor: (row) => row.debit ? formatCurrencyForCSV(row.debit) : '' },
        { header: 'Credit', accessor: (row) => row.credit ? formatCurrencyForCSV(row.credit) : '' },
        { header: 'Balance', accessor: (row) => formatCurrencyForCSV(row.runningBalance) },
        { header: 'Cleared', accessor: (row) => row.cleared ? 'Yes' : 'No' },
        { header: 'Reconciled', accessor: (row) => row.reconciled ? 'Yes' : 'No' },
        { header: 'Tags', accessor: (row) => row.tags ? row.tags.join('; ') : '' },
      ]);

      const today = format(new Date(), 'yyyy-MM-dd');
      downloadCSV(csv, `register-export-${today}.csv`);
      showSuccess('Export complete', `Exported ${entries.length} transactions to CSV`);
    } catch (error) {
      showError('Export failed', (error as Error).message);
    }
  };

  const handleRowClick = (transactionId: string, e: React.MouseEvent) => {
    // Open account settings to edit opening balance
    if (transactionId.startsWith('opening-')) {
      setShowAccountSettings(true);
      return;
    }

    // Don't trigger if clicking on checkbox, buttons, or action elements
    const target = e.target as HTMLElement;
    if (
      (target as HTMLInputElement).type === 'checkbox' ||
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

  const handleContextMenu = (entry: RegisterEntry, e: React.MouseEvent) => {
    if (entry.id.startsWith('opening-')) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  // Close context menu on click-outside or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [contextMenu]);

  const handleRecategorize = (entry: RegisterEntry) => {
    // Pre-select the current category if there is one
    const categoryPosting = entry.postings.find(p => p.accountId !== accountId && p.account.kind === 'CATEGORY');
    setRecategorizeCategory(categoryPosting?.accountId ?? null);
    setRecategorizingEntry(entry);
  };

  const handleRecategorizeSubmit = async () => {
    if (!recategorizingEntry || !recategorizeCategory) return;

    // Find the posting to change (the non-current-account posting)
    const oldPosting = recategorizingEntry.postings.find(p => p.accountId !== accountId);
    if (!oldPosting) return;

    try {
      setOperationLoading('recategorize');
      await transactionAPI.recategorize(recategorizingEntry.id, oldPosting.accountId, recategorizeCategory);
      showSuccess('Transaction recategorized');
      setRecategorizingEntry(null);
      setRecategorizeCategory(null);
      await loadEntries();
    } catch (error) {
      showError((error as Error).message);
    } finally {
      setOperationLoading(null);
    }
  };

  const handleMoveToAccount = async (entry: RegisterEntry) => {
    // Load transfer accounts for the picker (excluding current account)
    try {
      const accounts = await accountAPI.getAllAccountsWithBalances({ kind: 'TRANSFER' });
      setTransferAccounts(accounts.filter(a => a.id !== accountId && !a.archived));
    } catch {
      showError('Failed to load accounts');
      return;
    }
    setMoveTargetAccountId(null);
    setMovingEntry(entry);
  };

  const handleMoveSubmit = async () => {
    if (!movingEntry || !moveTargetAccountId) return;

    try {
      setOperationLoading('move');
      await transactionAPI.moveToAccount(movingEntry.id, accountId, moveTargetAccountId);
      const target = transferAccounts.find(a => a.id === moveTargetAccountId);
      showSuccess(`Transaction moved to ${target?.name || 'account'}`);
      setMovingEntry(null);
      setMoveTargetAccountId(null);
      await loadEntries();
    } catch (error) {
      showError((error as Error).message);
    } finally {
      setOperationLoading(null);
    }
  };

  /**
   * For a given register entry, find the other TRANSFER-kind account
   * (i.e. the other side of a bank-to-bank transfer).
   */
  const getOtherTransferAccount = (entry: RegisterEntry) => {
    return entry.postings.find(
      (p) => p.accountId !== accountId && p.account.kind === 'TRANSFER'
    );
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

  // Modals rendered unconditionally so they survive loading/empty state re-renders
  const modals = (
    <>
      {/* Edit Transaction Modal */}
      {(editingTransactionId || isCreateMode) && (
        <TransactionFormModal
          isOpen={true}
          onClose={handleModalClose}
          accountId={accountId}
          transactionId={editingTransactionId || undefined}
          onSuccess={async (savedTransactionId?: string) => {
            if (savedTransactionId) {
              setSelectedTransactionId(savedTransactionId);
              setScrollToSelected(true);
            }
            await loadEntries();
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

      {/* Import CSV Modal */}
      <BankStatementImport
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        accountId={accountId}
        accountName={account?.name || "Account"}
        onImportComplete={async () => {
          await loadEntries();
        }}
      />

      {/* Stripe Import Modal */}
      <StripeImportModal
        isOpen={showStripeImportModal}
        onClose={() => setShowStripeImportModal(false)}
        onSuccess={async () => {
          await loadEntries();
        }}
      />

      {/* Account Settings Modal (for editing opening balance) */}
      <AccountSettingsModal
        isOpen={showAccountSettings}
        onClose={() => setShowAccountSettings(false)}
        accountId={accountId}
        onSuccess={async () => {
          await loadEntries();
        }}
      />

      {/* Bulk Categorize Modal */}
      <BulkCategorizeModal
        isOpen={showBulkCategorize}
        onClose={() => setShowBulkCategorize(false)}
        onComplete={async () => {
          await loadEntries();
        }}
        accountId={account?.id}
      />

      {/* Recategorize Dialog */}
      <Dialog.Root open={!!recategorizingEntry} onOpenChange={(open) => {
        if (!open) {
          setRecategorizingEntry(null);
          setRecategorizeCategory(null);
        }
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] bg-white dark:bg-slate-900 rounded-xl shadow-xl z-50 w-[95vw] max-w-md p-5">
            <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
              <FolderInput className="w-5 h-5 text-amber-500" />
              Recategorize
            </Dialog.Title>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {recategorizingEntry?.payee}
              {recategorizingEntry?.debit ? ` — ${formatCurrency(recategorizingEntry.debit)} debit` : ''}
              {recategorizingEntry?.credit ? ` — ${formatCurrency(recategorizingEntry.credit)} credit` : ''}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
              <CategorySelector
                value={recategorizeCategory}
                onChange={setRecategorizeCategory}
                placeholder="Select new category..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setRecategorizingEntry(null); setRecategorizeCategory(null); }}
                className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleRecategorizeSubmit}
                disabled={!recategorizeCategory || operationLoading === 'recategorize'}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
              >
                {operationLoading === 'recategorize' ? 'Saving...' : 'Apply'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Move to Account Dialog */}
      <Dialog.Root open={!!movingEntry} onOpenChange={(open) => {
        if (!open) {
          setMovingEntry(null);
          setMoveTargetAccountId(null);
        }
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] bg-white dark:bg-slate-900 rounded-xl shadow-xl z-50 w-[95vw] max-w-md p-5">
            <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
              <MoveRight className="w-5 h-5 text-teal-500" />
              Move to Account
            </Dialog.Title>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {movingEntry?.payee}
              {movingEntry?.debit ? ` — ${formatCurrency(movingEntry.debit)} debit` : ''}
              {movingEntry?.credit ? ` — ${formatCurrency(movingEntry.credit)} credit` : ''}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Destination Account</label>
              <select
                value={moveTargetAccountId || ''}
                onChange={(e) => setMoveTargetAccountId(e.target.value || null)}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select account...</option>
                {transferAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setMovingEntry(null); setMoveTargetAccountId(null); }}
                className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleMoveSubmit}
                disabled={!moveTargetAccountId || operationLoading === 'move'}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
              >
                {operationLoading === 'move' ? 'Moving...' : 'Move'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <div className="text-slate-600 dark:text-slate-400">Loading transactions...</div>
          </div>
        </div>
        {modals}
      </>
    );
  }

  if (entries.length === 0) {
    return (
      <>
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
        {modals}
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* Advanced Filters */}
      <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-400">From:</label>
          <input
            type="date"
            value={filter.dateFrom ? format(filter.dateFrom, 'yyyy-MM-dd') : ''}
            onChange={(e) => setFilter({ ...filter, dateFrom: new Date(e.target.value) })}
            className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-400">To:</label>
          <input
            type="date"
            value={filter.dateTo ? format(filter.dateTo, 'yyyy-MM-dd') : ''}
            onChange={(e) => setFilter({ ...filter, dateTo: new Date(e.target.value) })}
            className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search payee, memo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="cleared-filter"
            checked={filter.cleared || false}
            onChange={(e) => setFilter({ ...filter, cleared: e.target.checked })}
            className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="cleared-filter" className="text-sm font-medium text-slate-600 dark:text-slate-400">Cleared</label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="reconciled-filter"
            checked={filter.reconciled || false}
            onChange={(e) => setFilter({ ...filter, reconciled: e.target.checked })}
            className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="reconciled-filter" className="text-sm font-medium text-slate-600 dark:text-slate-400">Reconciled</label>
        </div>
      </div>

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
              onClick={handleAddTag}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Tag className="w-4 h-4" />
              Add Tag
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Delete
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
          {account?.subtype === 'PSP' && (
            <button
              onClick={() => setShowStripeImportModal(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              Sync from Stripe
            </button>
          )}
          {account?.name === 'Uncategorized' && (
            <button
              onClick={() => setShowBulkCategorize(true)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Tag className="w-4 h-4" />
              Bulk Categorize
            </button>
          )}
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Add Tag Dialog */}
      <AlertDialog.Root open={taggingTransactionIds.length > 0} onOpenChange={() => setTaggingTransactionIds([])}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-md border border-slate-200 dark:border-slate-700">
            <AlertDialog.Title className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Add Tag to {taggingTransactionIds.length} Transaction(s)
            </AlertDialog.Title>
            <div className="mt-4">
              <input
                type="text"
                id="tag-input"
                placeholder="Enter tag name..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleTagSubmit((e.target as HTMLInputElement).value);
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-3 justify-end mt-6">
              <AlertDialog.Cancel asChild>
                <button className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={() => {
                    const input = document.getElementById('tag-input') as HTMLInputElement;
                    handleTagSubmit(input.value);
                  }}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Add Tag
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      {/* Register table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="w-12 px-4 py-3"></th>
              <th className="text-left px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Date
              </th>
              <th className="text-left px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Payee
              </th>
              <th className="text-right px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Debit
              </th>
              <th className="text-right px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Credit
              </th>
              <th className="text-right px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Balance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {entries.map((entry, idx) => (
              <tr
                key={entry.id}
                ref={(el) => {
                  if (idx === entries.length - 1) (lastRowRef as React.MutableRefObject<HTMLTableRowElement | null>).current = el;
                  if (selectedTransactionId === entry.id) (selectedRowRef as React.MutableRefObject<HTMLTableRowElement | null>).current = el;
                  if (highlightedId === entry.id) (highlightRowRef as React.MutableRefObject<HTMLTableRowElement | null>).current = el;
                }}
                onClick={(e) => handleRowClick(entry.id, e)}
                onContextMenu={(e) => handleContextMenu(entry, e)}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={`${getRowClassName(entry, idx)}${highlightedId === entry.id ? ' ring-2 ring-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 animate-pulse' : ''}`}
                data-selected={selectedTransactionId === entry.id}
                data-focused={focusedIndex === idx}
                data-loading={operationLoading}
              >
                {/* Row 1: Main transaction info */}
                <td className="px-3 py-1">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(entry.id)}
                    onChange={() => toggleSelection(entry.id)}
                    className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-3 py-1">
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
                <td className="px-3 py-1">
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
                <td className="px-3 py-1 text-right">
                  <span className="text-sm text-red-600 dark:text-red-400 font-semibold tabular-nums">
                    {entry.debit ? formatCurrency(entry.debit) : ''}
                  </span>
                </td>
                <td className="px-3 py-1 text-right">
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                    {entry.credit ? formatCurrency(entry.credit) : ''}
                  </span>
                </td>
                <td className="px-3 py-1 text-right">
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
              entries.length > 0 && entries[entries.length - 1].runningBalance >= 0
                ? 'text-slate-900 dark:text-white'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {entries.length > 0 && formatCurrency(entries[entries.length - 1].runningBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts help */}
      <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
        Keyboard shortcuts: <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">E</kbd> Edit, <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">D</kbd> Delete, <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">C</kbd> Select, <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">↑</kbd><kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">↓</kbd> Navigate
      </div>

      {modals}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[180px]"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 200),
            top: Math.min(contextMenu.y, window.innerHeight - 200),
          }}
        >
          {(() => {
            const otherTransfer = getOtherTransferAccount(contextMenu.entry);
            return otherTransfer && onNavigateToAccount ? (
              <button
                onClick={() => {
                  onNavigateToAccount(otherTransfer.accountId, contextMenu.entry.id);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
              >
                <ArrowLeftRight className="w-4 h-4 text-indigo-500" />
                Go to {otherTransfer.account.name}
              </button>
            ) : null;
          })()}
          {onSearchPayee && contextMenu.entry.payee && (
            <button
              onClick={() => {
                onSearchPayee(contextMenu.entry.payee);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
            >
              <Search className="w-4 h-4 text-indigo-500" />
              Search for &ldquo;{contextMenu.entry.payee}&rdquo;
            </button>
          )}
          <button
            onClick={() => {
              handleRecategorize(contextMenu.entry);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
          >
            <FolderInput className="w-4 h-4 text-amber-500" />
            Recategorize
          </button>
          <button
            onClick={() => {
              handleMoveToAccount(contextMenu.entry);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
          >
            <MoveRight className="w-4 h-4 text-teal-500" />
            Move to Account
          </button>
          <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
          <button
            onClick={async () => {
              const entry = contextMenu.entry;
              const postingIds = entry.postings.filter(p => p.accountId === accountId).map(p => p.id);
              setContextMenu(null);
              try {
                await transactionAPI.markCleared(postingIds, !entry.cleared);
                await loadEntries();
              } catch (error) {
                showError('Failed to update cleared status', (error as Error).message);
              }
            }}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
          >
            <CheckCircle className={`w-4 h-4 ${contextMenu.entry.cleared ? 'text-blue-500' : 'text-slate-400'}`} />
            {contextMenu.entry.cleared ? 'Mark Uncleared' : 'Mark Cleared'}
          </button>
          <button
            onClick={async () => {
              const entry = contextMenu.entry;
              const postingIds = entry.postings.filter(p => p.accountId === accountId).map(p => p.id);
              setContextMenu(null);
              try {
                await transactionAPI.markReconciled(postingIds, !entry.reconciled);
                await loadEntries();
              } catch (error) {
                showError('Failed to update reconciled status', (error as Error).message);
              }
            }}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
          >
            <Shield className={`w-4 h-4 ${contextMenu.entry.reconciled ? 'text-purple-500' : 'text-slate-400'}`} />
            {contextMenu.entry.reconciled ? 'Mark Unreconciled' : 'Mark Reconciled'}
          </button>
          <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
          <button
            onClick={() => {
              handleEditTransaction(contextMenu.entry.id);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
          >
            <Edit2 className="w-4 h-4 text-slate-500" />
            Edit Transaction
          </button>
          <button
            onClick={() => {
              setDeletingTransactionId(contextMenu.entry.id);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Transaction
          </button>
        </div>
      )}
    </div>
  );
}

