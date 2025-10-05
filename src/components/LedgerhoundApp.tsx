import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Check,
  ChevronDown,
  Filter,
  Import,
  MoreHorizontal,
  Plus,
  Receipt,
  Search,
  Settings,
  Tag,
  UploadCloud,
  User,
  X,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

/**
 * Simple mock data driven Ledgerhound UI used for prototyping.
 * Styling aims to mirror the light theme reference shared in the brief.
 */

type AccountSegment = 'BUSINESS' | 'PERSONAL';
type AccountType = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'EQUITY';
type TransactionCategoryType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

type Account = {
  id: string;
  name: string;
  number: string;
  institution: string;
  type: AccountType;
  segment: AccountSegment;
  currency: string;
  balance: number;
  clearedBalance: number;
};

type Transaction = {
  id: string;
  accountId: string;
  date: string;
  sequence: number;
  payee: string;
  memo?: string;
  category: string;
  categoryType: TransactionCategoryType;
  amount: number;
  cleared: boolean;
  reconciled?: boolean;
  tags?: string[];
  reference?: string;
};

type LedgerRow = {
  transaction: Transaction;
  runningBalance: number;
  clearedBalance: number;
  deposit: number;
  withdrawal: number;
};

type SplitDraft = {
  id: string;
  category: string;
  categoryType: TransactionCategoryType;
  memo: string;
  amount: string;
};

type TransactionDraft = {
  accountId: string;
  date: string;
  payee: string;
  amount: string;
  memo: string;
  reference: string;
  includeGST: boolean;
  tags: string[];
  splits: SplitDraft[];
};

const currencyFormatter = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatDateDisplay = (iso: string, pattern = 'dd/MM/yyyy') => format(new Date(iso), pattern);
const formatWeekday = (iso: string) => format(new Date(iso), 'EEE');

const accountsData: Account[] = [
  {
    id: 'acct-business-checking',
    name: 'Business Checking',
    number: '.... 2384',
    institution: 'ANZ Business One',
    type: 'ASSET',
    segment: 'BUSINESS',
    currency: 'AUD',
    balance: 48245.67,
    clearedBalance: 45120.55,
  },
  {
    id: 'acct-operating-savings',
    name: 'Operating Savings',
    number: '.... 1044',
    institution: 'ANZ Business Saver',
    type: 'ASSET',
    segment: 'BUSINESS',
    currency: 'AUD',
    balance: 78500,
    clearedBalance: 78500,
  },
  {
    id: 'acct-payroll',
    name: 'Payroll Clearing',
    number: '.... 7712',
    institution: 'ANZ Business One',
    type: 'LIABILITY',
    segment: 'BUSINESS',
    currency: 'AUD',
    balance: -12430.12,
    clearedBalance: -10200,
  },
  {
    id: 'acct-personal',
    name: 'Personal Checking',
    number: '.... 9921',
    institution: 'Up Bank',
    type: 'ASSET',
    segment: 'PERSONAL',
    currency: 'AUD',
    balance: 4390,
    clearedBalance: 4390,
  },
  {
    id: 'acct-sales-income',
    name: 'Sales Income',
    number: 'Biz',
    institution: 'Operating',
    type: 'INCOME',
    segment: 'BUSINESS',
    currency: 'AUD',
    balance: -1000,
    clearedBalance: -1000,
  },
  {
    id: 'acct-gst-control',
    name: 'GST Control',
    number: 'Biz',
    institution: 'Tax',
    type: 'LIABILITY',
    segment: 'BUSINESS',
    currency: 'AUD',
    balance: 0,
    clearedBalance: 0,
  },
  {
    id: 'acct-groceries',
    name: 'Groceries',
    number: 'Personal',
    institution: 'Budget',
    type: 'EXPENSE',
    segment: 'PERSONAL',
    currency: 'AUD',
    balance: 110,
    clearedBalance: 110,
  },
];

