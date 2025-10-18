import { useState, useEffect } from 'react';
import { AccountSidebar } from './AccountSidebar';
import { TopBar } from './TopBar';
import { RegisterView } from '../Register/RegisterView';
import { DashboardView } from '../Dashboard/DashboardView';
import { ReportsView } from '../Reports/ReportsView';
import { ReconciliationView } from '../Reconciliation/ReconciliationView';
import type { AccountWithBalance } from '../../types';
import { ImportWizard } from '../../features/import/ImportWizard';
import { accountAPI } from '../../lib/api';

type ViewType = 'dashboard' | 'register' | 'reports' | 'reconciliation';

export function MainLayout() {
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  const [isImporting, setIsImporting] = useState(false);

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
          currentView={currentView}
          onRefresh={loadAccounts}
          onImportClick={() => setIsImporting(true)}
          onReportsClick={() => setCurrentView('reports')}
          onReconcileClick={() => {
            if (selectedAccountId) {
              setCurrentView('reconciliation');
            }
          }}
          onDashboardClick={() => {
            setCurrentView('dashboard');
            setSelectedAccountId(null);
          }}
        />

        {/* Content */}
        <main className="flex-1 overflow-auto p-8">
          {currentView === 'reports' ? (
            <ReportsView />
          ) : currentView === 'reconciliation' && selectedAccountId ? (
            <ReconciliationView
              account={accounts.find((a) => a.id === selectedAccountId)!}
            />
          ) : selectedAccountId ? (
            <RegisterView accountId={selectedAccountId} />
          ) : (
            <DashboardView
              accounts={accounts}
              onSelectAccount={(id) => {
                setSelectedAccountId(id);
                setCurrentView('register');
              }}
            />
          )}
        </main>
      </div>

      {isImporting && (
        <ImportWizard
          isOpen={isImporting}
          onClose={() => setIsImporting(false)}
          onImportSuccess={loadAccounts}
        />
      )}
    </div>
  );
}
