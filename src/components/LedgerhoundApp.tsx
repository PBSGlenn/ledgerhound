import React, { useMemo, useState } from "react";
import type { JSX } from "react";

// --- Simple inline icons (no external deps) ---
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
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
  </svg>
);
const IconX = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// --- Mock data ---
const seed = {
  sections: [
    {
      title: "Assets",
      key: "assets",
      items: [
        { id: "a1", name: "Personal Checking", balance: 4390 },
        { id: "a2", name: "Business CheckingBiz", balance: 11100, business: true },
      ],
    },
    {
      title: "Liabilities",
      key: "liabilities",
      items: [
        { id: "l1", name: "Personal Credit Card", balance: -150 },
        { id: "l2", name: "Business Credit CardBiz", balance: 110, business: true },
        { id: "l3", name: "GST ControlBiz", balance: 0, business: true },
      ],
    },
    {
      title: "Income",
      key: "income",
      items: [
        { id: "i1", name: "Salary", balance: 0 },
        { id: "i2", name: "Sales IncomeBiz", balance: -1000, business: true },
      ],
    },
    {
      title: "Expenses",
      key: "expenses",
      items: [
        { id: "e1", name: "Groceries", balance: 110 },
        { id: "e2", name: "Dining Out", balance: 59.09 },
        { id: "e3", name: "Office SuppliesBiz", balance: 100, business: true },
        { id: "e4", name: "Business MealsBiz", balance: 90.91, business: true },
      ],
    },
  ],
  register: [
    {
      id: 101,
      date: "2025-08-20",
      payee: "Savings Transfer",
      memo: "Holiday fund contribution #savings",
      category: "Holiday Fund",
      debit: 500,
      credit: 0,
      balance: 3890,
      cleared: true,
      tags: ["#savings"],
    },
    { id: 102, date: "2025-06-02", payee: "Stripe Payout", memo: "May", category: "Sales IncomeBiz", debit: 0, credit: 1000, balance: 5390, business: true, cleared: true },
    { id: 103, date: "2025-06-03", payee: "Officeworks", memo: "Printer paper", category: "Office SuppliesBiz", debit: 100, credit: 0, balance: 5290, business: true, cleared: false },
  ],
};

// --- Utilities ---
export const formatMoney = (n: number) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "AUD" }).format(n);

