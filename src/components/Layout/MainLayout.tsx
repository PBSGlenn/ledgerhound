import { useState, useEffect } from 'react';
import { AccountSidebar } from './AccountSidebar';
import { TopBar } from './TopBar';
import { RegisterView } from '../Register/RegisterView';
import type { AccountWithBalance } from '../../types';
import { accountAPI } from '../../lib/api';

export function MainLayout() {
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await accountAPI.getAllAccountsWithBalances();
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Sidebar */}
      <AccountSidebar
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelectAccount={setSelectedAccountId}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onRefresh={loadAccounts}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <TopBar
          selectedAccount={
            selectedAccountId
              ? accounts.find((a) => a.id === selectedAccountId)
              : undefined
          }
          onRefresh={loadAccounts}
        />

        {/* Content */}
        <main className="flex-1 overflow-auto p-8">
          {selectedAccountId ? (
            <RegisterView accountId={selectedAccountId} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <span className="text-4xl text-white font-bold">L</span>
                </div>
                <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">
                  Welcome to Ledgerhound
                </h2>
                <p className="text-lg text-slate-600 dark:text-slate-300 mb-8">
                  Personal & Small-Business Ledger for Australia
                </p>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Select an account from the sidebar to view transactions, or create a new account to get started.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
