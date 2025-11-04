# Next Steps - Action Plan

## 🎯 Option 1: Build Transaction Form (Fastest Path to Value)

This will let you add transactions through the UI, which is the core user interaction.

### Step 1: Create the Transaction Form Component

Create `src/components/Transaction/TransactionFormModal.tsx`:

```tsx
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { Account, CreateTransactionDTO } from '../../types';
import { transactionAPI, accountAPI } from '../../lib/api';

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId?: string; // Pre-select account if opening from register
}

export function TransactionFormModal({
  isOpen,
  onClose,
  accountId
}: TransactionFormModalProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [memo, setMemo] = useState('');
  const [isBusiness, setIsBusiness] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const transactionData: CreateTransactionDTO = {
        date: new Date(date),
        payee,
        memo: memo || undefined,
        postings: [
          {
            accountId: accountId!,
            amount: -parseFloat(amount),
            isBusiness: false,
          },
          {
            accountId: categoryId,
            amount: parseFloat(amount),
            isBusiness,
            gstCode: isBusiness ? 'GST' : undefined,
            gstRate: isBusiness ? 0.1 : undefined,
            gstAmount: isBusiness ? parseFloat(amount) * 0.1 / 1.1 : undefined,
          },
        ],
      };

      await transactionAPI.createTransaction(transactionData);
      onClose();
      // Refresh the register
    } catch (error) {
      console.error('Failed to create transaction:', error);
      alert('Failed to create transaction: ' + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
          <Dialog.Title className="text-xl font-bold mb-4">
            New Transaction
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            {/* Payee */}
            <div>
              <label className="block text-sm font-medium mb-1">Payee</label>
              <input
                type="text"
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                required
                placeholder="Who did you pay?"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="0.00"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Select category...</option>
                {/* TODO: Load categories from API */}
              </select>
            </div>

            {/* Business Toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="business"
                checked={isBusiness}
                onChange={(e) => setIsBusiness(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="business" className="text-sm font-medium">
                This is a business expense (track GST)
              </label>
            </div>

            {/* GST Info (only if business) */}
            {isBusiness && amount && (
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded text-sm">
                <div className="flex justify-between">
                  <span>GST (10%):</span>
                  <span className="font-medium">
                    ${(parseFloat(amount) * 0.1 / 1.1).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>GST-exclusive:</span>
                  <span className="font-medium">
                    ${(parseFloat(amount) - parseFloat(amount) * 0.1 / 1.1).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Memo */}
            <div>
              <label className="block text-sm font-medium mb-1">Memo (optional)</label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Transaction'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

### Step 2: Add "New Transaction" Button

Update `src/components/Layout/TopBar.tsx` to open the modal:

```tsx
const [showTransactionForm, setShowTransactionForm] = useState(false);

// In the actions section:
<button
  onClick={() => setShowTransactionForm(true)}
  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
>
  New Transaction
</button>

<TransactionFormModal
  isOpen={showTransactionForm}
  onClose={() => setShowTransactionForm(false)}
  accountId={selectedAccount?.id}
/>
```

### Step 3: Test It

```bash
npm run dev
```

Click "New Transaction" and you should see the form!

**Note:** It won't actually save yet because we're using mock API. But the UI will work!

---

## 🎯 Option 2: Implement Tauri Commands (Unblocks Everything)

This connects the UI to the real backend, making the app actually work.

### Quick Setup with tauri-plugin-sql

**Step 1: Install the plugin**

```bash
npm install @tauri-apps/plugin-sql
cd src-tauri
cargo add tauri-plugin-sql --features sqlite
cd ..
```

**Step 2: Configure Tauri to use the plugin**

Edit `src-tauri/src/lib.rs`:

```rust
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:ledgerhound.db",
                    vec![
                        // Copy your Prisma migrations here
                    ],
                )
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 3: Update API Bridge**

Edit `src/lib/api.ts` to use Tauri's SQL plugin:

