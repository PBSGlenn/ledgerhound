import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { Account, CreateTransactionDTO, GSTCode, AccountType } from '../../types';
import { transactionAPI, accountAPI } from '../../lib/api';
import { CategorySelector } from '../Category/CategorySelector';

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: string; // Pre-select account if opening from register
  transactionId?: string; // For editing existing transaction
  onSuccess?: () => void;
}

export function TransactionFormModal({
  isOpen,
  onClose,
  accountId,
  transactionId,
  onSuccess,
}: TransactionFormModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [payee, setPayee] = useState('');
  const [transactionType, setTransactionType] = useState<'simple' | 'split'>('simple');
  const [totalAmount, setTotalAmount] = useState('');
  const [memo, setMemo] = useState('');
  
  type Split = {
    id: string;
    accountId: string;
    amount: string;
    isBusiness: boolean;
    gstCode?: GSTCode;
  };

  const [splits, setSplits] = useState<Split[]>([]);
  const [remainingAmount, setRemainingAmount] = useState(0);

  useEffect(() => {
    const total = parseFloat(totalAmount) || 0;
    const allocated = splits.reduce((sum, split) => sum + (parseFloat(split.amount) || 0), 0);
    setRemainingAmount(total - allocated);
  }, [totalAmount, splits]);
  const [isBusiness, setIsBusiness] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingTransaction, setLoadingTransaction] = useState(false);
  const [categories, setCategories] = useState<Account[]>([]);
  const [transferAccounts, setTransferAccounts] = useState<Account[]>([]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (transactionId) {
      loadTransaction();
    } else {
      // Reset form for new transaction
      setDate(new Date().toISOString().split('T')[0]);
      setPayee('');
      setTotalAmount('');
      setSplits([{
        id: `temp-${Date.now()}`,
        accountId: '',
        amount: '',
        isBusiness: false,
      }]);
      setMemo('');
      setIsBusiness(false);
    }
  }, [transactionId]);

  const loadTransaction = async () => {
    if (!transactionId) return;

    setLoadingTransaction(true);
    try {
      const transaction = await transactionAPI.getTransaction(transactionId);

      // Populate form from transaction data
      setDate(new Date(transaction.date).toISOString().split('T')[0]);
      setPayee(transaction.payee || '');
      setMemo(transaction.memo || '');

      const categoryPostings = transaction.postings.filter(p => p.accountId !== accountId);
      const total = Math.abs(transaction.postings.find(p => p.accountId === accountId)?.amount || 0);
      setTotalAmount(total.toString());

      if (categoryPostings.length > 1) {
        setTransactionType('split');
        setSplits(categoryPostings.map(p => ({
          id: p.id,
          accountId: p.accountId,
          amount: Math.abs(p.amount).toString(),
          isBusiness: p.isBusiness || false,
          gstCode: p.gstCode || undefined,
        })));
      } else if (categoryPostings.length === 1) {
        setTransactionType('simple');
        setSplits([{
          id: categoryPostings[0].id,
          accountId: categoryPostings[0].accountId,
          amount: Math.abs(categoryPostings[0].amount).toString(),
          isBusiness: categoryPostings[0].isBusiness || false,
          gstCode: categoryPostings[0].gstCode || undefined,
        }]);
      }
    } catch (error) {
      console.error('Failed to load transaction:', error);
      alert('Failed to load transaction');
    } finally {
      setLoadingTransaction(false);
    }
  };

  const loadCategories = async () => {
    try {
      const [categoryAccounts, allTransferAccounts] = await Promise.all([
        accountAPI.getAllAccountsWithBalances({ kind: 'CATEGORY' }),
        accountAPI.getAllAccountsWithBalances({ kind: 'TRANSFER' }),
      ]);
      setCategories(categoryAccounts);
      // Exclude the current account from the list of transfer destinations
      setTransferAccounts(allTransferAccounts.filter(acc => acc.id !== accountId));
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const getAccountType = (accountId: string): AccountType | undefined => {
    const account = [...categories, ...transferAccounts].find(acc => acc.id === accountId);
    return account?.type as AccountType;
  };
  const calculateGST = (total: number) => {
    const gstAmount = total * 0.1 / 1.1;
    const gstExclusive = total - gstAmount;
    return { gstAmount, gstExclusive };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate split totals only in split mode
    if (transactionType === 'split' && Math.abs(remainingAmount) > 0.01) {
      alert('The splits must sum to the total amount.');
      return;
    }

    setLoading(true);

    try {
      const totalAmountNum = parseFloat(totalAmount);

      // Safety check for splits
      if (!splits || splits.length === 0) {
        alert('Please select a category');
        return;
      }

      const categoryPostings = splits.map(split => {
        // In simple mode, use total amount; in split mode, use split amount
        const splitAmountNum = transactionType === 'simple'
          ? totalAmountNum
          : parseFloat(split.amount);
        const accountType = getAccountType(split.accountId);
        const isTransfer = accountType !== 'INCOME' && accountType !== 'EXPENSE';

        const gst = !isTransfer && isBusiness ? calculateGST(splitAmountNum) : null;
        return {
          accountId: split.accountId,
          amount: splitAmountNum,
          isBusiness: !isTransfer && isBusiness,
          gstCode: !isTransfer && isBusiness ? ('GST' as GSTCode) : undefined,
          gstRate: !isTransfer && isBusiness ? 0.1 : undefined,
          gstAmount: gst ? gst.gstAmount : undefined,
        };
      });

      const transactionData = {
        date: new Date(date),
        payee,
        memo: memo || undefined,
        postings: [
          {
            accountId: accountId,
            amount: -totalAmountNum,
            isBusiness: false,
          },
          ...categoryPostings,
        ],
      };

      if (transactionId) {
        await transactionAPI.updateTransaction({ id: transactionId, ...transactionData });
      } else {
        await transactionAPI.createTransaction(transactionData as CreateTransactionDTO);
      }

      // Success!
      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (error) {
      console.error(`Failed to ${transactionId ? 'update' : 'create'} transaction:`, error);
      alert(`Failed to ${transactionId ? 'update' : 'create'} transaction: ` + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!transactionId) return;

    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      await transactionAPI.deleteTransaction(transactionId);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      alert('Failed to delete transaction: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      setDate(new Date().toISOString().split('T')[0]);
      setPayee('');
      setTotalAmount('');
      setSplits([{
        id: `temp-${Date.now()}`,
        accountId: '',
        amount: '',
        isBusiness: false,
      }]);
      setMemo('');
      setIsBusiness(false);
      setTransactionType('simple');
    }
  }, [isOpen]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl z-[101] border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            {transactionId ? 'Edit Transaction' : 'New Transaction'}
          </Dialog.Title>

          {loadingTransaction ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-500 dark:text-slate-400">Loading transaction...</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Date and Payee Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    📅 Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    👤 Payee
                  </label>
                  <input
                    type="text"
                    value={payee}
                    onChange={(e) => setPayee(e.target.value)}
                    required
                    placeholder="Who did you pay?"
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white transition-colors"
                  />
                </div>
              </div>

              {/* Transaction Type Toggle */}
              <div className="flex justify-center mb-4">
                <div className="bg-slate-200 dark:bg-slate-700 p-1 rounded-lg flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTransactionType('simple');
                      // Keep only first split when switching to simple mode
                      if (splits.length > 1) {
                        setSplits([splits[0]]);
                      }
                    }}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${transactionType === 'simple' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                    Simple
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTransactionType('split');
                      // Add a second split if only one exists
                      if (splits.length === 1) {
                        setSplits([
                          splits[0],
                          {
                            id: `temp-${Date.now()}`,
                            accountId: '',
                            amount: '',
                            isBusiness: false,
                          }
                        ]);
                      }
                    }}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${transactionType === 'split' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                    Split
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  💰 Total Amount (AUD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  required
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white transition-colors text-lg font-semibold"
                />
              </div>

              {/* Simple Mode: Single Category */}
              {transactionType === 'simple' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    📁 Category
                  </label>
                  <CategorySelector
                    value={splits[0]?.accountId || null}
                    onChange={(categoryId) => {
                      const newSplits = [...splits];
                      newSplits[0] = {
                        ...newSplits[0],
                        accountId: categoryId || '',
                        amount: totalAmount
                      };
                      setSplits(newSplits);
                    }}
                    placeholder="Select category..."
                    required
                  />

                  {/* Transfer Account Option */}
                  {transferAccounts.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
                        Or transfer to another account
                      </summary>
                      <select
                        value={splits[0]?.accountId || ''}
                        onChange={(e) => {
                          const newSplits = [...splits];
                          newSplits[0] = { ...newSplits[0], accountId: e.target.value, amount: totalAmount };
                          setSplits(newSplits);
                        }}
                        className="w-full mt-2 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white text-sm"
                      >
                        <option value="">Select transfer account...</option>
                        {transferAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </details>
                  )}
                </div>
              )}

              {/* Split Mode: Multiple Categories */}
              {transactionType === 'split' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      📊 Split Categories
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setSplits([...splits, {
                          id: `temp-${Date.now()}`,
                          accountId: '',
                          amount: '',
                          isBusiness: false,
                        }]);
                      }}
                      className="px-3 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                    >
                      + Add Split
                    </button>
                  </div>

                  {/* Split Lines */}
                  <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                    {splits.map((split, index) => (
                      <div key={split.id} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <CategorySelector
                            value={split.accountId || null}
                            onChange={(categoryId) => {
                              const newSplits = [...splits];
                              newSplits[index] = { ...newSplits[index], accountId: categoryId || '' };
                              setSplits(newSplits);
                            }}
                            placeholder="Select category..."
                            required
                          />
                        </div>
                        <div className="w-32">
                          <input
                            type="number"
                            step="0.01"
                            value={split.amount}
                            onChange={(e) => {
                              const newSplits = [...splits];
                              newSplits[index] = { ...newSplits[index], amount: e.target.value };
                              setSplits(newSplits);
                            }}
                            placeholder="0.00"
                            required
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white text-sm"
                          />
                        </div>
                        {splits.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSplits(splits.filter((_, i) => i !== index));
                            }}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            aria-label="Remove split"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Remaining Amount Indicator */}
                    <div className={`mt-3 p-2 rounded-lg text-sm font-medium ${
                      Math.abs(remainingAmount) < 0.01
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                    }`}>
                      <div className="flex justify-between items-center">
                        <span>Remaining to allocate:</span>
                        <span className="font-bold">${remainingAmount.toFixed(2)}</span>
                      </div>
                      {Math.abs(remainingAmount) < 0.01 ? (
                        <div className="text-xs mt-1">✓ Splits balanced</div>
                      ) : remainingAmount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            // Find first empty split and fill it with remaining amount
                            const emptyIndex = splits.findIndex(s => !s.amount || parseFloat(s.amount) === 0);
                            if (emptyIndex !== -1) {
                              const newSplits = [...splits];
                              newSplits[emptyIndex] = {
                                ...newSplits[emptyIndex],
                                amount: remainingAmount.toFixed(2)
                              };
                              setSplits(newSplits);
                            }
                          }}
                          className="text-xs mt-2 px-2 py-1 bg-yellow-200 dark:bg-yellow-800 hover:bg-yellow-300 dark:hover:bg-yellow-700 rounded transition-colors"
                        >
                          Fill remaining to empty split
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Business Toggle - More Prominent */}
              <div className="border-2 border-purple-200 dark:border-purple-800 rounded-lg p-4 bg-purple-50 dark:bg-purple-900/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="business"
                      checked={isBusiness}
                      onChange={(e) => setIsBusiness(e.target.checked)}
                      className="w-5 h-5 rounded border-purple-300 dark:border-purple-600 text-purple-600 focus:ring-2 focus:ring-purple-500"
                    />
                    <label htmlFor="business" className="text-sm font-semibold text-slate-900 dark:text-white cursor-pointer">
                      💼 Business Transaction (track GST)
                    </label>
                  </div>
                  {isBusiness && (
                    <span className="text-xs font-medium px-2 py-1 bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 rounded-full">
                      GST Enabled
                    </span>
                  )}
                </div>
              </div>

            {/* GST Info (only if business) */}
            {isBusiness && totalAmount && parseFloat(totalAmount) > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg text-sm">
                <div className="font-medium text-green-900 dark:text-green-100 mb-2">
                  GST Calculation (10%)
                </div>
                <div className="space-y-1 text-green-800 dark:text-green-200">
                  <div className="flex justify-between">
                    <span>Total (GST inc.):</span>
                    <span className="font-medium">${parseFloat(totalAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST amount:</span>
                    <span className="font-medium">
                      ${calculateGST(parseFloat(totalAmount)).gstAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST-exclusive:</span>
                    <span className="font-medium">
                      ${calculateGST(parseFloat(totalAmount)).gstExclusive.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

              {/* Memo */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  📝 Memo (optional)
                </label>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Add a note..."
                  rows={2}
                  className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-white resize-none transition-colors"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-between gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
                {/* Delete button - only show when editing */}
                {transactionId && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-5 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                )}
                <div className="flex gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg font-semibold shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? 'Saving...' : transactionId ? 'Update Transaction' : 'Save Transaction'}
                  </button>
                </div>
              </div>
            </form>
          )}

          <Dialog.Close asChild>
            <button
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
