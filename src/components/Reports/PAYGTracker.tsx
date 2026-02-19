import { useState, useEffect } from 'react';
import { Calendar, Loader2, Save, Plus, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { taxAPI } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import type { PAYGConfig, PAYGInstallment } from '../../types';

interface PAYGTrackerProps {
  financialYear: string;
}

export function PAYGTracker({ financialYear }: PAYGTrackerProps) {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<PAYGConfig | null>(null);
  const [editingQuarter, setEditingQuarter] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');

  useEffect(() => {
    loadConfig();
  }, [financialYear]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await taxAPI.getPAYGConfig(financialYear);
      setConfig(data);
    } catch (error) {
      showError('Failed to load', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleInitialize = async (method: 'amount' | 'rate') => {
    setSaving(true);
    try {
      // Create default config
      const newConfig: PAYGConfig = {
        financialYear,
        method,
        installments: getDefaultInstallments(financialYear, method),
      };
      await taxAPI.savePAYGConfig(newConfig);
      setConfig(newConfig);
      showSuccess('PAYG initialized', `PAYG tracking set up for FY ${financialYear}`);
    } catch (error) {
      showError('Failed to initialize', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async (quarter: string) => {
    if (!config || !paymentAmount) return;
    setSaving(true);
    try {
      const updatedConfig = { ...config };
      const inst = updatedConfig.installments.find(i => i.quarter === quarter);
      if (inst) {
        inst.paidAmount = parseFloat(paymentAmount);
        inst.paidDate = paymentDate || new Date().toISOString().split('T')[0];
        inst.status = 'paid';
      }
      await taxAPI.savePAYGConfig(updatedConfig);
      setConfig(updatedConfig);
      setEditingQuarter(null);
      setPaymentAmount('');
      setPaymentDate('');
      showSuccess('Payment recorded', `${quarter} payment of $${paymentAmount} recorded`);
    } catch (error) {
      showError('Failed to record', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAssessedAmount = async (quarter: string, amount: number) => {
    if (!config) return;
    const updatedConfig = { ...config };
    const inst = updatedConfig.installments.find(i => i.quarter === quarter);
    if (inst) {
      inst.assessedAmount = amount;
    }
    setConfig(updatedConfig);
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await taxAPI.savePAYGConfig(config);
      showSuccess('Saved', 'PAYG configuration saved');
    } catch (error) {
      showError('Failed to save', (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Loading PAYG data...</span>
      </div>
    );
  }

  // Not yet initialized
  if (!config) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
        <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Set Up PAYG Installments for FY {financialYear}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
          Track your quarterly PAYG installment obligations and payments.
          Choose how the ATO has assessed your installments.
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => handleInitialize('amount')}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Fixed Amount Method
          </button>
          <button
            onClick={() => handleInitialize('rate')}
            disabled={saving}
            className="px-6 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500 disabled:opacity-50"
          >
            Rate-Based Method
          </button>
        </div>
      </div>
    );
  }

  const totalAssessed = config.installments.reduce((sum, i) => sum + (i.assessedAmount ?? 0), 0);
  const totalPaid = config.installments.reduce((sum, i) => sum + (i.paidAmount ?? 0), 0);
  const remaining = totalAssessed - totalPaid;

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
              PAYG Installments
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              FY {financialYear} &mdash; {config.method === 'amount' ? 'Fixed Amount' : 'Rate-Based'} Method
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>

        {/* Installments Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-slate-600 dark:text-slate-400 border-b dark:border-slate-700">
                <th className="px-6 py-3">Quarter</th>
                <th className="px-6 py-3">Period</th>
                <th className="px-6 py-3">Due Date</th>
                <th className="px-6 py-3 text-right">Assessed</th>
                <th className="px-6 py-3 text-right">Paid</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {config.installments.map((inst) => (
                <tr
                  key={inst.id}
                  className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {inst.quarter}
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400">
                    {formatDate(inst.periodStart)} &ndash; {formatDate(inst.periodEnd)}
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400">
                    {formatDate(inst.dueDate)}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <input
                      type="number"
                      value={inst.assessedAmount ?? ''}
                      onChange={(e) => handleUpdateAssessedAmount(inst.quarter, parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-28 px-2 py-1 text-right font-mono text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                    />
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-sm">
                    {inst.paidAmount != null ? (
                      <span className="text-green-600 dark:text-green-400">
                        {formatCurrency(inst.paidAmount)}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <StatusBadge status={inst.status} />
                  </td>
                  <td className="px-6 py-3">
                    {inst.status !== 'paid' ? (
                      editingQuarter === inst.quarter ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            placeholder="Amount"
                            className="w-24 px-2 py-1 text-sm border rounded font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                          />
                          <input
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="px-2 py-1 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                          />
                          <button
                            onClick={() => handleRecordPayment(inst.quarter)}
                            disabled={saving || !paymentAmount}
                            className="px-2 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Record'}
                          </button>
                          <button
                            onClick={() => { setEditingQuarter(null); setPaymentAmount(''); setPaymentDate(''); }}
                            className="px-2 py-1 text-sm text-slate-500 hover:text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingQuarter(inst.quarter);
                            setPaymentAmount(inst.assessedAmount?.toString() ?? '');
                            setPaymentDate(new Date().toISOString().split('T')[0]);
                          }}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Pay
                        </button>
                      )
                    ) : (
                      <span className="text-xs text-slate-400">
                        {inst.paidDate ? formatDate(inst.paidDate) : ''}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Assessed</div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {formatCurrency(totalAssessed)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Paid</div>
          <div className="text-xl font-bold font-mono text-green-600">
            {formatCurrency(totalPaid)}
          </div>
        </div>
        <div className={`rounded-lg border p-4 ${remaining > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}>
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Remaining</div>
          <div className={`text-xl font-bold font-mono ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {formatCurrency(remaining)}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PAYGInstallment['status'] }) {
  const styles: Record<string, string> = {
    upcoming: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
    due: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };

  const icons: Record<string, React.ReactNode> = {
    upcoming: <Clock className="w-3 h-3" />,
    due: <AlertCircle className="w-3 h-3" />,
    overdue: <AlertCircle className="w-3 h-3" />,
    paid: <CheckCircle2 className="w-3 h-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function getDefaultInstallments(financialYear: string, method: 'amount' | 'rate'): PAYGInstallment[] {
  const [startYearStr] = financialYear.split('-');
  const startYear = parseInt(startYearStr, 10);
  const endYear = startYear + 1;

  return [
    {
      id: `${financialYear}-Q1`,
      quarter: 'Q1',
      financialYear,
      periodStart: `${startYear}-07-01`,
      periodEnd: `${startYear}-09-30`,
      dueDate: `${startYear}-10-28`,
      method,
      status: 'upcoming',
    },
    {
      id: `${financialYear}-Q2`,
      quarter: 'Q2',
      financialYear,
      periodStart: `${startYear}-10-01`,
      periodEnd: `${startYear}-12-31`,
      dueDate: `${endYear}-02-28`,
      method,
      status: 'upcoming',
    },
    {
      id: `${financialYear}-Q3`,
      quarter: 'Q3',
      financialYear,
      periodStart: `${endYear}-01-01`,
      periodEnd: `${endYear}-03-31`,
      dueDate: `${endYear}-04-28`,
      method,
      status: 'upcoming',
    },
    {
      id: `${financialYear}-Q4`,
      quarter: 'Q4',
      financialYear,
      periodStart: `${endYear}-04-01`,
      periodEnd: `${endYear}-06-30`,
      dueDate: `${endYear}-07-28`,
      method,
      status: 'upcoming',
    },
  ];
}
