/**
 * Account Setup Wizard
 * Helps users add multiple accounts after initial onboarding
 */

import { useState } from 'react';
import { Building2, CreditCard, DollarSign, PiggyBank, ShoppingCart, Home, Car, CheckCircle, ArrowRight, ArrowLeft, X } from 'lucide-react';
import { accountAPI } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import type { AccountType, AccountSubtype } from '@prisma/client';

interface AccountSetupWizardProps {
  onComplete: () => void;
  onSkip?: () => void;
}

interface AccountTemplate {
  id: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype | null;
  kind: 'TRANSFER' | 'CATEGORY';
  icon: React.ReactNode;
  description: string;
  category: 'banking' | 'assets' | 'liabilities' | 'income' | 'expenses';
  isBusinessDefault?: boolean;
}

interface AccountToCreate {
  template: AccountTemplate;
  name: string;
  openingBalance?: number;
  openingDate?: string;
  isBusinessDefault?: boolean;
}

const ACCOUNT_TEMPLATES: AccountTemplate[] = [
  // Banking Accounts
  {
    id: 'checking',
    name: 'Checking Account',
    type: 'ASSET',
    subtype: 'BANK',
    kind: 'TRANSFER',
    icon: <Building2 className="w-6 h-6" />,
    description: 'Day-to-day banking account',
    category: 'banking',
  },
  {
    id: 'savings',
    name: 'Savings Account',
    type: 'ASSET',
    subtype: 'BANK',
    kind: 'TRANSFER',
    icon: <PiggyBank className="w-6 h-6" />,
    description: 'High-interest savings account',
    category: 'banking',
  },
  {
    id: 'credit-card',
    name: 'Credit Card',
    type: 'LIABILITY',
    subtype: 'CARD',
    kind: 'TRANSFER',
    icon: <CreditCard className="w-6 h-6" />,
    description: 'Credit card for purchases',
    category: 'liabilities',
  },
  // Assets
  {
    id: 'cash',
    name: 'Cash on Hand',
    type: 'ASSET',
    subtype: 'CASH',
    kind: 'TRANSFER',
    icon: <DollarSign className="w-6 h-6" />,
    description: 'Physical cash',
    category: 'assets',
  },
  {
    id: 'property',
    name: 'Property/Real Estate',
    type: 'ASSET',
    subtype: 'OTHER',
    kind: 'TRANSFER',
    icon: <Home className="w-6 h-6" />,
    description: 'Home, investment property',
    category: 'assets',
  },
  {
    id: 'vehicle',
    name: 'Vehicle',
    type: 'ASSET',
    subtype: 'OTHER',
    kind: 'TRANSFER',
    icon: <Car className="w-6 h-6" />,
    description: 'Car, truck, motorcycle',
    category: 'assets',
  },
  // Common Income Categories
  {
    id: 'salary',
    name: 'Salary/Wages',
    type: 'INCOME',
    subtype: null,
    kind: 'CATEGORY',
    icon: <DollarSign className="w-6 h-6" />,
    description: 'Employment income',
    category: 'income',
  },
  {
    id: 'business-income',
    name: 'Business Income',
    type: 'INCOME',
    subtype: null,
    kind: 'CATEGORY',
    icon: <Building2 className="w-6 h-6" />,
    description: 'Revenue from business',
    category: 'income',
    isBusinessDefault: true,
  },
  {
    id: 'interest',
    name: 'Interest Income',
    type: 'INCOME',
    subtype: null,
    kind: 'CATEGORY',
    icon: <PiggyBank className="w-6 h-6" />,
    description: 'Interest from savings, investments',
    category: 'income',
  },
  // Common Expense Categories
  {
    id: 'groceries',
    name: 'Groceries',
    type: 'EXPENSE',
    subtype: null,
    kind: 'CATEGORY',
    icon: <ShoppingCart className="w-6 h-6" />,
    description: 'Food and household items',
    category: 'expenses',
  },
  {
    id: 'dining',
    name: 'Dining Out',
    type: 'EXPENSE',
    subtype: null,
    kind: 'CATEGORY',
    icon: <ShoppingCart className="w-6 h-6" />,
    description: 'Restaurants, cafes',
    category: 'expenses',
  },
  {
    id: 'utilities',
    name: 'Utilities',
    type: 'EXPENSE',
    subtype: null,
    kind: 'CATEGORY',
    icon: <Home className="w-6 h-6" />,
    description: 'Electricity, water, gas, internet',
    category: 'expenses',
  },
  {
    id: 'transport',
    name: 'Transportation',
    type: 'EXPENSE',
    subtype: null,
    kind: 'CATEGORY',
    icon: <Car className="w-6 h-6" />,
    description: 'Fuel, public transport, parking',
    category: 'expenses',
  },
  {
    id: 'business-expenses',
    name: 'Business Expenses',
    type: 'EXPENSE',
    subtype: null,
    kind: 'CATEGORY',
    icon: <Building2 className="w-6 h-6" />,
    description: 'Business operating costs',
    category: 'expenses',
    isBusinessDefault: true,
  },
];

