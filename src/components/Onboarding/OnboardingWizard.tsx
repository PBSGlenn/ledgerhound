/**
 * Onboarding Wizard
 * First-run setup wizard for creating a new book
 */

import { useState, useEffect } from 'react';
import { Book, CheckCircle, Settings, Calendar, DollarSign, Building2, ArrowRight, ArrowLeft, X } from 'lucide-react';
import { bookManager } from '../../lib/services/bookManager';
import { useToast } from '../../hooks/useToast';
import type { CreateBookData } from '../../types/book';

interface OnboardingWizardProps {
  onComplete: (bookId: string) => void;
  onCancel?: () => void;
}

type Step = 'welcome' | 'book-details' | 'regional-settings' | 'first-account' | 'review';

interface FirstAccountData {
  name: string;
  type: 'ASSET' | 'LIABILITY';
  subtype: 'BANK' | 'CREDIT_CARD' | 'CASH' | 'SAVINGS';
  openingBalance: number;
  openingDate: string;
}

export function OnboardingWizard({ onComplete, onCancel }: OnboardingWizardProps) {
  const { showSuccess, showError } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>('welcome');

  // ESC key to cancel
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCancel) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  // Form data
  const [bookData, setBookData] = useState<Partial<CreateBookData>>({
    fiscalYearStart: '07-01',
    currency: 'AUD',
    dateFormat: 'DD/MM/YYYY',
  });

  const [firstAccount, setFirstAccount] = useState<FirstAccountData>({
    name: '',
    type: 'ASSET',
    subtype: 'BANK',
    openingBalance: 0,
    openingDate: new Date().toISOString().split('T')[0],
  });

  const handleNext = () => {
    const steps: Step[] = ['welcome', 'book-details', 'regional-settings', 'first-account', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    const steps: Step[] = ['welcome', 'book-details', 'regional-settings', 'first-account', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleComplete = async () => {
    try {
      // Create the book
      const book = bookManager.createBook(bookData as CreateBookData);

      // Set as active book
      bookManager.setActiveBook(book.id);

      showSuccess('Book created!', 'Your accounting books have been set up successfully');

      // Store first account data to create after database is initialized
      localStorage.setItem('ledgerhound-first-account', JSON.stringify(firstAccount));

      onComplete(book.id);
    } catch (error) {
      showError('Failed to create book', (error as Error).message);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'welcome':
        return true;
      case 'book-details':
        return bookData.name && bookData.ownerName;
      case 'regional-settings':
        return true;
      case 'first-account':
        return firstAccount.name.length > 0;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-blue-600 p-8 text-white relative">
          {onCancel && (
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="Exit to existing book (ESC)"
            >
              <X className="w-6 h-6" />
            </button>
          )}
          <div className="flex items-center gap-3 mb-3">
            <Book className="w-10 h-10" />
            <h1 className="text-3xl font-bold">Welcome to Ledgerhound</h1>
          </div>
          <p className="text-emerald-50 text-lg">
            Let's set up your accounting books in just a few steps
          </p>
        </div>

        {/* Progress Steps */}
        <div className="px-8 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            {['Welcome', 'Details', 'Settings', 'Account', 'Review'].map((label, idx) => {
              const steps: Step[] = ['welcome', 'book-details', 'regional-settings', 'first-account', 'review'];
              const isActive = currentStep === steps[idx];
              const isComplete = steps.indexOf(currentStep) > idx;

              return (
                <div key={label} className="flex items-center">
                  <div className={`flex items-center gap-2 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : isComplete ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${isActive ? 'bg-emerald-600 text-white' : isComplete ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      {isComplete ? <CheckCircle className="w-5 h-5" /> : idx + 1}
                    </div>
                    <span className="text-sm font-medium hidden sm:inline">{label}</span>
                  </div>
                  {idx < 4 && (
                    <div className={`w-12 h-1 mx-2 ${isComplete ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-8 min-h-[400px]">
          {/* Welcome Step */}
          {currentStep === 'welcome' && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
                <Book className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                  Welcome to Ledgerhound
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-lg max-w-lg mx-auto">
                  Ledgerhound helps you manage your personal and business finances with double-entry accounting and Australian GST support.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-2 mx-auto" />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Personal & Business</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Track both personal and business finances in one place</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400 mb-2 mx-auto" />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">GST Compliant</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Australian GST tracking and BAS reporting built-in</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-purple-600 dark:text-purple-400 mb-2 mx-auto" />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Bank Reconciliation</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Easily reconcile against bank statements</p>
                </div>
              </div>
            </div>
          )}

          {/* Book Details Step */}
          {currentStep === 'book-details' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Book Details
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Give your books a name and tell us who they're for
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Book Name *
                  </label>
                  <input
                    type="text"
                    value={bookData.name || ''}
                    onChange={(e) => setBookData({ ...bookData, name: e.target.value })}
                    placeholder="e.g., Glenn's Personal & Business"
                    className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    This helps you identify your books if you create multiple sets
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Owner Name *
                  </label>
                  <input
                    type="text"
                    value={bookData.ownerName || ''}
                    onChange={(e) => setBookData({ ...bookData, ownerName: e.target.value })}
                    placeholder="e.g., Glenn"
                    className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={bookData.description || ''}
                    onChange={(e) => setBookData({ ...bookData, description: e.target.value })}
                    placeholder="e.g., Personal finances and small business accounting"
                    rows={3}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Regional Settings Step */}
          {currentStep === 'regional-settings' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Regional Settings
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Configure currency, date format, and fiscal year
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Currency
                  </label>
                  <select
                    value={bookData.currency}
                    onChange={(e) => setBookData({ ...bookData, currency: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="AUD">AUD - Australian Dollar</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="NZD">NZD - New Zealand Dollar</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Date Format
                  </label>
                  <select
                    value={bookData.dateFormat}
                    onChange={(e) => setBookData({ ...bookData, dateFormat: e.target.value as any })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2025)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2025)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (2025-12-31)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Fiscal Year Start
                  </label>
                  <select
                    value={bookData.fiscalYearStart}
                    onChange={(e) => setBookData({ ...bookData, fiscalYearStart: e.target.value })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="01-01">January 1 (Calendar Year)</option>
                    <option value="07-01">July 1 (Australian FY)</option>
                    <option value="04-01">April 1</option>
                    <option value="10-01">October 1</option>
                  </select>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Used for financial year calculations in reports
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* First Account Step */}
          {currentStep === 'first-account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Create Your First Account
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Start by adding your main bank account
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Account Name *
                  </label>
                  <input
                    type="text"
                    value={firstAccount.name}
                    onChange={(e) => setFirstAccount({ ...firstAccount, name: e.target.value })}
                    placeholder="e.g., Commonwealth Checking"
                    className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Account Type
                  </label>
                  <select
                    value={firstAccount.subtype}
                    onChange={(e) => setFirstAccount({ ...firstAccount, subtype: e.target.value as any })}
                    className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="BANK">Checking Account</option>
                    <option value="SAVINGS">Savings Account</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Opening Balance
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={firstAccount.openingBalance}
                      onChange={(e) => setFirstAccount({ ...firstAccount, openingBalance: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Opening Date
                    </label>
                    <input
                      type="date"
                      value={firstAccount.openingDate}
                      onChange={(e) => setFirstAccount({ ...firstAccount, openingDate: e.target.value })}
                      className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Tip:</strong> You can add more accounts later. Start with your primary bank account to get going quickly.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Review Step */}
          {currentStep === 'review' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Review & Create
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Review your settings before creating your books
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Book Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Name:</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{bookData.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Owner:</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{bookData.ownerName}</span>
                    </div>
                    {bookData.description && (
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">Description:</span>
                        <p className="font-medium text-slate-900 dark:text-slate-100 mt-1">{bookData.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">Regional Settings</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Currency:</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{bookData.currency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Date Format:</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{bookData.dateFormat}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Fiscal Year:</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {bookData.fiscalYearStart === '01-01' ? 'Jan 1' : bookData.fiscalYearStart === '07-01' ? 'Jul 1' : bookData.fiscalYearStart === '04-01' ? 'Apr 1' : 'Oct 1'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">First Account</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Name:</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{firstAccount.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Type:</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {firstAccount.subtype === 'BANK' ? 'Checking' : firstAccount.subtype === 'SAVINGS' ? 'Savings' : firstAccount.subtype === 'CREDIT_CARD' ? 'Credit Card' : 'Cash'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Opening Balance:</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {new Intl.NumberFormat('en-AU', { style: 'currency', currency: bookData.currency }).format(firstAccount.openingBalance)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-6 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
          {currentStep !== 'welcome' ? (
            <button
              onClick={handleBack}
              className="px-6 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {currentStep !== 'review' ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Create My Books
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
