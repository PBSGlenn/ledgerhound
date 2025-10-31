import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Briefcase, DollarSign, Calendar, Hash } from 'lucide-react';
import type { AccountWithBalance, AccountType, AccountSubtype } from '../../types';
import { accountAPI } from '../../lib/api';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  onSuccess?: () => void;
}

export function AccountSettingsModal({
  isOpen,
  onClose,
  accountId,
  onSuccess,
}: AccountSettingsModalProps) {
  const [account, setAccount] = useState<AccountWithBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [isBusinessDefault, setIsBusinessDefault] = useState(false);
  const [defaultHasGst, setDefaultHasGst] = useState(true);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState('AUD');
  const [sortOrder, setSortOrder] = useState('0');

  useEffect(() => {
    if (isOpen && accountId) {
      loadAccount();
    }
  }, [isOpen, accountId]);

  const loadAccount = async () => {
    setLoading(true);
    try {
      const accounts = await accountAPI.getAllAccountsWithBalances();
      const acc = accounts.find(a => a.id === accountId);
      if (acc) {
        setAccount(acc);
        setName(acc.name);
        setIsBusinessDefault(acc.isBusinessDefault || false);
        setDefaultHasGst(acc.defaultHasGst ?? true);
        setOpeningBalance((acc.openingBalance || 0).toFixed(2));
        setOpeningDate(acc.openingDate ? new Date(acc.openingDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        setCurrency(acc.currency || 'AUD');
        setSortOrder(acc.sortOrder?.toString() || '0');
      }
    } catch (error) {
      console.error('Failed to load account:', error);
      alert('Failed to load account settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!account) return;

    // Validate name
    if (!name.trim()) {
      alert('Account name is required');
      return;
    }

    setSaving(true);
    try {
      await accountAPI.updateAccount(accountId, {
        name: name.trim(),
        isBusinessDefault,
        defaultHasGst,
        openingBalance: parseFloat(openingBalance) || 0,
        openingDate: new Date(openingDate),
        currency,
        sortOrder: parseInt(sortOrder) || 0,
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to save account settings:', error);
      alert('Failed to save account settings');
    } finally {
      setSaving(false);
    }
  };

  if (!account && !loading) {
    return null;
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto z-50">
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Loading...</p>
            </div>
          ) : account ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-white">
                    Account Settings
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {account.name} ({account.type})
                  </Dialog.Description>
                </div>
                <Dialog.Close className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-slate-500" />
                </Dialog.Close>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Account Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter account name"
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    required
                  />
                </div>

                {/* Business Default - Only show for CATEGORY accounts */}
                {account.kind === 'CATEGORY' && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <input
                        type="checkbox"
                        id="isBusinessDefault"
                        checked={isBusinessDefault}
                        onChange={(e) => setIsBusinessDefault(e.target.checked)}
                        className="mt-0.5 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <label htmlFor="isBusinessDefault" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">Business Account</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                          Transactions to this category are business-related
                        </p>
                      </label>
                    </div>

                    {/* GST Default - Only show if Business is enabled */}
                    {isBusinessDefault && (
                      <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border-l-4 border-purple-400">
                        <input
                          type="checkbox"
                          id="defaultHasGst"
                          checked={defaultHasGst}
                          onChange={(e) => setDefaultHasGst(e.target.checked)}
                          className="mt-0.5 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                        <label htmlFor="defaultHasGst" className="flex-1 cursor-pointer">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">Apply GST by default</span>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            Auto-split GST when used (uncheck for GST-free items like bank fees)
                          </p>
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {/* Opening Balance & Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5" />
                        Opening Balance
                      </div>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setOpeningBalance(val.toFixed(2));
                      }}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Current: {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(account.currentBalance)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Opening Date
                      </div>
                    </label>
                    <input
                      type="date"
                      value={openingDate}
                      onChange={(e) => setOpeningDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Currency & Sort Order */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="AUD">AUD</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5" />
                        Sort Order
                      </div>
                    </label>
                    <input
                      type="number"
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      placeholder="0"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Lower = first
                    </p>
                  </div>
                </div>

                {/* Account Info (Read-only) */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">Account Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Type:</span>
                      <span className="ml-2 text-slate-900 dark:text-white font-medium">{account.type}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Kind:</span>
                      <span className="ml-2 text-slate-900 dark:text-white font-medium">{account.kind}</span>
                    </div>
                    {account.subtype && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Subtype:</span>
                        <span className="ml-2 text-slate-900 dark:text-white font-medium">{account.subtype}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Real Account:</span>
                      <span className="ml-2 text-slate-900 dark:text-white font-medium">{account.isReal ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 p-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg font-medium shadow-sm hover:shadow transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
