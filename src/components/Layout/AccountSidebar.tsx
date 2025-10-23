import { useMemo } from 'react';
import {
  Wallet,
  CreditCard,
  Building2,
  TrendingUp,
  ShoppingCart,
  Briefcase,
  Home,
  Car,
  Coffee,
  Package,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Plus
} from 'lucide-react';
import type { AccountWithBalance, AccountType } from '../../types';

interface AccountSidebarProps {
  accounts: AccountWithBalance[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onRefresh: () => void;
  onAddAccount: () => void;
}

export function AccountSidebar({
  accounts,
  selectedAccountId,
  onSelectAccount,
  collapsed,
  onToggleCollapse,
  onRefresh,
  onAddAccount,
}: AccountSidebarProps) {
  // Group accounts by type
  const accountsByType = useMemo(() => {
    const groups: Record<AccountType, AccountWithBalance[]> = {
      ASSET: [],
      LIABILITY: [],
      EQUITY: [],
      INCOME: [],
      EXPENSE: [],
    };

    accounts.forEach((account) => {
      if (!account.archived) {
        groups[account.type].push(account);
      }
    });

    return groups;
  }, [accounts]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const getAccountIcon = (account: AccountWithBalance) => {
    const iconClass = "w-4 h-4";

    // Check subtype first
    if (account.subtype === 'BANK') return <Wallet className={iconClass} />;
    if (account.subtype === 'CREDIT_CARD') return <CreditCard className={iconClass} />;

    // Check name patterns
    const nameLower = account.name.toLowerCase();
    if (nameLower.includes('business')) return <Briefcase className={iconClass} />;
    if (nameLower.includes('groceries') || nameLower.includes('food')) return <ShoppingCart className={iconClass} />;
    if (nameLower.includes('dining') || nameLower.includes('meals') || nameLower.includes('coffee')) return <Coffee className={iconClass} />;
    if (nameLower.includes('office') || nameLower.includes('supplies')) return <Package className={iconClass} />;
    if (nameLower.includes('home') || nameLower.includes('rent') || nameLower.includes('mortgage')) return <Home className={iconClass} />;
    if (nameLower.includes('car') || nameLower.includes('vehicle') || nameLower.includes('auto')) return <Car className={iconClass} />;
    if (nameLower.includes('sales') || nameLower.includes('income')) return <TrendingUp className={iconClass} />;

    // Fallback by type
    if (account.type === 'ASSET') return <Wallet className={iconClass} />;
    if (account.type === 'LIABILITY') return <CreditCard className={iconClass} />;
    if (account.type === 'INCOME') return <TrendingUp className={iconClass} />;
    if (account.type === 'EXPENSE') return <ShoppingCart className={iconClass} />;

    return <Building2 className={iconClass} />;
  };

  const renderAccountGroup = (type: AccountType, label: string) => {
    const groupAccounts = accountsByType[type];
    if (groupAccounts.length === 0) return null;

    // Calculate group total
    const groupTotal = groupAccounts.reduce((sum, account) => sum + account.currentBalance, 0);

    return (
      <div className="mb-6">
        <div className="flex items-center justify-between px-3 mb-2">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {label}
          </h3>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {formatCurrency(groupTotal)}
          </span>
        </div>
        <div className="space-y-0.5">
          {groupAccounts.map((account) => (
            <button
              key={account.id}
              onClick={() => onSelectAccount(account.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                selectedAccountId === account.id
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`${selectedAccountId === account.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
                  {getAccountIcon(account)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {account.name}
                    </span>
                    {account.isBusinessDefault && (
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        selectedAccountId === account.id
                          ? 'bg-white/20 text-white'
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      }`}>
                        <Briefcase className="w-3 h-3" />
                        Business
                      </span>
                    )}
                  </div>
                  {!collapsed && (
                    <div className={`text-xs mt-0.5 ${
                      selectedAccountId === account.id
                        ? 'text-white/80'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {formatCurrency(account.currentBalance)}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <aside
      className={`bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col transition-all duration-300 shadow-sm ${
        collapsed ? 'w-16' : 'w-72'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">L</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Ledgerhound
              </h2>
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Account list */}
      {!collapsed && (
        <div className="flex-1 overflow-auto p-4">
          {renderAccountGroup('ASSET', 'Assets')}
          {renderAccountGroup('LIABILITY', 'Liabilities')}
          {renderAccountGroup('EQUITY', 'Equity')}
          {renderAccountGroup('INCOME', 'Income')}
          {renderAccountGroup('EXPENSE', 'Expenses')}
        </div>
      )}

      {/* Footer actions */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
        {!collapsed && (
          <>
            <button
              onClick={onAddAccount}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-lg text-sm font-medium shadow-sm hover:shadow transition-all duration-150 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </button>
            <button
              onClick={onRefresh}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm hover:shadow transition-all duration-150 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Accounts
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
