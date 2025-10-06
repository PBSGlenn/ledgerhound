import express from 'express';
import cors from 'cors';
import { accountService } from '../src/lib/services/accountService.js';
import { AccountKind, AccountType } from '@prisma/client';
import { transactionService } from '../src/lib/services/transactionService.js';
import { reportService } from '../src/lib/services/reportService.js';
import { importService } from '../src/lib/services/importService.js';
import { reconciliationService } from '../src/lib/services/reconciliationService.js';
import { memorizedRuleService } from '../src/lib/services/memorizedRuleService.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ============================================================================
// ACCOUNT ENDPOINTS
// ============================================================================

app.get('/api/accounts', async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const typeParam = req.query.type as string | undefined;
    const kindParam = req.query.kind as string | undefined;

    const isRealParam = req.query.isReal as string | undefined;

    const type = typeParam && Object.values(AccountType).includes(typeParam as AccountType) ? (typeParam as AccountType) : undefined;
    const kind = kindParam && Object.values(AccountKind).includes(kindParam as AccountKind) ? (kindParam as AccountKind) : undefined;
    const isReal = isRealParam === 'true' ? true : isRealParam === 'false' ? false : undefined;

    const accounts = await accountService.getAllAccounts({
      includeArchived,
      type,
      kind,
      isReal,
    });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/accounts/:id', async (req, res) => {
  try {
    const account = await accountService.getAccountById(req.params.id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const account = await accountService.createAccount(req.body);
    res.status(201).json(account);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.put('/api/accounts/:id', async (req, res) => {
  try {
    const account = await accountService.updateAccount(req.params.id, req.body);
    res.json(account);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  try {
    await accountService.deleteAccount(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/api/accounts/:id/balance', async (req, res) => {
  try {
    const balance = await accountService.getAccountBalance(req.params.id);
    res.json({ balance });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const categories = await accountService.getAllAccounts({
      includeArchived,
      kind: AccountKind.CATEGORY,
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name, type, isBusinessDefault, sortOrder } = req.body as { name: string; type: AccountType; isBusinessDefault?: boolean; sortOrder?: number };
    if (type !== AccountType.INCOME && type !== AccountType.EXPENSE) {
      return res.status(400).json({ error: 'Categories must be INCOME or EXPENSE' });
    }

    const category = await accountService.createAccount({
      name,
      type,
      isBusinessDefault,
      isReal: false,
      sortOrder,
    });
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});


// ============================================================================
// TRANSACTION ENDPOINTS
// ============================================================================

app.get('/api/transactions/register/:accountId', async (req, res) => {
  try {
    const filter = {
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      searchText: req.query.searchText as string | undefined,
      cleared: req.query.cleared === 'true' ? true : req.query.cleared === 'false' ? false : undefined,
      reconciled: req.query.reconciled === 'true' ? true : req.query.reconciled === 'false' ? false : undefined,
    };
    const entries = await transactionService.getRegisterEntries(req.params.accountId, filter);
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/transactions/:id', async (req, res) => {
  try {
    const transaction = await transactionService.getTransactionById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const transaction = await transactionService.createTransaction(req.body);
    res.status(201).json(transaction);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const transaction = await transactionService.updateTransaction(req.params.id, req.body);
    res.json(transaction);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/api/transactions/bulk-add-tags', async (req, res) => {
  try {
    const { transactionIds, tags } = req.body;
    await transactionService.bulkAddTags(transactionIds, tags);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});
  try {
    await transactionService.deleteTransaction(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// ============================================================================
// REPORT ENDPOINTS
// ============================================================================

app.get('/api/reports/profit-loss', async (req, res) => {
  try {
    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);
    const report = await reportService.generateProfitLoss(startDate, endDate);
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/api/reports/gst-summary', async (req, res) => {
  try {
    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);
    const report = await reportService.generateGSTSummary(startDate, endDate);
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/api/reports/bas-draft', async (req, res) => {
  try {
    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);
    const report = await reportService.generateBASDraft(startDate, endDate);
    res.json(report);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// ============================================================================
// IMPORT ENDPOINTS
// ============================================================================

app.post('/api/import/preview', async (req, res) => {
  try {
    const { csvText, mapping } = req.body;
    const preview = await importService.parseCSV(csvText, mapping);
    res.json(preview);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/api/import/execute', async (req, res) => {
  try {
    const { accountId, csvText, mapping } = req.body;
    const result = await importService.importTransactions(accountId, csvText, mapping);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

// ============================================================================
// RECONCILIATION ENDPOINTS
// ============================================================================

app.post('/api/reconciliation/start', async (req, res) => {
  try {
    const { accountId, statementDate, statementBalance } = req.body;
    const reconciliation = await reconciliationService.startReconciliation(
      accountId,
      new Date(statementDate),
      statementBalance
    );
    res.status(201).json(reconciliation);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/api/reconciliation/:id/toggle-posting', async (req, res) => {
  try {
    const { postingId } = req.body;
    await reconciliationService.togglePostingReconciled(req.params.id, postingId);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/api/reconciliation/:id/finish', async (req, res) => {
  try {
    const reconciliation = await reconciliationService.finishReconciliation(req.params.id);
    res.json(reconciliation);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/api/reconciliation/:id/summary', async (req, res) => {
  try {
    const summary = await reconciliationService.getReconciliationSummary(req.params.id);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// MEMORIZED RULE ENDPOINTS
// ============================================================================

app.get('/api/rules', async (req, res) => {
  try {
    const rules = await memorizedRuleService.getAllRules();
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/rules', async (req, res) => {
  try {
    const rule = await memorizedRuleService.createRule(req.body);
    res.status(201).json(rule);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/api/rules/match', async (req, res) => {
  try {
    const { payee, memo } = req.body;
    const match = await memorizedRuleService.findMatchingRule(payee, memo);
    res.json(match || null);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`🚀 Ledgerhound API server running at http://localhost:${PORT}`);
  console.log(`📊 Database: SQLite via Prisma`);
});