const transactionsData: Record<string, Transaction[]> = {
  'acct-business-checking': [
    {
      id: 'txn-20250602-01',
      accountId: 'acct-business-checking',
      date: '2025-06-02',
      sequence: 1,
      payee: 'Stripe Payout',
      category: 'Sales Income · Stripe',
      categoryType: 'INCOME',
      amount: 1000,
      cleared: true,
      reconciled: true,
      memo: 'Online sales · May',
      tags: ['Biz', 'Cleared'],
    },
    {
      id: 'txn-20250530-01',
      accountId: 'acct-business-checking',
      date: '2025-05-30',
      sequence: 1,
      payee: 'Officeworks',
      category: 'Office Supplies',
      categoryType: 'EXPENSE',
      amount: -100,
      cleared: true,
      memo: 'Printer paper',
      tags: ['Biz'],
    },
    {
      id: 'txn-20250524-01',
      accountId: 'acct-business-checking',
      date: '2025-05-24',
      sequence: 1,
      payee: 'ATO BAS Payment',
      category: 'Transfer · GST Holding',
      categoryType: 'TRANSFER',
      amount: -4500,
      cleared: true,
      memo: 'April BAS remittance',
      tags: ['ATO'],
    },
    {
      id: 'txn-20250518-01',
      accountId: 'acct-business-checking',
      date: '2025-05-18',
      sequence: 1,
      payee: 'Payroll Batch',
      category: 'Transfer · Payroll Clearing',
      categoryType: 'TRANSFER',
      amount: -7800,
      cleared: false,
      memo: 'Weekly payroll',
      tags: ['Payroll'],
    },
  ],
  'acct-operating-savings': [
    {
      id: 'txn-20250529-01',
      accountId: 'acct-operating-savings',
      date: '2025-05-29',
      sequence: 1,
      payee: 'Transfer from Checking',
      category: 'Transfer · Business Checking',
      categoryType: 'TRANSFER',
      amount: 15000,
      cleared: true,
      memo: 'Monthly reserve allocation',
      tags: ['Biz'],
    },
    {
      id: 'txn-20250508-01',
      accountId: 'acct-operating-savings',
      date: '2025-05-08',
      sequence: 1,
      payee: 'Macquarie Term Deposit',
      category: 'Transfer · Term Deposit',
      categoryType: 'TRANSFER',
      amount: -25000,
      cleared: true,
      memo: 'Term deposit rollover',
      tags: ['Biz'],
    },
  ],
  'acct-payroll': [
    {
      id: 'txn-20250524-02',
      accountId: 'acct-payroll',
      date: '2025-05-24',
      sequence: 2,
      payee: 'Payroll Disbursement',
      category: 'Wages Payable',
      categoryType: 'EXPENSE',
      amount: -7800,
      cleared: true,
      memo: 'Weekly salaries',
      tags: ['Biz'],
    },
    {
      id: 'txn-20250524-01',
      accountId: 'acct-payroll',
      date: '2025-05-24',
      sequence: 1,
      payee: 'Transfer from Checking',
      category: 'Transfer · Business Checking',
      categoryType: 'TRANSFER',
      amount: 7800,
      cleared: true,
      memo: 'Funding payroll',
      tags: ['Biz'],
    },
  ],
  'acct-personal': [
    {
      id: 'txn-20250602-02',
      accountId: 'acct-personal',
      date: '2025-06-02',
      sequence: 2,
      payee: 'Everyday Coffee',
      category: 'Dining Out',
      categoryType: 'EXPENSE',
      amount: -18.5,
      cleared: true,
      memo: 'Flat white + almond croissant',
      tags: ['Personal'],
    },
    {
      id: 'txn-20250602-01',
      accountId: 'acct-personal',
      date: '2025-06-02',
      sequence: 1,
      payee: 'Transfer from Business',
      category: 'Owner Draw',
      categoryType: 'TRANSFER',
      amount: 500,
      cleared: true,
      memo: 'Weekly stipend',
      tags: ['Personal'],
    },
    {
      id: 'txn-20250528-01',
      accountId: 'acct-personal',
      date: '2025-05-28',
      sequence: 1,
      payee: 'Woolworths',
      category: 'Groceries',
      categoryType: 'EXPENSE',
      amount: -164.33,
      cleared: false,
      memo: 'Family groceries',
      tags: ['Personal'],
    },
  ],
};

const categoryLibrary: Record<TransactionCategoryType, string[]> = {
  INCOME: ['Sales Income · Stripe', 'Interest Income', 'GST Refund', 'Other Income'],
  EXPENSE: ['Office Supplies', 'Software Subscriptions', 'Advertising & Marketing', 'Dining Out', 'Utilities'],
  TRANSFER: [
    'Transfer · GST Holding',
    'Transfer · Payroll Clearing',
    'Transfer · Business Checking',
    'Transfer · Term Deposit',
    'Owner Draw',
  ],
};

