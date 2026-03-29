import { useState, useEffect } from 'react';
import { Plus, Receipt, Pause, Play, Trash2, Edit2, DollarSign, SkipForward, AlertCircle } from 'lucide-react';
import type { RecurringBillWithAccounts, BillFrequency } from '../../types';
import { recurringBillAPI } from '../../lib/api';
import { BillFormModal } from './BillFormModal';
import { PayBillModal } from './PayBillModal';
import { ConfirmDialog } from '../Common/ConfirmDialog';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

const formatDate = (date: string | Date) =>
  new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));

const FREQUENCY_LABELS: Record<BillFrequency, string> = {
  WEEKLY: 'Weekly',
  FORTNIGHTLY: 'Fortnightly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
};

function getDaysUntilDue(nextDueDate: string | Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(nextDueDate);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getDueLabel(nextDueDate: string | Date): { text: string; className: string } {
  const days = getDaysUntilDue(nextDueDate);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, className: 'text-red-600 dark:text-red-400 font-semibold' };
  if (days === 0) return { text: 'Due today', className: 'text-orange-600 dark:text-orange-400 font-semibold' };
  if (days <= 7) return { text: `Due in ${days}d`, className: 'text-amber-600 dark:text-amber-400' };
  return { text: formatDate(nextDueDate), className: 'text-slate-600 dark:text-slate-400' };
}

type FilterTab = 'all' | 'active' | 'paused';

interface RecurringBillsViewProps {
  onTransactionCreated?: () => void | Promise<void>;
}

export function RecurringBillsView({ onTransactionCreated }: RecurringBillsViewProps) {
  const [bills, setBills] = useState<RecurringBillWithAccounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');

  const [showForm, setShowForm] = useState(false);
  const [editBill, setEditBill] = useState<RecurringBillWithAccounts | null>(null);
  const [payBill, setPayBill] = useState<RecurringBillWithAccounts | null>(null);
  const [deleteBill, setDeleteBill] = useState<RecurringBillWithAccounts | null>(null);

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
    try {
      const data = await recurringBillAPI.getAll();
      setBills(data);
    } catch (err) {
      console.error('Failed to load recurring bills:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: Parameters<typeof recurringBillAPI.create>[0]) => {
    await recurringBillAPI.create(data);
    await loadBills();
  };

  const handleUpdate = async (data: Parameters<typeof recurringBillAPI.create>[0]) => {
    if (!editBill) return;
    await recurringBillAPI.update(editBill.id, data);
    await loadBills();
  };

  const handlePay = async (id: string, amount?: number, date?: string) => {
    await recurringBillAPI.recordPayment(id, amount, date);
    await loadBills();
    if (onTransactionCreated) await onTransactionCreated();
  };

  const handleSkip = async (bill: RecurringBillWithAccounts) => {
    await recurringBillAPI.skipOccurrence(bill.id);
    await loadBills();
  };

  const handleToggleStatus = async (bill: RecurringBillWithAccounts) => {
    const newStatus = bill.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    await recurringBillAPI.update(bill.id, { status: newStatus });
    await loadBills();
  };

  const handleDelete = async () => {
    if (!deleteBill) return;
    await recurringBillAPI.delete(deleteBill.id);
    setDeleteBill(null);
    await loadBills();
  };

  const filteredBills = bills.filter((bill) => {
    if (filter === 'active') return bill.status === 'ACTIVE';
    if (filter === 'paused') return bill.status === 'PAUSED';
    return true;
  });

  const activeBills = bills.filter((b) => b.status === 'ACTIVE');
  const monthlyEquivalent = activeBills.reduce((sum, bill) => {
    switch (bill.frequency) {
      case 'WEEKLY': return sum + bill.expectedAmount * 52 / 12;
      case 'FORTNIGHTLY': return sum + bill.expectedAmount * 26 / 12;
      case 'MONTHLY': return sum + bill.expectedAmount;
      case 'QUARTERLY': return sum + bill.expectedAmount / 3;
      case 'YEARLY': return sum + bill.expectedAmount / 12;
      default: return sum;
    }
  }, 0);

  const overdueBills = activeBills.filter((b) => getDaysUntilDue(b.nextDueDate) < 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="w-6 h-6" />
            Recurring Bills
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Manage your regular payments and subscriptions
          </p>
        </div>
        <button
          onClick={() => { setEditBill(null); setShowForm(true); }}
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm hover:shadow flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Bill
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Active Bills</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">{activeBills.length}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Monthly Cost (est.)</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(monthlyEquivalent)}</div>
        </div>
        <div className={`bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border ${overdueBills.length > 0 ? 'border-red-300 dark:border-red-700' : 'border-slate-200 dark:border-slate-700'}`}>
          <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Overdue</div>
          <div className={`text-xl font-bold ${overdueBills.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
            {overdueBills.length}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
        {(['all', 'active', 'paused'] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              filter === tab
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Bills List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading bills...</div>
        ) : filteredBills.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            {filter === 'all' ? 'No recurring bills yet. Create one to get started!' : `No ${filter} bills.`}
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {filteredBills.map((bill) => {
              const dueLabel = getDueLabel(bill.nextDueDate);
              const isOverdue = getDaysUntilDue(bill.nextDueDate) < 0;
              const isPaused = bill.status === 'PAUSED';

              return (
                <div
                  key={bill.id}
                  className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${isPaused ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-white">{bill.name}</span>
                        {isPaused && (
                          <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                            Paused
                          </span>
                        )}
                        {isOverdue && !isPaused && (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                        <span>{bill.payee}</span>
                        <span>{FREQUENCY_LABELS[bill.frequency]}</span>
                        <span>{bill.categoryAccount.name}</span>
                        <span>from {bill.payFromAccount.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 ml-4">
                      {/* Due date */}
                      <div className="text-right min-w-[100px]">
                        <div className={`text-sm ${dueLabel.className}`}>{dueLabel.text}</div>
                        {bill.lastPaidDate && (
                          <div className="text-xs text-slate-400 dark:text-slate-500">
                            Last paid {formatDate(bill.lastPaidDate)}
                          </div>
                        )}
                      </div>

                      {/* Amount */}
                      <div className="text-right min-w-[90px]">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(bill.expectedAmount)}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {!isPaused && (
                          <>
                            <button
                              onClick={() => setPayBill(bill)}
                              className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md"
                              title="Record payment"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleSkip(bill)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
                              title="Skip this occurrence"
                            >
                              <SkipForward className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleToggleStatus(bill)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
                          title={isPaused ? 'Resume' : 'Pause'}
                        >
                          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => { setEditBill(bill); setShowForm(true); }}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteBill(bill)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <BillFormModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditBill(null); }}
        onSave={editBill ? handleUpdate : handleCreate}
        bill={editBill}
      />

      <PayBillModal
        isOpen={!!payBill}
        onClose={() => setPayBill(null)}
        onPay={handlePay}
        bill={payBill}
      />

      <ConfirmDialog
        isOpen={!!deleteBill}
        title="Delete Recurring Bill"
        message={`Are you sure you want to delete "${deleteBill?.name}"? This will not affect any previously recorded payments.`}
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onClose={() => setDeleteBill(null)}
      />
    </div>
  );
}
