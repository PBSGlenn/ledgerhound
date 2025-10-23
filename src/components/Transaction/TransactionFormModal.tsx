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

    if (Math.abs(remainingAmount) > 0.01) {
      alert('The splits must sum to the total amount.');
      return;
    }

    setLoading(true);

    try {
      const totalAmountNum = parseFloat(totalAmount);

      const categoryPostings = splits.map(split => {
        const splitAmountNum = parseFloat(split.amount);
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
                    onClick={() => setTransactionType('simple')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${transactionType === 'simple' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                    Simple
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransactionType('split')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${transactionType === 'split' ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                    Split
                  </button>
                </div>
              </div>

              {/* Amount and Category Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    💰 Amount (AUD)
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

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        📁 Category
                      </label>
                      <CategorySelector
                        value={splits[0]?.accountId || null}
                        onChange={(categoryId) => {
                          const newSplits = [...splits];
                          newSplits[0] = { ...newSplits[0], accountId: categoryId || '' };
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
                              newSplits[0] = { ...newSplits[0], accountId: e.target.value };
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
                  </div>
              </div>

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
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
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
