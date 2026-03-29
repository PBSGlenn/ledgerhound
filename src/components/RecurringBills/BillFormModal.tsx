import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { AccountWithBalance, RecurringBillWithAccounts, BillFrequency } from '../../types';
import { accountAPI } from '../../lib/api';
import { CategorySelector } from '../Category/CategorySelector';

const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const FREQUENCY_OPTIONS: { value: BillFrequency; label: string }[] = [
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
];

interface BillFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    payee: string;
    expectedAmount: number;
    frequency: BillFrequency;
    dueDay: number;
    startDate: string;
    categoryAccountId: string;
    payFromAccountId: string;
    notes?: string;
  }) => Promise<void>;
  bill?: RecurringBillWithAccounts | null;
}

export function BillFormModal({ isOpen, onClose, onSave, bill }: BillFormModalProps) {
  const [name, setName] = useState('');
  const [payee, setPayee] = useState('');
  const [expectedAmount, setExpectedAmount] = useState('');
  const [frequency, setFrequency] = useState<BillFrequency>('MONTHLY');
  const [dueDay, setDueDay] = useState('1');
  const [startDate, setStartDate] = useState(formatDateForInput(new Date()));
  const [categoryAccountId, setCategoryAccountId] = useState<string | null>(null);
  const [payFromAccountId, setPayFromAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [realAccounts, setRealAccounts] = useState<AccountWithBalance[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
      if (bill) {
        setName(bill.name);
        setPayee(bill.payee);
        setExpectedAmount(String(bill.expectedAmount));
        setFrequency(bill.frequency);
        setDueDay(String(bill.dueDay));
        setStartDate(formatDateForInput(new Date(bill.startDate)));
        setCategoryAccountId(bill.categoryAccountId);
        setPayFromAccountId(bill.payFromAccountId);
        setNotes(bill.notes || '');
      } else {
        setName('');
        setPayee('');
        setExpectedAmount('');
        setFrequency('MONTHLY');
        setDueDay('1');
        setStartDate(formatDateForInput(new Date()));
        setCategoryAccountId(null);
        setPayFromAccountId('');
        setNotes('');
      }
      setError('');
    }
  }, [isOpen, bill]);

  const loadAccounts = async () => {
    try {
      const accounts = await accountAPI.getAllAccountsWithBalances({ kind: 'TRANSFER' });
      setRealAccounts(accounts);
      if (!bill && accounts.length > 0 && !payFromAccountId) {
        setPayFromAccountId(accounts[0].id);
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Name is required'); return; }
    if (!payee.trim()) { setError('Payee is required'); return; }
    if (!expectedAmount || parseFloat(expectedAmount) <= 0) { setError('Amount must be positive'); return; }
    if (!categoryAccountId) { setError('Category is required'); return; }
    if (!payFromAccountId) { setError('Pay from account is required'); return; }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        payee: payee.trim(),
        expectedAmount: parseFloat(expectedAmount),
        frequency,
        dueDay: parseInt(dueDay),
        startDate,
        categoryAccountId,
        payFromAccountId,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const dueDayLabel = frequency === 'WEEKLY' || frequency === 'FORTNIGHTLY'
    ? 'Day of week (1=Mon, 7=Sun)'
    : 'Day of month (1-31)';
  const dueDayMax = frequency === 'WEEKLY' || frequency === 'FORTNIGHTLY' ? 7 : 31;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto z-50">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white">
              {bill ? 'Edit Recurring Bill' : 'New Recurring Bill'}
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Electricity, Internet, Insurance"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Payee</label>
              <input
                type="text"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                placeholder="e.g. AGL Energy, Telstra"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Expected Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={expectedAmount}
                  onChange={(e) => setExpectedAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as BillFrequency)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{dueDayLabel}</label>
                <input
                  type="number"
                  min="1"
                  max={dueDayMax}
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
              <CategorySelector
                value={categoryAccountId}
                onChange={setCategoryAccountId}
                type="EXPENSE"
                placeholder="Select expense category..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pay From Account</label>
              <select
                value={payFromAccountId}
                onChange={(e) => setPayFromAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select account...</option>
                {realAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {saving ? 'Saving...' : bill ? 'Update Bill' : 'Create Bill'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