export const extractTags = (memo?: string, explicit?: string[]) => {
  if (explicit && explicit.length) return explicit;
  if (!memo) return [] as string[];
  return memo.match(/#[a-z0-9_]+/gi) || [];
};

// --- UI Primitives ---
function ShellButton({
  icon: Icon,
  children,
  onClick,
}: {
  icon?: (props: React.SVGProps<SVGSVGElement>) => JSX.Element;
  children: React.ReactNode;
  onClick?: () => void;
}) {
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

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-slate-400" /> : null}
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function AccountRow({
  name,
  amount,
  selected,
  onSelect,
  business,
}: {
  name: string;
  amount: number;
  selected?: boolean;
  onSelect?: () => void;
  business?: boolean;
}) {
  const negative = amount < 0;
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-xl border px-3 py-2 text-left shadow-sm transition ${
        selected
          ? "border-emerald-500 bg-emerald-50"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconFolder className={`h-4 w-4 ${business ? "text-emerald-600" : "text-slate-400"}`} />
          <span className="text-sm font-medium text-slate-800">{name}</span>
          {business ? (
            <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Biz</span>
          ) : null}
        </div>
        <span className={`text-sm ${negative ? "text-rose-600" : "text-slate-700"}`}>{formatMoney(amount)}</span>
      </div>
    </button>
  );
}

function PillToggle({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function RegisterTable({ rows }: { rows: typeof seed.register }) {
  const toAu = (d: string) =>
    new Date(d).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const cols = "grid grid-cols-[120px_1fr_120px_120px_140px]"; // Date · Payee · Debit · Credit · Balance
  const endingBalance = rows.length ? rows[rows.length - 1].balance ?? 0 : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Sticky heading row */}
      <div className={`sticky top-[56px] z-10 ${cols} border-b bg-slate-50/95 px-4 py-2 text-[12px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur`}>
        <div>Date</div>
        <div>Payee</div>
        <div className="text-right">Debit</div>
        <div className="text-right">Credit</div>
        <div className="text-right">Balance</div>
      </div>

      <ul className="divide-y">
        {rows.map((r) => {
          const tags = extractTags(r.memo, r.tags);
          return (
            <li key={r.id} className="px-4 py-3 text-sm">
              {/* Row 1: Date · Payee · Debit · Credit · Balance */}
              <div className={`${cols} items-center gap-x-4`}>
                <div className="text-slate-700">{toAu(r.date)}</div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{r.payee}</span>
                  {r.business ? (
                    <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Biz</span>
                  ) : null}
                  {r.cleared ? (
                    <span className="rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[10px] text-white">✓ Cleared</span>
                  ) : null}
                </div>
                <div className="text-right tabular-nums text-slate-700">
                  {r.debit ? formatMoney(r.debit) : ""}
                </div>
                <div className="text-right tabular-nums text-slate-700">
                  {r.credit ? formatMoney(r.credit) : ""}
                </div>
                <div className="text-right tabular-nums font-medium text-slate-900">
                  {typeof r.balance === "number" ? formatMoney(r.balance) : ""}
                </div>
              </div>

              {/* Row 2: indent → Category • Memo • #tags (spans the Payee column) */}
              <div className={`mt-1 ${cols} gap-x-4 text-xs text-slate-500`}>
                <div />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-slate-400">→</span>
                  {r.category ? (
                    <span className="font-medium text-slate-700">{r.category}</span>
                  ) : null}
                  {r.category && (r.memo || tags.length) ? <span className="mx-1">•</span> : null}
                  {r.memo ? (
                    <span>{r.memo.replace(/#[a-z0-9_]+/gi, "").trim()}</span>
                  ) : null}
                  {tags.length ? <span className="mx-1">•</span> : null}
                  {tags.map((t, i) => (
                    <span key={i} className="text-slate-600">
                      {t}
                    </span>
                  ))}
                </div>
                {/* empty cells to line up with grid */}
                <div />
                <div />
                <div />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Footer summary */}
      <div className="flex items-center justify-between border-t bg-slate-50 px-4 py-2 text-xs text-slate-600">
        <span>
          {rows.length} transaction{rows.length === 1 ? "" : "s"}
        </span>
        <span className="font-medium">Ending balance: {formatMoney(endingBalance || 0)}</span>
      </div>
    </div>
  );
}

function TransactionForm({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (values: any) => void;
}) {
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [payee, setPayee] = useState("");
  const [memo, setMemo] = useState("");
  const [isBusiness, setIsBusiness] = useState<boolean>(false);
  const [category, setCategory] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [type, setType] = useState<"debit" | "credit">("debit");
  const [splits, setSplits] = useState<Array<{ account: string; amount: string }>>([]);

  const totalSplits = splits.reduce((acc, s) => acc + (parseFloat(s.amount || "0") || 0), 0);
  const amt = parseFloat(amount || "0") || 0;
  const isBalanced = Math.abs(totalSplits - amt) < 0.005 || splits.length === 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <div className="ml-auto h-full w-full max-w-[560px] overflow-y-auto border-l border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/90 px-5 py-3 backdrop-blur">
          <h3 className="text-base font-semibold">New Transaction</h3>
          <button onClick={onClose} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50">
            <IconX className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Business</span>
              <div className="flex gap-2">
                <PillToggle active={!isBusiness} onClick={() => setIsBusiness(false)}>
                  Personal
                </PillToggle>
                <PillToggle active={isBusiness} onClick={() => setIsBusiness(true)}>
                  Business
                </PillToggle>
              </div>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Payee</span>
            <input
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder="e.g., Woolworths"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Amount</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Type</span>
              <div className="flex gap-2">
                <PillToggle active={type === "debit"} onClick={() => setType("debit")}>
                  Debit
                </PillToggle>
                <PillToggle active={type === "credit"} onClick={() => setType("credit")}>
                  Credit
                </PillToggle>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select…</option>
                <option>Groceries</option>
                <option>Dining Out</option>
                <option>Office SuppliesBiz</option>
                <option>Sales IncomeBiz</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-slate-600">Memo (optional)</span>
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Add a note…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
          </div>

          {/* Splits */}
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Split lines</p>
                <p className="text-xs text-slate-500">
                  Optional. {splits.length ? (isBalanced ? "Balanced" : "Unbalanced") : "Add lines to split this transaction."}
                </p>
              </div>
              <ShellButton
                icon={IconPlus}
                onClick={() => setSplits((s) => [...s, { account: "", amount: "" }])}
              >
                Add line
              </ShellButton>
            </div>
            <div className="space-y-2">
              {splits.map((sp, idx) => (
                <div key={idx} className="grid grid-cols-8 gap-2">
                  <input
                    placeholder="Account (e.g., Office SuppliesBiz)"
                    value={sp.account}
                    onChange={(e) =>
                      setSplits((arr) =>
                        arr.map((x, i) => (i === idx ? { ...x, account: e.target.value } : x))
                      )
                    }
                    className="col-span-5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    placeholder="Amount"
                    value={sp.amount}
                    onChange={(e) =>
                      setSplits((arr) =>
                        arr.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x))
                      )
                    }
                    className="col-span-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    className="col-span-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                    onClick={() => setSplits((arr) => arr.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {splits.length > 0 ? (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-600">Split total</span>
                <span className={`font-medium ${isBalanced ? "text-slate-800" : "text-rose-600"}`}>
                  {formatMoney(totalSplits)}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Keyboard: Tab/Shift‑Tab · Enter to Save · Esc to Cancel</span>
            <span>Debit/Credit reflect from‑account perspective</span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave({ date, payee, memo, isBusiness, category, amount: amt, type, splits })}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              disabled={!payee || !amount || !category || !isBalanced}
            >
              Save Transaction
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Tiny runtime tests (console only) ---
(function runTests() {
  try {
    // formatMoney basic
    const f = formatMoney(500);
    console.assert(/500\.00/.test(f), `formatMoney should include 500.00, got ${f}`);

    // tag extraction from memo
    const tags = extractTags("Holiday fund contribution #savings #biz");
    console.assert(Array.isArray(tags) && tags.length === 2 && tags[0] === "#savings" && tags[1] === "#biz", "extractTags should parse hashtags in order");

    // explicit tags override
    const tags2 = extractTags("memo #ignore", ["#one"]);
    console.assert(tags2.length === 1 && tags2[0] === "#one", "explicit tags should be used when provided");

    // running tally invariant: ending balance equals last row balance
    const last = seed.register[seed.register.length - 1].balance;
    console.assert(typeof last === "number" && last === 5290, `expected last running balance 5290, got ${last}`);
  } catch (e) {
    console.error("Unit tests failed:", e);
  }
})();

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showTxnForm, setShowTxnForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "biz" | "personal">("all");

  const totals = useMemo(() => {
    const flat = seed.sections.flatMap((s) => s.items);
    const businessCash = flat
      .filter((a) => a.business && a.name.toLowerCase().includes("checking"))
      .reduce((acc, a) => acc + a.balance, 0);
    const cash = flat
      .filter((a) => a.name.toLowerCase().includes("checking"))
      .reduce((acc, a) => acc + a.balance, 0);
    const gst = flat.find((a) => a.name.toLowerCase().includes("gst"))?.balance ?? 0;
    return { cash, businessCash, gst };
  }, []);

  const selectedName = useMemo(() => {
    if (!selected) return null;
    for (const s of seed.sections) {
      const f = s.items.find((i) => i.id === selected);
      if (f) return f.name;
    }
    return null;
  }, [selected]);

  const filteredRows = useMemo(() => {
    let rows = seed.register;
    if (filter === "biz") rows = rows.filter((r) => r.business);
    if (filter === "personal") rows = rows.filter((r) => !r.business);
    return rows;
  }, [filter]);

  return (
    <div className="h-full w-full bg-slate-50 text-slate-800">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[120rem] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCollapsed((v) => !v)}
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
        {/* Sidebar */}
        <aside
          className={`col-span-12 md:col-span-3 ${
            collapsed ? "md:max-w-[64px]" : "md:max-w-[360px]"
          } transition-[max-width] duration-300`}
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {!collapsed ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">Accounts</h2>
                  <ShellButton icon={IconPlus}>New</ShellButton>
                </div>

                {seed.sections.map((sec) => (
                  <Section key={sec.key} title={sec.title}>
                    {sec.items.map((a) => (
                      <AccountRow
                        key={a.id}
                        name={a.name}
                        amount={a.balance}
                        business={a.business}
                        selected={selected === a.id}
                        onSelect={() => setSelected(a.id)}
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
                {seed.sections.map((sec) => (
                  <div key={sec.key} className="flex flex-col items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {sec.title[0]}
                    </span>
                    {sec.items.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setSelected(a.id)}
                        className={`rounded-lg p-2 ${selected === a.id ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-50"}`}
                        title={a.name}
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

        {/* Content */}
        <section className="col-span-12 md:col-span-9">
          {!selected ? (
            <>
              {/* Welcome / Overview */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard label="Cash on Hand" value={formatMoney(totals.cash)} icon={IconBanknote} />
                <StatCard label="Business Cash" value={formatMoney(totals.businessCash)} icon={IconBanknote} />
                <StatCard label="GST Control" value={formatMoney(totals.gst)} icon={IconBanknote} />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
                  <h2 className="text-xl font-semibold tracking-tight text-slate-800">Welcome to Ledgerhound</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Personal & small‑business ledger designed for Australia. Select an account on the left to view transactions, or start by importing a CSV from your bank.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <ShellButton icon={IconUpload}>Import CSV</ShellButton>
                    <ShellButton icon={IconPlus} onClick={() => setShowTxnForm(true)}>
                      Add First Transaction
                    </ShellButton>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-800">Quick Links</h3>
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
              {/* Account register header */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-slate-800">{selectedName}</h2>
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
                    New Transaction
                  </ShellButton>
                  <ShellButton icon={IconUpload}>Import</ShellButton>
                  <ShellButton icon={IconListChecks}>Reconcile</ShellButton>
                </div>
              </div>

              <RegisterTable rows={filteredRows as any} />
            </>
          )}
        </section>
      </main>

      <footer className="mx-auto mt-6 max-w-[120rem] px-4 pb-10 text-center text-xs text-slate-400">
        Ledgerhound · Prototype UI · Designed for clarity, keyboard‑first entry, and AU GST workflows
      </footer>

      <TransactionForm
        open={showTxnForm}
        onClose={() => setShowTxnForm(false)}
        onSave={(v) => {
          console.log("SAVE", v);
          setShowTxnForm(false);
        }}
      />
    </div>
  );
}
