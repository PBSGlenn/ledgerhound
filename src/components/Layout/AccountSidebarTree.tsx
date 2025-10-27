import { useMemo, useState } from 'react';
import {
  Wallet,
  CreditCard,
  Building2,
  TrendingUp,
  ShoppingCart,
  Briefcase,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  RefreshCw,
  Plus,
  FolderOpen,
  Landmark,
  Banknote
} from 'lucide-react';
import type { AccountWithBalance, AccountType } from '../../types';

type TabType = 'real' | 'categories';

interface AccountSidebarTreeProps {
  accounts: AccountWithBalance[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onRefresh: () => void;
  onAddAccount: () => void;
}

interface TreeNode {
  id: string;
  label: string;
  type?: 'personal' | 'business' | 'income' | 'expense';
  accounts: AccountWithBalance[];
  children?: TreeNode[];
}

export function AccountSidebarTree({
  accounts,
  selectedAccountId,
  onSelectAccount,
  collapsed,
  onToggleCollapse,
  onRefresh,
  onAddAccount,
}: AccountSidebarTreeProps) {
  const [activeTab, setActiveTab] = useState<TabType>('real');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([
    'personal', 'business', 'income', 'expenses',
    'other', 'card', 'bank', 'psp', 'loan', 'investment', 'cash',
    'business-income', 'personal-income', 'business-expenses', 'personal-expenses'
  ]));

