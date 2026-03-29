import { useEffect, useState } from 'react';
import { Receipt, DollarSign, ChevronRight, AlertCircle } from 'lucide-react';
import type { UpcomingBill } from '../../types';
import { recurringBillAPI } from '../../lib/api';
import { PayBillModal } from '../RecurringBills/PayBillModal';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

function getDueLabel(daysUntilDue: number): { text: string; className: string } {
  if (daysUntilDue < 0) return { text: `${Math.abs(daysUntilDue)}d overdue`, className: 'text-red-600 dark:text-red-400 font-semibold' };
  if (daysUntilDue === 0) return { text: 'Due today', className: 'text-orange-600 dark:text-orange-400 font-semibold' };
  if (daysUntilDue <= 3) return { text: `${daysUntilDue}d`, className: 'text-amber-600 dark:text-amber-400' };
  return { text: `${daysUntilDue}d`, className: 'text-slate-500 dark:text-slate-400' };
}

interface UpcomingBillsWidgetProps {
  onNavigateToBills: () => void;
  onTransactionCreated?: () => void | Promise<void>;
}

export function UpcomingBillsWidget({ onNavigateToBills, onTransactionCreated }: UpcomingBillsWidgetProps) {
  const [bills, setBills] = useState<UpcomingBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [payBill, setPayBill] = useState<UpcomingBill | null>(null);

  useEffect(() => {
    loadUpcoming();
  }, []);

  const loadUpcoming = async () => {
    try {
      const data = await recurringBillAPI.getUpcoming(14);
      setBills(data);
    } catch {
      // Non-critical widget
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (id: string, amount?: number, date?: string) => {
    await recurringBillAPI.recordPayment(id, amount, date);
    await loadUpcoming();
    if (onTransactionCreated) await onTransactionCreated();
  };

  if (loading) return null;
  if (bills.length === 0) return null;

  const overdue = bills.filter((b) => b.isOverdue);
  const upcoming = bills.filter((b) => !b.isOverdue);

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Upcoming Bills</h2>
              {overdue.length > 0 && (
                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-medium">
                  {overdue.length} overdue
                </span>
              )}
            </div>
            <button
              onClick={onNavigateToBills}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
            >
              View all
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {[...overdue, ...upcoming].slice(0, 5).map((bill) => {
            const dueLabel = getDueLabel(bill.daysUntilDue);
            return (
              <div
                key={bill.id}
                className={`p-2 px-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                  bill.isOverdue ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {bill.isOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                    <span className="font-medium text-slate-900 dark:text-white text-sm truncate">
                      {bill.name}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {bill.payee}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {formatCurrency(bill.expectedAmount)}
                    </div>
                    <div className={`text-xs ${dueLabel.className}`}>{dueLabel.text}</div>
                  </div>
                  <button
                    onClick={() => setPayBill(bill)}
                    className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                    title="Record payment"
                  >
                    <DollarSign className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <PayBillModal
        isOpen={!!payBill}
        onClose={() => setPayBill(null)}
        onPay={handlePay}
        bill={payBill}
      />
    </>
  );
}
