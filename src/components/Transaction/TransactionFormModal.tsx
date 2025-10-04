import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { Account, CreateTransactionDTO, GSTCode } from '../../types';
import { transactionAPI, accountAPI } from '../../lib/api';

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: string; // Pre-select account if opening from register
  onSuccess?: () => void;
}

export function TransactionFormModal({
  isOpen,
  onClose,
  accountId,
  onSuccess,
}: TransactionFormModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [memo, setMemo] = useState('');
  const [isBusiness, setIsBusiness] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Account[]>([]);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const allAccounts = await accountAPI.getAllAccountsWithBalances();
      // Filter to only income and expense accounts (categories)
      const categoryAccounts = allAccounts.filter(
        (acc) => acc.type === 'INCOME' || acc.type === 'EXPENSE'
      );
      setCategories(categoryAccounts);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const calculateGST = (total: number) => {
    const gstAmount = total * 0.1 / 1.1;
    const gstExclusive = total - gstAmount;
    return { gstAmount, gstExclusive };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!accountId) {
      alert('Please select an account first');
      return;
    }

    setLoading(true);

    try {
      const amountNum = parseFloat(amount);
      const gst = isBusiness ? calculateGST(amountNum) : null;

      const transactionData: CreateTransactionDTO = {
        date: new Date(date),
        payee,
        memo: memo || undefined,
        postings: [
          // Source account (bank/card)
          {
            accountId: accountId,
            amount: -amountNum,
            isBusiness: false,
          },
          // Category (expense/income)
          {
            accountId: categoryId,
            amount: amountNum,
            isBusiness,
            gstCode: isBusiness ? ('GST' as GSTCode) : undefined,
            gstRate: isBusiness ? 0.1 : undefined,
            gstAmount: gst ? gst.gstAmount : undefined,
          },
        ],
      };

      await transactionAPI.createTransaction(transactionData);

      // Success!
      if (onSuccess) {
        onSuccess();
      }

      // Reset form
      setPayee('');
      setAmount('');
      setCategoryId('');
      setMemo('');
      setIsBusiness(false);

      onClose();
    } catch (error) {
      console.error('Failed to create transaction:', error);
      alert('Failed to create transaction: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl z-50">
          <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            New Transaction
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Payee */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Payee
              </label>
              <input
                type="text"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                required
                placeholder="Who did you pay?"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Amount (AUD)
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select category...</option>
                <optgroup label="Expenses">
                  {categories
                    .filter((c) => c.type === 'EXPENSE')
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                        {cat.isBusinessDefault ? ' (Business)' : ''}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Income">
                  {categories
                    .filter((c) => c.type === 'INCOME')
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                        {cat.isBusinessDefault ? ' (Business)' : ''}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            {/* Business Toggle */}
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <input
                type="checkbox"
                id="business"
                checked={isBusiness}
                onChange={(e) => setIsBusiness(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <label htmlFor="business" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                This is a business expense (track GST)
              </label>
            </div>

            {/* GST Info (only if business) */}
            {isBusiness && amount && parseFloat(amount) > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg text-sm">
                <div className="font-medium text-green-900 dark:text-green-100 mb-2">
                  GST Calculation (10%)
                </div>
                <div className="space-y-1 text-green-800 dark:text-green-200">
                  <div className="flex justify-between">
                    <span>Total (GST inc.):</span>
                    <span className="font-medium">${parseFloat(amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST amount:</span>
                    <span className="font-medium">
                      ${calculateGST(parseFloat(amount)).gstAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST-exclusive:</span>
                    <span className="font-medium">
                      ${calculateGST(parseFloat(amount)).gstExclusive.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Memo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Memo (optional)
              </label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? 'Saving...' : 'Save Transaction'}
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
