import React, { useMemo, useState } from "react";
import type { JSX } from "react";

type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
type GstCode = "GST" | "GST_FREE" | "INPUT_TAXED";

type Account = {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  isBusiness?: boolean;
  subtype?: string;
};

type RegisterRow = {
  id: number;
  accountId: string;
  date: string;
  payee: string;
  memo?: string;
  tags?: string[];
  business?: boolean;
  cleared?: boolean;
  debit?: number;
  credit?: number;
  balance: number;
  categoryId?: string;
  transferAccountId?: string;
  gstCode?: GstCode;
};

const accountCatalogue: Account[] = [
  { id: "acc.personal.checking", name: "Personal Checking", type: "ASSET", balance: 4390 },
  { id: "acc.business.checking", name: "Business Checking", type: "ASSET", balance: 11100, isBusiness: true },
  { id: "acc.gst.control", name: "GST Control", type: "LIABILITY", balance: 0, isBusiness: true, subtype: "GST_CONTROL" },
  { id: "acc.holiday.goal", name: "Holiday Fund", type: "EQUITY", balance: 1500 },
  { id: "acc.salary", name: "Salary", type: "INCOME", balance: 0 },
  { id: "acc.sales", name: "Sales Income", type: "INCOME", balance: -1000, isBusiness: true },
  { id: "acc.groceries", name: "Groceries", type: "EXPENSE", balance: 110 },
  { id: "acc.dining", name: "Dining Out", type: "EXPENSE", balance: 59.09 },
  { id: "acc.office", name: "Office Supplies", type: "EXPENSE", balance: 100, isBusiness: true },
  { id: "acc.business.meals", name: "Business Meals", type: "EXPENSE", balance: 90.91, isBusiness: true },
];

const accountSections = [
  { key: "assets", title: "Assets", type: "ASSET" as AccountType },
  { key: "liabilities", title: "Liabilities", type: "LIABILITY" as AccountType },
  { key: "income", title: "Income", type: "INCOME" as AccountType },
  { key: "expenses", title: "Expenses", type: "EXPENSE" as AccountType },
].map((section) => ({
  ...section,
  items: accountCatalogue.filter((account) => account.type === section.type),
}));

const registerSeed: RegisterRow[] = [
  {
    id: 101,
    accountId: "acc.personal.checking",
    date: "2025-08-20",
    payee: "Savings Transfer",
    memo: "Holiday fund contribution #savings",
    transferAccountId: "acc.holiday.goal",
    debit: 500,
    credit: 0,
    balance: 3890,
    cleared: true,
    tags: ["#savings"],
  },
  {
    id: 102,
    accountId: "acc.personal.checking",
    date: "2025-06-02",
    payee: "Stripe Payout",
    memo: "May",
    categoryId: "acc.sales",
    debit: 0,
    credit: 1000,
    balance: 5390,
    business: true,
    cleared: true,
    gstCode: "GST",
  },
  {
    id: 103,
    accountId: "acc.personal.checking",
    date: "2025-06-03",
    payee: "Officeworks",
    memo: "Printer paper",
    categoryId: "acc.office",
    debit: 100,
    credit: 0,
    balance: 5290,
    business: true,
    cleared: false,
    gstCode: "GST",
  },
];

const seed = {
  accounts: accountCatalogue,
  sections: accountSections,
  register: registerSeed,
};

type SplitDraft = {
  id: string;
  selection: string;
  amount: string;
  gstCode?: GstCode;
  isTransfer: boolean;
};

const gstOptions: Array<{ value: GstCode; label: string }> = [
  { value: "GST", label: "GST 10%" },
  { value: "GST_FREE", label: "GST Free" },
  { value: "INPUT_TAXED", label: "Input Taxed" },
];

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value);

export const extractTags = (memo?: string, explicit?: string[]) => {
  if (explicit && explicit.length) return explicit;
  if (!memo) return [] as string[];
  return memo.match(/#[a-z0-9_]+/gi) || [];
};

const IconChevronLeft = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);

const IconPlus = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
  </svg>
);

const IconUpload = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 9l5-5 5 5M12 4v12" />
  </svg>
);

const IconListChecks = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
);

const IconBarChart = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 17V9M12 17V5M17 17v-7" />
  </svg>
);

