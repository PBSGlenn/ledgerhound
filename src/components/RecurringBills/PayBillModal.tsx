import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, DollarSign } from 'lucide-react';
import type { RecurringBillWithAccounts, UpcomingBill } from '../../types';

const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

interface PayBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPay: (id: string, amount?: number, date?: string) => Promise<void>;
  bill: RecurringBillWithAccounts | UpcomingBill | null;
}

export function PayBillModal({ isOpen, onClose, onPay, bill }: PayBillModalProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(formatDateForInput(new Date()));
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && bill) {
      setAmount(String(bill.expectedAmount));
      setDate(formatDateForInput(new Date()));
      setError('');
    }
  }, [isOpen, bill]);

  if (!bill) return null;

  const billName = bill.name;
  const billPayee = bill.payee;
  const categoryName = 'categoryAccount' in bill
    ? (bill as RecurringBillWithAccounts).categoryAccount.name
    : (bill as UpcomingBill).categoryAccountName;
  const payFromName = 'payFromAccount' in bill
    ? (bill as RecurringBillWithAccounts).payFromAccount.name
    : (bill as UpcomingBill).payFromAccountName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Amount must be positive');
      return;
    }

    setPaying(true);
    try {
      const overrideAmount = parsedAmount !== bill.expectedAmount ? parsedAmount : undefined;
      await onPay(bill.id, overrideAmount, date);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPaying(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-md z-50">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              Record Payment
            </Dialog.Title>
            <Dialog.Close className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="mb-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Bill:</span>
              <span className="font-medium text-slate-900 dark:text-white">{billName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Payee:</span>
              <span className="text-slate-700 dark:text-slate-300">{billPayee}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Category:</span>
              <span className="text-slate-700 dark:text-slate-300">{categoryName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Pay from:</span>
              <span className="text-slate-700 dark:text-slate-300">{payFromName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Expected:</span>
              <span className="text-slate-700 dark:text-slate-300">{formatCurrency(bill.expectedAmount)}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Payment Amount
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Payment Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={paying}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
              >
                {paying ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
