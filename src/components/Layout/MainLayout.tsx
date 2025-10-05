import { useState, useEffect } from 'react';
import { AccountSidebar } from './AccountSidebar';
import { TopBar } from './TopBar';
import { RegisterView } from '../Register/RegisterView';
import { DashboardView } from '../Dashboard/DashboardView';
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
            <DashboardView accounts={accounts} onSelectAccount={setSelectedAccountId} />
          )}
        </main>
      </div>
    </div>
  );
}