const IconSearch = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 110-15 7.5 7.5 0 010 15z" />
  </svg>
);

const IconBanknote = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <rect x="3" y="6" width="18" height="12" rx="2" ry="2" strokeWidth="2" />
    <circle cx="12" cy="12" r="3" strokeWidth="2" />
  </svg>
);

const IconFolder = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
  </svg>
);

function ShellButton({ icon: Icon, children, onClick }: { icon?: (props: React.SVGProps<SVGSVGElement>) => JSX.Element; children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:scale-[0.99]"
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      <span>{children}</span>
    </button>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon?: (props: React.SVGProps<SVGSVGElement>) => JSX.Element }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        {Icon ? <Icon className="h-8 w-8 text-emerald-500" /> : null}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="text-xl font-semibold text-slate-800">{value}</p>
        </div>
      </div>
    </div>
  );
}

function PillToggle({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm font-medium transition ${
        active ? "bg-emerald-500 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

function AccountRow({ name, amount, business, selected, onSelect }: { name: string; amount: number; business?: boolean; selected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
        selected ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <IconFolder className="h-4 w-4" />
        <span>{name}</span>
        {business ? <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Biz</span> : null}
      </div>
      <span className="tabular-nums">{formatMoney(amount)}</span>
    </button>
  );
}

function RegisterTable({ rows, accounts, accountId, onCategoryChange }: { rows: RegisterRow[]; accounts: Account[]; accountId: string; onCategoryChange: (rowId: number, value: string) => void }) {
  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((account) => map.set(account.id, account));
    return map;
  }, [accounts]);

  const categoryOptions = useMemo(() => accounts.filter((account) => account.type === "INCOME" || account.type === "EXPENSE"), [accounts]);
  const transferOptions = useMemo(
    () => accounts.filter((account) => (account.type === "ASSET" || account.type === "LIABILITY" || account.type === "EQUITY") && account.id !== accountId),
    [accounts, accountId],
  );

  const gridCols = "grid grid-cols-[120px_1fr_120px_120px_140px]";
  const endingBalance = rows.length ? rows[rows.length - 1].balance ?? 0 : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`${gridCols} sticky top-[56px] z-10 border-b bg-slate-50/95 px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur`}>
        <div>Date</div>
        <div>Payee</div>
        <div className="text-right">Debit</div>
        <div className="text-right">Credit</div>
        <div className="text-right">Balance</div>
      </div>

      <ul className="divide-y divide-slate-100">
        {rows.map((row) => {
          const tags = extractTags(row.memo, row.tags);
          const categoryAccount = row.categoryId ? accountMap.get(row.categoryId) : undefined;
          const transferAccount = row.transferAccountId ? accountMap.get(row.transferAccountId) : undefined;
          const selectValue = row.transferAccountId ? `transfer:${row.transferAccountId}` : row.categoryId ? `category:${row.categoryId}` : "";
          const gstLabel = row.gstCode === "GST" ? "GST 10%" : row.gstCode === "GST_FREE" ? "GST Free" : row.gstCode === "INPUT_TAXED" ? "Input Taxed" : undefined;

          return (
            <li key={row.id} className="px-4 py-3 text-sm">
              <div className={`${gridCols} items-center gap-x-4`}>
                <div className="text-slate-700">{new Date(row.date).toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" })}</div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{row.payee}</span>
                  {row.business ? <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Biz</span> : null}
                  {row.cleared ? <span className="rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[10px] text-white">✓ Cleared</span> : null}
                </div>
                <div className="text-right tabular-nums text-slate-700">{row.debit ? formatMoney(row.debit) : ""}</div>
                <div className="text-right tabular-nums text-slate-700">{row.credit ? formatMoney(row.credit) : ""}</div>
                <div className="text-right tabular-nums font-medium text-slate-900">{typeof row.balance === "number" ? formatMoney(row.balance) : ""}</div>
              </div>

              <div className={`mt-1 ${gridCols} gap-x-4 text-xs text-slate-500`}>
                <div />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-slate-400">•</span>
                  <select
                    value={selectValue}
                    onChange={(event) => onCategoryChange(row.id, event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select category or account…</option>
                    {categoryOptions.length ? (
                      <optgroup label="Categories">
                        {categoryOptions.map((option) => (
                          <option key={`category:${option.id}`} value={`category:${option.id}`}>
                            {option.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    {transferOptions.length ? (
                      <optgroup label="Transfer to account">
                        {transferOptions.map((option) => (
                          <option key={`transfer:${option.id}`} value={`transfer:${option.id}`}>
                            {option.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                  </select>
                  {transferAccount ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">Transfer · {transferAccount.name}</span>
                  ) : categoryAccount ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{categoryAccount.type === "INCOME" ? "Income" : "Expense"}</span>
                  ) : null}
                  {!transferAccount && gstLabel ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{gstLabel}</span>
                  ) : null}
                  {row.memo ? <span>{row.memo.replace(/#[a-z0-9_]+/gi, "").trim()}</span> : null}
                  {tags.map((tag) => (
                    <span key={tag} className="text-slate-600">
                      {tag}
                    </span>
                  ))}
                </div>
                <div />
                <div />
                <div />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between border-t bg-slate-50 px-4 py-2 text-xs text-slate-600">
        <span>
          {rows.length} transaction{rows.length === 1 ? "" : "s"}
        </span>
        <span className="font-medium">Ending balance: {formatMoney(endingBalance || 0)}</span>
      </div>
    </div>
  );
}

function TransactionForm({ open, onClose, accounts, onSave }: { open: boolean; onClose: () => void; accounts: Account[]; onSave: (payload: any) => void }) {
  const makeSplit = (overrides: Partial<SplitDraft> = {}): SplitDraft => {
    const isTransfer = overrides.isTransfer ?? false;
    return {
      id: `split-${Math.random().toString(36).slice(2, 8)}`,
      selection: overrides.selection ?? "",
      amount: overrides.amount ?? "",
      gstCode: isTransfer ? undefined : overrides.gstCode ?? "GST",
      isTransfer,
    };
  };
  const [mode, setMode] = useState<"simple" | "split">("simple");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [categoryValue, setCategoryValue] = useState("");
  const [splits, setSplits] = useState<SplitDraft[]>(() => [makeSplit()]);

  const categoryOptions = useMemo(() => accounts.filter((account) => account.type === "INCOME" || account.type === "EXPENSE"), [accounts]);
  const transferOptions = useMemo(() => accounts.filter((account) => account.type === "ASSET" || account.type === "LIABILITY" || account.type === "EQUITY"), [accounts]);

  if (!open) return null;

  const parseAmount = (input: string): number | null => {
    if (!input.trim()) return null;
    const numeric = Number.parseFloat(input.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(numeric)) return null;
    return Math.round(numeric * 100) / 100;
  };

  const transactionAmount = parseAmount(amount);
  const allocated = splits.reduce((sum, split) => {
    const value = parseAmount(split.amount);
    return value !== null ? sum + value : sum;
  }, 0);

  const remaining = mode === "split" && transactionAmount !== null ? Math.round((transactionAmount - allocated) * 100) / 100 : null;
  const remainingBadge = mode === "split" && transactionAmount !== null
    ? remaining !== null
      ? remaining > 0.01
        ? { label: `Remaining to allocate: ${formatMoney(remaining)}`, tone: "bg-amber-100 text-amber-700" }
        : remaining < -0.01
          ? { label: `Over allocated by ${formatMoney(Math.abs(remaining))}`, tone: "bg-rose-100 text-rose-700" }
          : { label: "Fully allocated", tone: "bg-emerald-100 text-emerald-700" }
      : null
    : null;

  const switchToSimple = () => {
    setCategoryValue((current) => (mode === "split" && splits.length > 0 && splits[0].selection ? splits[0].selection : current));
    setSplits([makeSplit()]);
    setMode("simple");
  };

  const switchToSplit = () => {
    setSplits((previous) => {
      if (previous.length === 1 && !previous[0].selection && !previous[0].amount && categoryValue) {
        const [kind] = categoryValue.split(":");
        const isTransfer = kind === "transfer";
        return [
          makeSplit({
            selection: categoryValue,
            amount,
            isTransfer,
            gstCode: isTransfer ? undefined : "GST",
          }),
        ];
      }
      return previous;
    });
    setCategoryValue("");
    setMode("split");
  };

  const handleSplitSelectionChange = (splitId: string, value: string) => {
    setSplits((previous) =>
      previous.map((split) => {
        if (split.id !== splitId) return split;
        const [kind] = value.split(":");
        const isTransfer = kind === "transfer";
        return {
          ...split,
          selection: value,
          isTransfer,
          gstCode: isTransfer ? undefined : split.gstCode ?? "GST",
        };
      }),
    );
  };

  const handleSplitAmountChange = (splitId: string, value: string) => {
    setSplits((previous) => previous.map((split) => (split.id === splitId ? { ...split, amount: value } : split)));
  };

  const handleSplitGstChange = (splitId: string, value: GstCode) => {
    setSplits((previous) => previous.map((split) => (split.id === splitId ? { ...split, gstCode: value } : split)));
  };

  const handleAddSplit = () => {
    setSplits((previous) => [...previous, makeSplit()]);
  };

  const handleRemoveSplit = (splitId: string) => {
    setSplits((previous) => (previous.length === 1 ? previous : previous.filter((split) => split.id !== splitId)));
  };

  const splitsInvalid = splits.some((split) => {
    if (!split.selection) return true;
    const value = parseAmount(split.amount);
    return value === null || value <= 0;
  });

  const baseInvalid = !payee.trim() || transactionAmount === null || transactionAmount <= 0;
  const simpleInvalid = mode === "simple" && !categoryValue;
  const splitInvalid = mode === "split" && (splitsInvalid || remaining === null || Math.abs(remaining) > 0.01);
  const saveDisabled = baseInvalid || simpleInvalid || splitInvalid;

  const resetForm = () => {
    setPayee("");
    setAmount("");
    setMemo("");
    setCategoryValue("");
    setSplits([makeSplit()]);
    setMode("simple");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saveDisabled) return;

    if (mode === "split") {
      const normalized = splits.map((split) => {
        const [kind, accountId] = split.selection.split(":");
        return {
          id: split.id,
          kind,
          accountId,
          amount: parseAmount(split.amount) ?? 0,
          gstCode: split.isTransfer ? undefined : split.gstCode ?? "GST",
        };
      });
      onSave({
        mode: "split",
        date,
        payee,
        amount: transactionAmount,
        memo,
        splits: normalized,
      });
    } else {
      const [kind, accountId] = categoryValue.split(":");
      const isTransfer = kind === "transfer";
      onSave({
        mode: "simple",
        date,
        payee,
        amount: transactionAmount,
        memo,
        selection: { kind, accountId },
        gstCode: isTransfer ? undefined : "GST",
      });
    }

    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">New transaction</h2>
          <button type="button" onClick={() => { resetForm(); onClose(); }} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600 hover:bg-slate-200">
            Close
          </button>
        </div>

        <div className="flex items-center gap-2">
          <PillToggle active={mode === "simple"} onClick={switchToSimple}>
            Simple
          </PillToggle>
          <PillToggle active={mode === "split"} onClick={switchToSplit}>
            Split
          </PillToggle>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Date</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Payee</span>
          <input
            value={payee}
            onChange={(event) => setPayee(event.target.value)}
            placeholder="e.g., Woolworths"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>
"
$replacement += @'

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Amount</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>

        {mode === "simple" ? (
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Category or transfer account</span>
            <select
              value={categoryValue}
              onChange={(event) => setCategoryValue(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select an option…</option>
              {categoryOptions.length ? (
                <optgroup label="Categories">
                  {categoryOptions.map((option) => (
                    <option key={`category:${option.id}`} value={`category:${option.id}`}>
                      {option.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {transferOptions.length ? (
                <optgroup label="Transfer to account">
                  {transferOptions.map((option) => (
                    <option key={`transfer:${option.id}`} value={`transfer:${option.id}`}>
                      {option.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Splits</span>
              {remainingBadge ? (
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${remainingBadge.tone}`}>
                  {remainingBadge.label}
                </span>
              ) : null}
            </div>
            {splits.map((split) => (
              <div key={split.id} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <select
                    value={split.selection}
                    onChange={(event) => handleSplitSelectionChange(split.id, event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select category or account…</option>
                    {categoryOptions.length ? (
                      <optgroup label="Categories">
                        {categoryOptions.map((option) => (
                          <option key={`category:${option.id}`} value={`category:${option.id}`}>
                            {option.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    {transferOptions.length ? (
                      <optgroup label="Transfer to account">
                        {transferOptions.map((option) => (
                          <option key={`transfer:${option.id}`} value={`transfer:${option.id}`}>
                            {option.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                  </select>
                  <input
                    value={split.amount}
                    onChange={(event) => handleSplitAmountChange(split.id, event.target.value)}
                    placeholder="Amount"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 md:w-48"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {!split.isTransfer ? (
                    <select
                      value={split.gstCode ?? "GST"}
                      onChange={(event) => handleSplitGstChange(split.id, event.target.value as GstCode)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {gstOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-slate-500">No GST on transfers</span>
                  )}
                  {splits.length > 1 ? (
                    <button type="button" onClick={() => handleRemoveSplit(split.id)} className="text-xs font-medium text-rose-600 hover:text-rose-500">
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            <button type="button" onClick={handleAddSplit} className="text-sm font-semibold text-emerald-600 hover:text-emerald-500">
              + Add split
            </button>
          </div>
        )}

        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">Memo</span>
          <textarea
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </label>

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => { resetForm(); onClose(); }} className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600 hover:bg-slate-200">
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400"
            disabled={saveDisabled}
          >
            Save transaction
          </button>
        </div>
      </form>
    </div>
  );
}export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState<string | null>(accountCatalogue[0]?.id ?? null);
  const [showTxnForm, setShowTxnForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "biz" | "personal">("all");
  const [rows, setRows] = useState<RegisterRow[]>(registerSeed);

  const totals = useMemo(() => {
    const assets = accountCatalogue.filter((account) => account.type === "ASSET");
    const businessAssets = assets.filter((account) => account.isBusiness);
    const gstAccounts = accountCatalogue.filter((account) => account.subtype === "GST_CONTROL");

    return {
      cash: assets.reduce((sum, account) => sum + account.balance, 0),
      businessCash: businessAssets.reduce((sum, account) => sum + account.balance, 0),
      gst: gstAccounts.reduce((sum, account) => sum + account.balance, 0),
    };
  }, []);

  const filteredRows = useMemo(() => {
    let data = rows;
    if (filter === "biz") data = data.filter((row) => row.business);
    if (filter === "personal") data = data.filter((row) => !row.business);
    return data;
  }, [filter, rows]);

  const selectedAccountName = selected ? accountCatalogue.find((account) => account.id === selected)?.name ?? "" : "";

  const handleCategoryChange = (rowId: number, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        if (!value) {
          return { ...row, categoryId: undefined, transferAccountId: undefined, gstCode: undefined };
        }
        const [kind, accountId] = value.split(":");
        if (kind === "category") {
          const categoryAccount = seed.accounts.find((account) => account.id === accountId);
          return {
            ...row,
            categoryId: accountId,
            transferAccountId: undefined,
            gstCode: row.gstCode ?? "GST",
            business: categoryAccount?.isBusiness ?? row.business,
          };
        }
        if (kind === "transfer") {
          const transferAccount = seed.accounts.find((account) => account.id === accountId);
          return {
            ...row,
            transferAccountId: accountId,
            categoryId: undefined,
            gstCode: undefined,
            business: transferAccount?.isBusiness ?? row.business,
          };
        }
        return row;
      }),
    );
  };

  return (
    <div className="h-full w-full bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[120rem] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCollapsed((value) => !value)}
              className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <IconChevronLeft className={`h-4 w-4 transition ${collapsed ? "rotate-180" : ""}`} />
            </button>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black tracking-tight">Ledgerhound</span>
              <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">AU</span>
            </div>
          </div>

          <div className="hidden min-w-[380px] items-center gap-3 md:flex">
            <div className="relative w-full">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Search payees, memos, categories…"
              />
            </div>
            <ShellButton icon={IconPlus} onClick={() => setShowTxnForm(true)}>
              New Transaction
            </ShellButton>
            <ShellButton icon={IconUpload}>Import CSV</ShellButton>
            <ShellButton icon={IconListChecks}>Reconcile</ShellButton>
            <ShellButton icon={IconBarChart}>Reports</ShellButton>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[120rem] grid-cols-12 gap-6 px-4 py-6">
        <aside className={`col-span-12 md:col-span-3 ${collapsed ? "md:max-w-[64px]" : "md:max-w-[360px]"} transition-[max-width] duration-300`}>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {!collapsed ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">Accounts</h2>
                  <ShellButton icon={IconPlus}>New</ShellButton>
                </div>

                {seed.sections.map((section) => (
                  <Section key={section.key} title={section.title}>
                    {section.items.map((account) => (
                      <AccountRow
                        key={account.id}
                        name={account.name}
                        amount={account.balance}
                        business={account.isBusiness}
                        selected={selected === account.id}
                        onSelect={() => setSelected(account.id)}
                      />
                    ))}
                  </Section>
                ))}

                <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
                  <span>Refresh accounts</span>
                  <span>Last sync: just now</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <IconBanknote className="mt-1 h-6 w-6 text-emerald-600" />
                <div className="h-[1px] w-6 bg-slate-200" />
                {seed.sections.map((section) => (
                  <div key={section.key} className="flex flex-col items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{section.title[0]}</span>
                    {section.items.map((account) => (
                      <button
                        key={account.id}
                        onClick={() => setSelected(account.id)}
                        className={`rounded-lg p-2 ${selected === account.id ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"}`}
                        title={account.name}
                      >
                        <IconFolder className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className="col-span-12 md:col-span-9">
          {!selected ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard label="Cash on Hand" value={formatMoney(totals.cash)} icon={IconBanknote} />
                <StatCard label="Business Cash" value={formatMoney(totals.businessCash)} icon={IconBanknote} />
                <StatCard label="GST Control" value={formatMoney(totals.gst)} icon={IconBanknote} />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-slate-800">Welcome to Ledgerhound</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Personal & small-business ledger designed for Australia. Select an account on the left to view transactions, or import a CSV from your bank to get started.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <ShellButton icon={IconUpload}>Import CSV</ShellButton>
                    <ShellButton icon={IconPlus} onClick={() => setShowTxnForm(true)}>
                      Add first transaction
                    </ShellButton>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800">Quick links</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li className="flex items-center justify-between">
                      <span className="text-slate-600">Create BAS draft for this quarter</span>
                      <ShellButton icon={IconBarChart}>Open</ShellButton>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-slate-600">Reconcile last month</span>
                      <ShellButton icon={IconListChecks}>Start</ShellButton>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-slate-600">Set up memorised rules</span>
                      <ShellButton icon={IconListChecks}>Rules</ShellButton>
                    </li>
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-800">{selectedAccountName}</h2>
                  <p className="text-sm text-slate-500">
                    Register · Current: {formatMoney(4390)} · Cleared: {formatMoney(4390)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PillToggle active={filter === "all"} onClick={() => setFilter("all")}>
                    All
                  </PillToggle>
                  <PillToggle active={filter === "biz"} onClick={() => setFilter("biz")}>
                    Business
                  </PillToggle>
                  <PillToggle active={filter === "personal"} onClick={() => setFilter("personal")}>
                    Personal
                  </PillToggle>
                  <ShellButton icon={IconPlus} onClick={() => setShowTxnForm(true)}>
                    New transaction
                  </ShellButton>
                  <ShellButton icon={IconUpload}>Import</ShellButton>
                  <ShellButton icon={IconListChecks}>Reconcile</ShellButton>
                </div>
              </div>

              <RegisterTable rows={filteredRows} accounts={seed.accounts} accountId={selected} onCategoryChange={handleCategoryChange} />
            </>
          )}
        </section>
      </main>

      <footer className="mx-auto mt-6 max-w-[120rem] px-4 pb-10 text-center text-xs text-slate-400">
        Ledgerhound · Prototype UI · Designed for clarity, keyboard-first entry, and AU GST workflows
      </footer>

      <TransactionForm
        open={showTxnForm}
        onClose={() => setShowTxnForm(false)}
        accounts={seed.accounts}
        onSave={(payload) => {
          console.log("SAVE", payload);
          setShowTxnForm(false);
        }}
      />
    </div>
  );
}




