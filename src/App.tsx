import { useState, useEffect } from 'react';
import { MainLayout } from './components/Layout/MainLayout';
import { OnboardingWizard } from './components/Onboarding/OnboardingWizard';
import { AccountSetupWizard } from './components/Account/AccountSetupWizard';
import { ToastProvider } from './components/UI/Toast';
import { ToastContextProvider } from './hooks/useToast';
import { bookManager } from './lib/services/bookManager';
import type { Book } from './types/book';

export default function App() {
  // Initialize isFirstRun immediately to avoid flash of onboarding when books exist
  const [isFirstRun, setIsFirstRun] = useState(() => bookManager.isFirstRun());
  const [showAccountSetup, setShowAccountSetup] = useState(false);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Store the account ID to navigate to after account creation (Issue #5)
  const [initialAccountId, setInitialAccountId] = useState<string | null>(null);

  useEffect(() => {
    // Re-check first run status (in case of localStorage changes)
    const firstRun = bookManager.isFirstRun();
    setIsFirstRun(firstRun);

    if (!firstRun) {
      // Load active book
      let activeBook = bookManager.getActiveBook();

      // If no active book, auto-select the most recently accessed book (Issue #4)
      if (!activeBook) {
        const books = bookManager.getAllBooks();
        if (books.length > 0) {
          const sortedBooks = books.sort((a, b) =>
            new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
          );
          activeBook = bookManager.setActiveBook(sortedBooks[0].id);
        }
      }

      if (activeBook) {
        setCurrentBook(activeBook);

        // Check if we should show account setup after onboarding
        const shouldShowAccountSetup = localStorage.getItem('ledgerhound-show-account-setup');
        if (shouldShowAccountSetup === 'true') {
          setShowAccountSetup(true);
          localStorage.removeItem('ledgerhound-show-account-setup');
        }

        // Check if we should navigate to a specific account after creation (Issue #5)
        const navigateToAccount = localStorage.getItem('ledgerhound-navigate-to-account');
        if (navigateToAccount) {
          setInitialAccountId(navigateToAccount);
          localStorage.removeItem('ledgerhound-navigate-to-account');
        }
      }
    }

    setIsLoading(false);
  }, []);

  const handleOnboardingComplete = (bookId: string) => {
    const book = bookManager.getBook(bookId);
    if (book) {
      setCurrentBook(book);
      setIsFirstRun(false);
      // Show account setup wizard after onboarding
      localStorage.setItem('ledgerhound-show-account-setup', 'true');
      setShowAccountSetup(true);
    }
  };

  const handleAccountSetupComplete = (firstAccountId?: string) => {
    setShowAccountSetup(false);
    // Store the first created account ID so we can navigate to it after reload
    if (firstAccountId) {
      localStorage.setItem('ledgerhound-navigate-to-account', firstAccountId);
    }
    // Reload to refresh account list
    window.location.reload();
  };

  const handleBookSwitch = (bookId: string) => {
    const book = bookManager.setActiveBook(bookId);
    setCurrentBook(book);
    // Reload the page to reinitialize with new database
    window.location.reload();
  };

  const handleOnboardingCancel = () => {
    // Try to load the last active book
    const books = bookManager.getAllBooks();
    if (books.length > 0) {
      // Get the most recently accessed book
      const sortedBooks = books.sort((a, b) =>
        new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
      );
      const book = bookManager.setActiveBook(sortedBooks[0].id);
      setCurrentBook(book);
      setIsFirstRun(false);
      // Reload to initialize with the database
      window.location.reload();
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading Ledgerhound...</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <ToastContextProvider>
        {isFirstRun ? (
          <OnboardingWizard
            onComplete={handleOnboardingComplete}
            onCancel={bookManager.getAllBooks().length > 0 ? handleOnboardingCancel : undefined}
          />
        ) : currentBook ? (
          <>
            <MainLayout
              currentBook={currentBook}
              onSwitchBook={handleBookSwitch}
              onShowAccountSetup={() => setShowAccountSetup(true)}
              initialAccountId={initialAccountId}
            />
            {showAccountSetup && (
              <AccountSetupWizard
                onComplete={handleAccountSetupComplete}
                onSkip={handleAccountSetupComplete}
              />
            )}
          </>
        ) : (
          <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="text-center">
              <p className="text-slate-600 dark:text-slate-400">No active book found</p>
            </div>
          </div>
        )}
      </ToastContextProvider>
    </ToastProvider>
  );
}
