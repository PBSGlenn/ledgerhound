import { useState, useEffect } from 'react';
import { MainLayout } from './components/Layout/MainLayout';
import { OnboardingWizard } from './components/Onboarding/OnboardingWizard';
import { ToastProvider } from './components/UI/Toast';
import { ToastContextProvider } from './hooks/useToast';
import { bookManager } from './lib/services/bookManager';
import type { Book } from './types/book';

export default function App() {
  const [isFirstRun, setIsFirstRun] = useState(true);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if this is first run
    const firstRun = bookManager.isFirstRun();
    setIsFirstRun(firstRun);

    if (!firstRun) {
      // Load active book
      const activeBook = bookManager.getActiveBook();
      if (activeBook) {
        setCurrentBook(activeBook);
      } else {
        // Has books but no active book - show onboarding
        setIsFirstRun(true);
      }
    }

    setIsLoading(false);
  }, []);

  const handleOnboardingComplete = (bookId: string) => {
    const book = bookManager.getBook(bookId);
    if (book) {
      setCurrentBook(book);
      setIsFirstRun(false);
    }
  };

  const handleBookSwitch = (bookId: string) => {
    const book = bookManager.setActiveBook(bookId);
    setCurrentBook(book);
    // Reload the page to reinitialize with new database
    window.location.reload();
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
          <OnboardingWizard onComplete={handleOnboardingComplete} />
        ) : currentBook ? (
          <MainLayout currentBook={currentBook} onSwitchBook={handleBookSwitch} />
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