const availableTags = ['Biz', 'Personal', 'Cleared', 'ATO', 'Payroll', 'Subscription'];

interface LedgerComputation {
  rows: LedgerRow[];
  openingBalance: number;
  endingBalance: number;
  netActivity: number;
  clearedBalance: number;
}

const accountTypeLabels: Record<AccountType, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  INCOME: 'Income',
  EXPENSE: 'Expenses',
  EQUITY: 'Equity',
};

const accountTypeOrder: AccountType[] = ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'];

const segmentLabel: Record<AccountSegment, string> = {
  BUSINESS: 'Biz',
  PERSONAL: 'Personal',
};

function sortTransactionsAscending(a: Transaction, b: Transaction) {
  const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
  if (dateDiff !== 0) {
    return dateDiff;
  }
  return a.id.localeCompare(b.id);
}

function sortTransactionsDescending(a: Transaction, b: Transaction) {
  return sortTransactionsAscending(b, a);
}

function computeLedgerRows(transactions: Transaction[], endingBalance: number): LedgerComputation {
  const orderedAsc = [...transactions].sort(sortTransactionsAscending);
  const netActivity = orderedAsc.reduce((sum, txn) => sum + txn.amount, 0);
  const openingBalance = endingBalance - netActivity;

  let running = openingBalance;
  let clearedRunning = openingBalance;
  const runningMap = new Map<string, number>();
  const clearedMap = new Map<string, number>();

  orderedAsc.forEach((txn) => {
    running += txn.amount;
    runningMap.set(txn.id, running);

    if (txn.cleared) {
      clearedRunning += txn.amount;
    }
    clearedMap.set(txn.id, clearedRunning);
  });

  const rows: LedgerRow[] = [...transactions].sort(sortTransactionsDescending).map((txn) => ({
    transaction: txn,
    runningBalance: runningMap.get(txn.id) ?? endingBalance,
    clearedBalance: clearedMap.get(txn.id) ?? clearedRunning,
    deposit: txn.amount > 0 ? txn.amount : 0,
    withdrawal: txn.amount < 0 ? Math.abs(txn.amount) : 0,
  }));

  return {
    rows,
    openingBalance,
    endingBalance,
    netActivity,
    clearedBalance: clearedRunning,
  };
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export default function LedgerhoundApp() {
  const [accountFilter, setAccountFilter] = useState<'ALL' | 'BUSINESS' | 'PERSONAL'>('ALL');
  const [selectedAccountId, setSelectedAccountId] = useState(accountsData[0].id);
  const [searchTerm, setSearchTerm] = useState('');
  const [showClearedOnly, setShowClearedOnly] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const splitCounter = useRef(0);

  const buildSplitDraft = (): SplitDraft => ({
    id: `split-${splitCounter.current++}`,
    category: '',
    categoryType: 'EXPENSE',
    memo: '',
    amount: '',
  });

  const createDefaultDraft = (accountId: string): TransactionDraft => ({
    accountId,
    date: format(new Date(), 'yyyy-MM-dd'),
    payee: '',
    amount: '',
    memo: '',
    reference: '',
    includeGST: false,
    tags: [],
    splits: [buildSplitDraft()],
  });

  const [transactionForm, setTransactionForm] = useState<TransactionDraft>(() => createDefaultDraft(selectedAccountId));

  const filteredAccounts = useMemo(() => {
    if (accountFilter === 'ALL') {
      return accountsData;
    }
    return accountsData.filter((account) => account.segment === accountFilter);
  }, [accountFilter]);

  useEffect(() => {
    if (!filteredAccounts.some((account) => account.id === selectedAccountId) && filteredAccounts.length > 0) {
      setSelectedAccountId(filteredAccounts[0].id);
    }
  }, [filteredAccounts, selectedAccountId]);

  useEffect(() => {
    setTransactionForm((prev) => ({ ...prev, accountId: selectedAccountId }));
  }, [selectedAccountId]);

  const handleDrawerOpenChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      splitCounter.current = 0;
      setTransactionForm(createDefaultDraft(selectedAccountId));
    }
  };

  const handleAddSplit = () => {
    setTransactionForm((prev) => ({
      ...prev,
      splits: [...prev.splits, buildSplitDraft()],
    }));
  };

  const handleSplitChange = (splitId: string, key: keyof SplitDraft, value: string) => {
    setTransactionForm((prev) => ({
      ...prev,
      splits: prev.splits.map((split) => (split.id === splitId ? { ...split, [key]: value } : split)),
    }));
  };

  const handleRemoveSplit = (splitId: string) => {
    setTransactionForm((prev) => ({
      ...prev,
      splits: prev.splits.filter((split) => split.id !== splitId),
    }));
  };

  const handleToggleTag = (tag: string) => {
    setTransactionForm((prev) => {
      const hasTag = prev.tags.includes(tag);
      return {
        ...prev,
        tags: hasTag ? prev.tags.filter((existing) => existing !== tag) : [...prev.tags, tag],
      };
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log('Simulated transaction submission', transactionForm);
    handleDrawerOpenChange(false);
  };

  const groupedAccounts = useMemo(() => {
    return accountTypeOrder
      .map((type) => {
        const accountsForType = filteredAccounts.filter((account) => account.type === type);
        return { type, label: accountTypeLabels[type], accounts: accountsForType };
      })
      .filter((group) => group.accounts.length > 0);
  }, [filteredAccounts]);

  const selectedAccount = useMemo(
    () => accountsData.find((account) => account.id === selectedAccountId) ?? accountsData[0],
    [selectedAccountId],
  );

  const accountTransactions = useMemo(
    () => transactionsData[selectedAccount.id] ?? [],
    [selectedAccount.id],
  );

  const ledger = useMemo(
    () => computeLedgerRows(accountTransactions, selectedAccount.balance),
    [accountTransactions, selectedAccount.balance],
  );

  const metrics = useMemo(() => {
    const inflow = ledger.rows.reduce((sum, row) => (row.transaction.amount > 0 ? sum + row.transaction.amount : sum), 0);
    const outflow = ledger.rows.reduce(
      (sum, row) => (row.transaction.amount < 0 ? sum + Math.abs(row.transaction.amount) : sum),
      0,
    );
    const uncleared = ledger.rows.filter((row) => !row.transaction.cleared).length;

    return { inflow, outflow, uncleared };
  }, [ledger.rows]);

  const filteredRows = useMemo(() => {
    const rows = ledger.rows;

    if (!searchTerm.trim()) {
      return rows;
    }

    const query = searchTerm.trim().toLowerCase();
    return rows.filter(({ transaction }) => {
      const haystack = [
        transaction.payee,
        transaction.category,
        transaction.memo ?? '',
        transaction.reference ?? '',
        (transaction.tags ?? []).join(' '),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [ledger.rows, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex h-screen">
        <aside className="flex w-80 flex-col border-r border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between px-6 pt-7 pb-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Ledgerhound</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">Accounts</p>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:text-slate-900"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          <div className="px-6 pb-4">
            <button
              type="button"
              onClick={() => {
                setAccountFilter('ALL');
                setDrawerOpen(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-400"
            >
              <Plus className="h-4 w-4" />
              New account
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 pb-6">
            <div className="flex items-center gap-2 px-2 py-2">
              {(['ALL', 'BUSINESS', 'PERSONAL'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  type="button"
                  onClick={() => setAccountFilter(filterKey)}
                  className={classNames(
                    'rounded-full px-3 py-1 text-xs font-semibold transition',
                    accountFilter === filterKey
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700',
                  )}
                >
                  {filterKey === 'ALL' ? 'All' : filterKey === 'BUSINESS' ? 'Business' : 'Personal'}
                </button>
              ))}
            </div>

            <div className="mt-2 space-y-6">
              {groupedAccounts.map((group) => (
                <section key={group.type}>
                  <header className="flex items-center justify-between px-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{group.label}</p>
                    <span className="text-xs text-slate-400">{group.accounts.length}</span>
                  </header>
                  <ul className="mt-3 space-y-2">
                    {group.accounts.map((account) => {
                      const isSelected = account.id === selectedAccountId;
                      const pending = account.balance - account.clearedBalance;
                      return (
                        <li key={account.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedAccountId(account.id)}
                            className={classNames(
                              'w-full rounded-2xl border px-4 py-4 text-left shadow-sm transition',
                              isSelected
                                ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-200'
                                : 'border-transparent bg-white hover:border-slate-200 hover:shadow',
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{account.name}</p>
                                <p className="text-xs text-slate-500">
                                  {account.institution} · {account.number}
                                </p>
                              </div>
                              <MoreHorizontal className="h-4 w-4 text-slate-400" />
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                              <p className="text-lg font-semibold text-slate-900">{formatCurrency(account.balance)}</p>
                              <span
                                className={classNames(
                                  'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                  account.segment === 'BUSINESS'
                                    ? 'bg-emerald-100 text-emerald-600'
                                    : 'bg-sky-100 text-sky-600',
                                )}
                              >
                                {segmentLabel[account.segment]}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                              <span>Cleared {formatCurrency(account.clearedBalance)}</span>
                              <span className={pending >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                                Pending {formatCurrency(pending)}
                              </span>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </nav>

          <div className="border-t border-slate-200 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <User className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Advisor</p>
                <p className="text-sm font-medium text-slate-700">Taylor Rhodes</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-10 py-6">
            <div className="flex items-center gap-3">
              <p className="text-lg font-semibold text-slate-900">Ledgerhound</p>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                AU
              </span>
              <button
                type="button"
                className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              >
                Financial operations console
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search payees, memos, categories..."
                  className="h-10 w-72 rounded-full border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <button className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:text-slate-700">
                <Bell className="h-4 w-4" />
              </button>
              <button className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:text-slate-700">
                <Settings className="h-4 w-4" />
              </button>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-sm font-semibold text-white">
                TR
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-slate-100 px-10 py-8">
            <section className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {(['ALL', 'BUSINESS', 'PERSONAL'] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => setAccountFilter(filterKey)}
                    className={classNames(
                      'rounded-full px-4 py-2 text-sm font-semibold transition',
                      accountFilter === filterKey
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-white text-slate-500 shadow hover:text-slate-700',
                    )}
                  >
                    {filterKey === 'ALL' ? 'All' : filterKey === 'BUSINESS' ? 'Business' : 'Personal'}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-400"
                >
                  <Plus className="h-4 w-4" />
                  New Transaction
                </button>
                <button className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300">
                  <UploadCloud className="h-4 w-4" />
                  Import CSV
                </button>
                <button className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300">
                  <Receipt className="h-4 w-4" />
                  Reconcile
                </button>
                <button className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300">
                  <Import className="h-4 w-4" />
                  Reports
                </button>
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Available balance</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(ledger.endingBalance)}</p>
                <p className="mt-3 text-sm text-slate-500">Opening balance {formatCurrency(ledger.openingBalance)}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Cleared balance</p>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(ledger.clearedBalance)}</p>
                <p
                  className={classNames(
                    'mt-3 text-sm',
                    ledger.endingBalance - ledger.clearedBalance >= 0 ? 'text-emerald-500' : 'text-rose-500',
                  )}
                >
                  Pending {formatCurrency(ledger.endingBalance - ledger.clearedBalance)}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Period activity</p>
                <div className="mt-3 flex items-baseline gap-2">
                  <p className="text-3xl font-semibold text-slate-900">{formatCurrency(metrics.inflow - metrics.outflow)}</p>
                  <span className="text-sm text-slate-500">net</span>
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  {formatCurrency(metrics.inflow)} in · {formatCurrency(metrics.outflow)} out · {metrics.uncleared} awaiting clearance
                </p>
              </div>
            </section>

            <section className="mt-8 rounded-[36px] border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 px-8 py-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Register</p>
                  <div className="mt-2 flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-slate-900">{selectedAccount.name}</h2>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                      Current {formatCurrency(selectedAccount.balance)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Cleared {formatCurrency(selectedAccount.clearedBalance)}
                    </span>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowClearedOnly((prev) => !prev)}
                    aria-pressed={showClearedOnly}
                    title="Toggle running balance to use cleared transactions"
                    className={classNames(
                      'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
                      showClearedOnly ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-slate-200 bg-white text-slate-600',
                    )}
                  >
                    <Check className="h-4 w-4" />
                    Cleared only
                  </button>
                  <button className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300">
                    <Filter className="h-4 w-4" />
                    Filters
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    className="flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-400"
                  >
                    <Plus className="h-4 w-4" />
                    New Transaction
                  </button>
                </div>
              </div>

              <div className="overflow-hidden">
                <div className="grid grid-cols-[140px,1.4fr,1fr,1fr,1fr] gap-x-6 px-8 pt-4 text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  <span>Date</span>
                  <span>Payee</span>
                  <span className="text-right">Deposit</span>
                  <span className="text-right">Withdrawal</span>
                  <span className="text-right">Running</span>
                </div>
                <div className="mt-2 divide-y divide-slate-100">
                  {filteredRows.map((row) => {
                    const { transaction } = row;
                    const isBiz = selectedAccount.segment === 'BUSINESS';
                    const runningValue = showClearedOnly ? row.clearedBalance : row.runningBalance;
                    const runningValueIsPositive = runningValue >= 0;
                    return (
                      <div
                        key={transaction.id}
                        className="grid grid-cols-[140px,1.4fr,1fr,1fr,1fr] gap-x-6 px-8 py-5 transition hover:bg-slate-50"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">{formatDateDisplay(transaction.date, 'dd/MM/yyyy')}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatWeekday(transaction.date)} · {transaction.reference ?? transaction.id}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">{transaction.payee}</p>
                            <div className="flex items-center gap-2">
                              {isBiz && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                                  Biz
                                </span>
                              )}
                              {transaction.cleared && (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                                  Cleared
                                </span>
                              )}
                              {transaction.reconciled && (
                                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600">
                                  Reconciled
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="rounded-full bg-slate-100 px-2 py-1">{transaction.category}</span>
                            {transaction.memo && <span className="text-slate-400">· {transaction.memo}</span>}
                            {(transaction.tags ?? []).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 text-emerald-500">
                          {row.deposit ? (
                            <>
                              <ArrowDownLeft className="h-4 w-4" />
                              <span className="tabular-nums text-sm font-semibold">{formatCurrency(row.deposit)}</span>
                            </>
                          ) : (
                            <span className="text-sm text-slate-300">â€”</span>
                          )}
                        </div>
                        <div className="flex items-center justify-end gap-2 text-rose-500">
                          {row.withdrawal ? (
                            <>
                              <ArrowUpRight className="h-4 w-4" />
                              <span className="tabular-nums text-sm font-semibold">{formatCurrency(row.withdrawal)}</span>
                            </>
                          ) : (
                            <span className="text-sm text-slate-300">â€”</span>
                          )}
                        </div>
                        <div className="flex flex-col items-end justify-center gap-1 text-right">
                          <span
                            className={classNames(
                              'tabular-nums text-sm font-semibold',
                              runningValueIsPositive ? 'text-slate-900' : 'text-rose-500',
                            )}
                          >
                            {formatCurrency(runningValue)}
                          </span>
                          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            Cleared {formatCurrency(row.clearedBalance)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 bg-slate-50 px-8 py-5 rounded-b-[36px]">
                <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
                  <span>
                    {filteredRows.length} transaction{filteredRows.length === 1 ? '' : 's'}
                  </span>
                  <span>·</span>
                  <span>
                    Running total mode: {showClearedOnly ? 'Cleared transactions' : 'All transactions'} · Opening balance {formatCurrency(ledger.openingBalance)}
                  </span>
                  <span>·</span>
                  <span>Ending balance {formatCurrency(
                    filteredRows.length > 0
                      ? showClearedOnly
                        ? filteredRows[0].clearedBalance
                        : filteredRows[0].runningBalance
                      : showClearedOnly
                        ? ledger.clearedBalance
                        : ledger.endingBalance,
                  )}</span>
                </div>
              </div>
            </section>

            <footer className="mt-10 text-center text-xs text-slate-400">
              Ledgerhound · Prototype UI · Designed for clarity, keyboard-first entry, and AU GST workflows
            </footer>
          </main>
        </div>
      </div>

      <Dialog.Root open={drawerOpen} onOpenChange={handleDrawerOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed right-0 top-0 h-full w-full max-w-[420px] overflow-y-auto border-l border-slate-200 bg-white px-8 py-10 shadow-2xl">
            <div className="flex items-start justify-between gap-6">
              <div>
                <Dialog.Title className="text-lg font-semibold text-slate-900">New transaction</Dialog.Title>
                <p className="mt-1 text-sm text-slate-500">Quick capture for {selectedAccount.name}</p>
              </div>
              <Dialog.Close className="rounded-full border border-slate-200 p-2 text-slate-400 transition hover:text-slate-600">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            <form className="mt-8 space-y-8" onSubmit={handleSubmit}>
              <div className="space-y-5">
                <label className="block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Account
                  <select
                    value={transactionForm.accountId}
                    onChange={(event) => setTransactionForm((prev) => ({ ...prev, accountId: event.target.value }))}
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  >
                    {accountsData.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Date
                    <input
                      type="date"
                      value={transactionForm.date}
                      onChange={(event) => setTransactionForm((prev) => ({ ...prev, date: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                  </label>
                  <label className="block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Amount (AUD)
                    <input
                      type="number"
                      step="0.01"
                      value={transactionForm.amount}
                      onChange={(event) => setTransactionForm((prev) => ({ ...prev, amount: event.target.value }))}
                      placeholder="0.00"
                      className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    />
                  </label>
                </div>

                <label className="block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Payee
                  <input
                    type="text"
                    value={transactionForm.payee}
                    onChange={(event) => setTransactionForm((prev) => ({ ...prev, payee: event.target.value }))}
                    placeholder="Who is this for?"
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </label>

                <label className="block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Reference
                  <input
                    type="text"
                    value={transactionForm.reference}
                    onChange={(event) => setTransactionForm((prev) => ({ ...prev, reference: event.target.value }))}
                    placeholder="Invoice, receipt or note"
                    className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </label>

                <label className="block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Memo
                  <textarea
                    value={transactionForm.memo}
                    onChange={(event) => setTransactionForm((prev) => ({ ...prev, memo: event.target.value }))}
                    rows={3}
                    placeholder="Add extra context"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </label>

                <label className="flex items-center gap-3 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={transactionForm.includeGST}
                    onChange={(event) => setTransactionForm((prev) => ({ ...prev, includeGST: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-200"
                  />
                  Include GST breakdown
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  {availableTags.map((tag) => {
                    const isActive = transactionForm.tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleToggleTag(tag)}
                        className={classNames(
                          'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                          isActive ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300',
                        )}
                      >
                        <Tag className="h-3.5 w-3.5" />
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Splits</h3>
                  <button
                    type="button"
                    onClick={handleAddSplit}
                    className="text-xs font-semibold text-emerald-600 transition hover:text-emerald-500"
                  >
                    + Add split
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  {transactionForm.splits.map((split, index) => (
                    <div key={split.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">Split {index + 1}</p>
                        {transactionForm.splits.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSplit(split.id)}
                            className="text-xs font-semibold text-rose-500 transition hover:text-rose-400"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <label className="block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                          Type
                          <select
                            value={split.categoryType}
                            onChange={(event) =>
                              handleSplitChange(
                                split.id,
                                'categoryType',
                                event.target.value as TransactionCategoryType,
                              )
                            }
                            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          >
                            <option value="EXPENSE">Expense</option>
                            <option value="INCOME">Income</option>
                            <option value="TRANSFER">Transfer</option>
                          </select>
                        </label>
                        <label className="block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                          Amount
                          <input
                            type="number"
                            step="0.01"
                            value={split.amount}
                            onChange={(event) => handleSplitChange(split.id, 'amount', event.target.value)}
                            placeholder="0.00"
                            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          />
                        </label>
                        <label className="col-span-2 block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                          Category
                          <select
                            value={split.category}
                            onChange={(event) => handleSplitChange(split.id, 'category', event.target.value)}
                            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          >
                            <option value="">Select category</option>
                            {categoryLibrary[split.categoryType].map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="col-span-2 block text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                          Memo (optional)
                          <input
                            type="text"
                            value={split.memo}
                            onChange={(event) => handleSplitChange(split.id, 'memo', event.target.value)}
                            placeholder="Describe this split"
                            className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-6">
                <Dialog.Close className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700">
                  Cancel
                </Dialog.Close>
                <button
                  type="submit"
                  className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-400"
                >
                  Save transaction
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