```typescript
import Database from 'tauri-plugin-sql-api';

let db: Database | null = null;

async function getDB() {
  if (!db) {
    db = await Database.load('sqlite:ledgerhound.db');
  }
  return db;
}

export const accountAPI = {
  async getAllAccountsWithBalances(): Promise<AccountWithBalance[]> {
    const database = await getDB();

    // Raw SQL query (or use your Prisma schema)
    const accounts = await database.select(
      'SELECT * FROM accounts WHERE archived = 0'
    );

    // Calculate balances for each account
    // ... (use similar logic from accountService.ts)

    return accounts;
  },

  // ... other methods
};
```

**Pros:** Fastest way to get working
**Cons:** Need to rewrite queries from Prisma to SQL

---

## 🎯 Option 3: Alternative Tauri Approach (Keep Prisma)

If you want to keep using the Prisma services as-is:

### Use Tauri Sidecar to Run Node.js

**Step 1: Create a Node.js API server**

Create `src-node/server.js`:

```javascript
import express from 'express';
import { accountService, transactionService } from '../src/lib/services/index.js';

const app = express();
app.use(express.json());

app.get('/accounts', async (req, res) => {
  const accounts = await accountService.getAllAccountsWithBalances();
  res.json(accounts);
});

app.post('/transactions', async (req, res) => {
  const transaction = await transactionService.createTransaction(req.body);
  res.json(transaction);
});

// ... more endpoints

app.listen(3001, () => {
  console.log('API server running on port 3001');
});
```

**Step 2: Start the server as a Tauri sidecar**

Configure in `tauri.conf.json`:

```json
{
  "tauri": {
    "bundle": {
      "externalBin": ["node", "src-node/server.js"]
    }
  }
}
```

**Step 3: Call it from the frontend**

```typescript
export const accountAPI = {
  async getAllAccountsWithBalances(): Promise<AccountWithBalance[]> {
    const response = await fetch('http://localhost:3001/accounts');
    return response.json();
  },
};
```

**Pros:** Keep all existing Prisma code
**Cons:** More complex, users need Node.js

---

## 🎯 My Recommendation

**For fastest MVP:** Go with **Option 1 + Option 2**

1. **Build the Transaction Form first** (2-3 hours)
   - You can test it with mock data
   - Gets the UI working
   - Shows progress

2. **Then implement Tauri commands** (3-4 hours)
   - Use tauri-plugin-sql
   - Start with just the essential commands:
     - `get_all_accounts`
     - `get_register_entries`
     - `create_transaction`
   - Once these work, add the rest

3. **Then make everything interactive** (1-2 hours)
   - Connect buttons to real actions
   - Add keyboard shortcuts
   - Polish the UX

**Total time to working app: ~6-9 hours**

---

## 📝 What I'd Do First (If I Were You)

### Morning Session (3 hours):
1. **Build Transaction Form** - Get the UI component working
2. **Wire up the "New Transaction" button**
3. **Test with mock data**

### Afternoon Session (4 hours):
1. **Install tauri-plugin-sql**
2. **Implement 3 essential Tauri commands:**
   - Get accounts
   - Get transactions
   - Create transaction
3. **Update api.ts to use real Tauri commands**
4. **Test end-to-end**: Click "New Transaction" → Fill form → Save → See in register

### Evening (2 hours):
1. **Add remaining Tauri commands**
2. **Polish and bug fixes**
3. **Test with real data**

**By end of day: You have a WORKING ledger app!** 🎉

---

## 🚀 Quick Commands Reference

```bash
# View database
npm run db:studio

# Run UI
npm run dev

# Seed with fresh data
npm run db:seed

# Run Tauri app (once commands are implemented)
npm run tauri:dev

# Build for production
npm run tauri:build
```

---

## 📞 Need Help?

Check these files:
- **[QUICK_START.md](QUICK_START.md)** - How to use what's built
- **[REMAINING_WORK.md](REMAINING_WORK.md)** - Detailed task breakdown
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - What's complete

The backend is **completely done**. Just need to:
1. Build the UI components
2. Connect them via Tauri commands

You're so close! 🎯
