import { useState, useEffect } from 'react';
import { AccountSidebarTree } from './AccountSidebarTree';
import { TopBar } from './TopBar';
import { RegisterView } from '../Register/RegisterView';
import { DashboardView } from '../Dashboard/DashboardView';
import { ReportsView } from '../Reports/ReportsView';
import { ReconciliationView } from '../Reconciliation/ReconciliationView';
import { SettingsView } from '../Settings/SettingsView';
import { BookSwitcher } from '../Book/BookSwitcher';
import { OnboardingWizard } from '../Onboarding/OnboardingWizard';
import type { AccountWithBalance } from '../../types';
import type { Book } from '../../types/book';
import { BankStatementImport } from '../Import/BankStatementImport';
import { StripeImportWizard } from '../../features/import/StripeImportWizard';
import { accountAPI } from '../../lib/api';

type ViewType = 'dashboard' | 'register' | 'reports' | 'reconciliation' | 'settings';

interface MainLayoutProps {
  currentBook: Book;
  onSwitchBook: (bookId: string) => void;
  onShowAccountSetup: () => void;
}

export function MainLayout({ currentBook, onSwitchBook, onShowAccountSetup }: MainLayoutProps) {
  const [showNewBookWizard, setShowNewBookWizard] = useState(false);
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');

  const [isImporting, setIsImporting] = useState(false);
  const [isStripeImporting, setIsStripeImporting] = useState(false);
  const [registerRefreshKey, setRegisterRefreshKey] = useState(0);

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

  // Refresh both accounts AND trigger register to reload
  const handleTransactionSaved = async () => {
    await loadAccounts();
    setRegisterRefreshKey(prev => prev + 1);
  };

  const handleNewBookCreated = (bookId: string) => {
    setShowNewBookWizard(false);
    onSwitchBook(bookId);
  };

  if (showNewBookWizard) {
    return <OnboardingWizard onComplete={handleNewBookCreated} />;
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Book Switcher - Top Left */}
      <div className="absolute top-4 left-4 z-10">
        <BookSwitcher
          currentBook={currentBook}
          onSwitchBook={onSwitchBook}
          onCreateNew={() => setShowNewBookWizard(true)}
        />
      </div>

      {/* Sidebar */}
      <AccountSidebarTree
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelectAccount={(id) => {
          setSelectedAccountId(id);
          setCurrentView('register');
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onRefresh={loadAccounts}
        onAddAccount={onShowAccountSetup}
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
          onRefresh={handleTransactionSaved}
          onImportClick={() => setIsImporting(true)}
          onStripeImportClick={() => setIsStripeImporting(true)}
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
          onSettingsClick={() => setCurrentView('settings')}
        />

        {/* Content */}
        <main className="flex-1 overflow-auto p-8">
          {currentView === 'settings' ? (
            <SettingsView />
          ) : currentView === 'reports' ? (
            <ReportsView />
          ) : currentView === 'reconciliation' && selectedAccountId ? (
            <ReconciliationView
              account={accounts.find((a) => a.id === selectedAccountId)!}
            />
          ) : selectedAccountId ? (
            <RegisterView key={registerRefreshKey} accountId={selectedAccountId} />
          ) : (
            <DashboardView
              accounts={accounts}
              onSelectAccount={(id) => {
                setSelectedAccountId(id);
                setCurrentView('register');
              }}
              onShowAccountSetup={onShowAccountSetup}
            />
          )}
        </main>
      </div>

      {isImporting && (
        <BankStatementImport
          isOpen={isImporting}
          onClose={() => setIsImporting(false)}
          onImportComplete={loadAccounts}
          accountId={selectedAccountId || undefined}
          accountName={
            selectedAccountId
              ? accounts.find((a) => a.id === selectedAccountId)?.name
              : undefined
          }
        />
      )}

      {isStripeImporting && (
        <StripeImportWizard
          onClose={() => {
            setIsStripeImporting(false);
            loadAccounts();
          }}
        />
      )}
    </div>
  );
}