export function AccountSetupWizard({ onComplete, onSkip }: AccountSetupWizardProps) {
  const { showSuccess, showError } = useToast();
  const [step, setStep] = useState<'select' | 'customize' | 'creating'>('select');
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [accountsToCreate, setAccountsToCreate] = useState<AccountToCreate[]>([]);
  const [currentCategory, setCurrentCategory] = useState<'banking' | 'assets' | 'liabilities' | 'income' | 'expenses'>('banking');

  const categories = [
    { id: 'banking' as const, label: 'Banking', icon: <Building2 className="w-5 h-5" /> },
    { id: 'assets' as const, label: 'Assets', icon: <Home className="w-5 h-5" /> },
    { id: 'liabilities' as const, label: 'Liabilities', icon: <CreditCard className="w-5 h-5" /> },
    { id: 'income' as const, label: 'Income', icon: <DollarSign className="w-5 h-5" /> },
    { id: 'expenses' as const, label: 'Expenses', icon: <ShoppingCart className="w-5 h-5" /> },
  ];

  const toggleTemplate = (templateId: string) => {
    const newSelected = new Set(selectedTemplates);
    if (newSelected.has(templateId)) {
      newSelected.delete(templateId);
    } else {
      newSelected.add(templateId);
    }
    setSelectedTemplates(newSelected);
  };

  const handleNext = () => {
    // Convert selected templates to accounts to create
    const accounts: AccountToCreate[] = Array.from(selectedTemplates).map(id => {
      const template = ACCOUNT_TEMPLATES.find(t => t.id === id)!;
      return {
        template,
        name: template.name,
        openingBalance: template.kind === 'TRANSFER' ? 0 : undefined,
        openingDate: template.kind === 'TRANSFER' ? new Date().toISOString().split('T')[0] : undefined,
        isBusinessDefault: template.isBusinessDefault || false,
      };
    });
    setAccountsToCreate(accounts);
    setStep('customize');
  };

  const handleCreate = async () => {
    setStep('creating');

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const account of accountsToCreate) {
        try {
          if (account.template.kind === 'TRANSFER') {
            // Create real account (bank, credit card, etc.)
            await accountAPI.createAccount({
              name: account.name,
              type: account.template.type,
              subtype: account.template.subtype,
              kind: 'TRANSFER',
              isReal: true,
              openingBalance: account.openingBalance || 0,
              openingDate: new Date(account.openingDate || Date.now()),
              isBusinessDefault: account.isBusinessDefault || false,
            });
          } else {
            // Create category account
            await accountAPI.createCategory({
              name: account.name,
              type: account.template.type as 'INCOME' | 'EXPENSE',
              isBusinessDefault: account.isBusinessDefault || false,
            });
          }
          successCount++;
        } catch (error) {
          console.error(`Failed to create account ${account.name}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        showSuccess(
          `Accounts created`,
          `Successfully created ${successCount} account${successCount !== 1 ? 's' : ''}${errorCount > 0 ? ` (${errorCount} failed)` : ''}`
        );
      }

      if (errorCount > 0) {
        showError(
          'Some accounts failed',
          `Failed to create ${errorCount} account${errorCount !== 1 ? 's' : ''}`
        );
      }

      onComplete();
    } catch (error) {
      showError('Failed to create accounts', (error as Error).message);
      setStep('customize');
    }
  };

  const updateAccountName = (index: number, name: string) => {
    const updated = [...accountsToCreate];
    updated[index].name = name;
    setAccountsToCreate(updated);
  };

  const updateAccountBalance = (index: number, balance: number) => {
    const updated = [...accountsToCreate];
    updated[index].openingBalance = balance;
    setAccountsToCreate(updated);
  };

  const updateAccountBusiness = (index: number, isBusiness: boolean) => {
    const updated = [...accountsToCreate];
    updated[index].isBusinessDefault = isBusiness;
    setAccountsToCreate(updated);
  };

  const removeAccount = (index: number) => {
    setAccountsToCreate(accountsToCreate.filter((_, i) => i !== index));
  };

  if (step === 'creating') {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Creating Accounts...
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Setting up your accounts. This will only take a moment.
          </p>
        </div>
      </div>
    );
  }

  if (step === 'customize') {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Customize Your Accounts
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Review and customize the accounts before creating them
            </p>
          </div>

          {/* Account List */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-3">
              {accountsToCreate.map((account, index) => (
                <div
                  key={index}
                  className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 border border-slate-200 dark:border-slate-600"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-emerald-600 dark:text-emerald-400 mt-1">
                      {account.template.icon}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Account Name
                        </label>
                        <input
                          type="text"
                          value={account.name}
                          onChange={(e) => updateAccountName(index, e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>

                      {account.template.kind === 'TRANSFER' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Opening Balance
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={account.openingBalance || 0}
                            onChange={(e) => updateAccountBalance(index, parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`business-${index}`}
                          checked={account.isBusinessDefault || false}
                          onChange={(e) => updateAccountBusiness(index, e.target.checked)}
                          className="w-4 h-4 text-emerald-600 border-slate-300 dark:border-slate-600 rounded focus:ring-emerald-500"
                        />
                        <label
                          htmlFor={`business-${index}`}
                          className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          Enable GST tracking by default
                        </label>
                      </div>
                    </div>
                    <button
                      onClick={() => removeAccount(index)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}

              {accountsToCreate.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-500 dark:text-slate-400">
                    No accounts selected. Go back to select accounts.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-between">
            <button
              onClick={() => setStep('select')}
              className="px-6 py-2 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <button
              onClick={handleCreate}
              disabled={accountsToCreate.length === 0}
              className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-5 h-5" />
              Create {accountsToCreate.length} Account{accountsToCreate.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Selection Step
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Add Accounts
            </h2>
            {onSkip && (
              <button
                onClick={onSkip}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm font-medium"
              >
                Skip for now
              </button>
            )}
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Select the accounts you want to create. You can customize them in the next step.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-2 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCurrentCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
                  currentCategory === cat.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Template Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ACCOUNT_TEMPLATES.filter(t => t.category === currentCategory).map((template) => {
              const isSelected = selectedTemplates.has(template.id);
              return (
                <button
                  key={template.id}
                  onClick={() => toggleTemplate(template.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 bg-white dark:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className={`${isSelected ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-400'}`}>
                      {template.icon}
                    </div>
                    {isSelected && (
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    {template.name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {template.description}
                  </p>
                </button>
              );
            })}
          </div>

          {ACCOUNT_TEMPLATES.filter(t => t.category === currentCategory).length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400">
                No templates available in this category.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {selectedTemplates.size} account{selectedTemplates.size !== 1 ? 's' : ''} selected
          </div>

          <button
            onClick={handleNext}
            disabled={selectedTemplates.size === 0}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next: Customize
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