  // Filter accounts by tab
  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      if (account.archived) return false;
      return activeTab === 'real' ? account.kind === 'TRANSFER' : account.kind === 'CATEGORY';
    });
  }, [accounts, activeTab]);

  // Build tree structure for Accounts tab
  const accountsTree = useMemo((): TreeNode[] => {
    if (activeTab !== 'real') return [];

    const personalAccounts = filteredAccounts.filter(a => !a.isBusinessDefault);
    const businessAccounts = filteredAccounts.filter(a => a.isBusinessDefault);

    const groupBySubtype = (accts: AccountWithBalance[]) => {
      const groups: Record<string, AccountWithBalance[]> = {};
      accts.forEach(acc => {
        const key = acc.subtype || 'OTHER';
        if (!groups[key]) groups[key] = [];
        groups[key].push(acc);
      });
      return groups;
    };

    const subtypeLabels: Record<string, string> = {
      BANK: 'Savings/Transaction',
      CARD: 'Credit Cards',
      PSP: 'Payment Processors',
      CASH: 'Cash',
      LOAN: 'Loans',
      INVESTMENT: 'Investments',
      OTHER: 'Other'
    };

    const buildSubtypeNodes = (groupedAccounts: Record<string, AccountWithBalance[]>): TreeNode[] => {
      return Object.entries(groupedAccounts).map(([subtype, accts]) => ({
        id: subtype.toLowerCase(),
        label: subtypeLabels[subtype] || subtype,
        accounts: accts || [],
        children: undefined
      }));
    };

    const tree: TreeNode[] = [];

    if (personalAccounts.length > 0) {
      tree.push({
        id: 'personal',
        label: 'Personal Accounts',
        type: 'personal',
        accounts: [],
        children: buildSubtypeNodes(groupBySubtype(personalAccounts))
      });
    }

    if (businessAccounts.length > 0) {
      tree.push({
        id: 'business',
        label: 'Business Accounts',
        type: 'business',
        accounts: [],
        children: buildSubtypeNodes(groupBySubtype(businessAccounts))
      });
    }

    return tree;
  }, [filteredAccounts, activeTab]);

  // Build tree structure for Categories tab
  const categoriesTree = useMemo((): TreeNode[] => {
    if (activeTab !== 'categories') return [];

    const incomeAccounts = filteredAccounts.filter(a => a.type === 'INCOME');
    const expenseAccounts = filteredAccounts.filter(a => a.type === 'EXPENSE');
    const otherAccounts = filteredAccounts.filter(a => a.type !== 'INCOME' && a.type !== 'EXPENSE');

    const tree: TreeNode[] = [];

    if (incomeAccounts.length > 0) {
      const businessIncome = incomeAccounts.filter(a => a.isBusinessDefault);
      const personalIncome = incomeAccounts.filter(a => !a.isBusinessDefault);

      const children: TreeNode[] = [];
      if (businessIncome.length > 0) {
        children.push({ id: 'business-income', label: 'Business Income', accounts: businessIncome });
      }
      if (personalIncome.length > 0) {
        children.push({ id: 'personal-income', label: 'Personal Income', accounts: personalIncome });
      }

      tree.push({
        id: 'income',
        label: 'Income',
        type: 'income',
        accounts: [],
        children
      });
    }

    if (expenseAccounts.length > 0) {
      const businessExpense = expenseAccounts.filter(a => a.isBusinessDefault);
      const personalExpense = expenseAccounts.filter(a => !a.isBusinessDefault);

      const children: TreeNode[] = [];
      if (businessExpense.length > 0) {
        children.push({ id: 'business-expenses', label: 'Business Expenses', accounts: businessExpense });
      }
      if (personalExpense.length > 0) {
        children.push({ id: 'personal-expenses', label: 'Personal Expenses', accounts: personalExpense });
      }

      tree.push({
        id: 'expenses',
        label: 'Expenses',
        type: 'expense',
        accounts: [],
        children
      });
    }

    // Add other account types (GST, etc.)
    if (otherAccounts.length > 0) {
      tree.push({
        id: 'other',
        label: 'Other',
        accounts: otherAccounts
      });
    }

    return tree;
  }, [filteredAccounts, activeTab]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const getAccountIcon = (account: AccountWithBalance) => {
    const iconClass = "w-4 h-4";
    if (account.subtype === 'BANK') return <Landmark className={iconClass} />;
    if (account.subtype === 'CARD') return <CreditCard className={iconClass} />;
    if (account.subtype === 'PSP') return <Banknote className={iconClass} />;
    if (account.type === 'INCOME') return <TrendingUp className={iconClass} />;
    if (account.type === 'EXPENSE') return <ShoppingCart className={iconClass} />;
    return <Wallet className={iconClass} />;
  };

  const renderTreeNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = (node.children && node.children.length > 0) || (node.accounts && node.accounts.length > 0);
    const paddingLeft = depth * 12;

    return (
      <div key={`${activeTab}-${node.id}`}>
        {/* Section header */}
        <button
          onClick={() => hasChildren && toggleNode(node.id)}
          className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-2"
          style={{ paddingLeft: `${paddingLeft + 12}px` }}
        >
          {hasChildren && (
            isExpanded ?
              <ChevronDown className="w-4 h-4 text-slate-500" /> :
              <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            {node.label}
          </span>
        </button>

        {/* Direct accounts in this node */}
        {isExpanded && node.accounts && node.accounts.length > 0 && (
          <div>
            {node.accounts.map(account => (
              <button
                key={`${activeTab}-${node.id}-${account.id}`}
                onClick={() => onSelectAccount(account.id)}
                className={`w-full text-left px-3 py-2 transition-all duration-150 group flex items-center gap-2 ${
                  selectedAccountId === account.id
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                }`}
                style={{ paddingLeft: `${paddingLeft + 32}px` }}
              >
                <div className={selectedAccountId === account.id ? 'text-white' : 'text-slate-400'}>
                  {getAccountIcon(account)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{account.name}</span>
                    <span className={`text-xs ml-2 ${
                      selectedAccountId === account.id ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {formatCurrency(account.currentBalance)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Child nodes */}
        {isExpanded && node.children && node.children.length > 0 && (
          <div>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const currentTree = activeTab === 'real' ? accountsTree : categoriesTree;

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

      {/* Tabs */}
      {!collapsed && (
        <div className="px-4 pt-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-2 pb-3">
            <button
              onClick={() => setActiveTab('real')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center justify-center gap-2 ${
                activeTab === 'real'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Wallet className="w-4 h-4" />
              Accounts
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 flex items-center justify-center gap-2 ${
                activeTab === 'categories'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              Categories
            </button>
          </div>
        </div>
      )}

      {/* Tree view */}
      {!collapsed && (
        <div className="flex-1 overflow-auto py-2">
          {currentTree.map(node => renderTreeNode(node, 0))}
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
