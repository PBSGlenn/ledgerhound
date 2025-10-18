import express from 'express';
import cors from 'cors';
import { accountService } from '../src/lib/services/accountService.js';
import { Prisma, AccountType, AccountKind } from '@prisma/client';
import { transactionService } from '../src/lib/services/transactionService.js';
import { reportService } from '../src/lib/services/reportService.js';
import { importService } from '../src/lib/services/importService.js';
import { reconciliationService } from '../src/lib/services/reconciliationService.js';
import { memorizedRuleService } from '../src/lib/services/memorizedRuleService.js';
import { backupService } from '../src/lib/services/backupService.js';

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

    const type = typeParam as AccountType | undefined;
    const kind = kindParam as AccountKind | undefined;
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

app.post('/api/transactions/mark-cleared', async (req, res) => {
  try {
    const { postingIds, cleared } = req.body;
    await transactionService.markCleared(postingIds, cleared);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
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
    const businessOnly = req.query.businessOnly === 'true';
    const gstInclusive = req.query.gstInclusive === 'true';
    const report = await reportService.generateProfitAndLoss(startDate, endDate, {
      businessOnly,
      gstInclusive,
    });
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
    const { csvText, mapping, sourceAccountId } = req.body;
    const rows = importService.parseCSV(csvText);
    const preview = await importService.previewImport(rows, mapping, sourceAccountId);
    res.json(preview);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/api/import/execute', async (req, res) => {
  try {
    const { previews, sourceAccountId, sourceName, mapping, options } = req.body;
    const result = await importService.importTransactions(previews, sourceAccountId, sourceName, mapping, options);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/api/import/mappings', async (req, res) => {
  try {
    const { name, mapping, accountId } = req.body;
    const savedMapping = await importService.saveImportMappingTemplate(name, mapping, accountId);
    res.status(201).json(savedMapping);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/api/import/mappings', async (req, res) => {
  try {
    const accountId = req.query.accountId as string | undefined;
    const mappings = await importService.getImportMappingTemplates(accountId);
    res.json(mappings);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// RECONCILIATION ENDPOINTS
// ============================================================================

app.post('/api/reconciliation/start', async (req, res) => {
  try {
    const { accountId, statementStartDate, statementEndDate, statementStartBalance, statementEndBalance, notes } = req.body;
    const reconciliation = await reconciliationService.createReconciliation({
      accountId,
      statementStartDate: new Date(statementStartDate),
      statementEndDate: new Date(statementEndDate),
      statementStartBalance,
      statementEndBalance,
      notes,
    });
    res.status(201).json(reconciliation);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/api/reconciliation/:id/reconcile-postings', async (req, res) => {
  try {
    const { postingIds } = req.body;
    await reconciliationService.reconcilePostings(req.params.id, postingIds);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/api/reconciliation/:id/unreconcile-postings', async (req, res) => {
  try {
    const { postingIds } = req.body;
    await reconciliationService.unreconcilePostings(req.params.id, postingIds);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.post('/api/reconciliation/:id/lock', async (req, res) => {
  try {
    const reconciliation = await reconciliationService.lockReconciliation(req.params.id);
    res.json(reconciliation);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get('/api/reconciliation/:id/status', async (req, res) => {
  try {
    const status = await reconciliationService.getReconciliationStatus(req.params.id);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/reconciliation/:id', async (req, res) => {
  try {
    const reconciliation = await reconciliationService.getReconciliationById(req.params.id);
    if (!reconciliation) {
      return res.status(404).json({ error: 'Reconciliation not found' });
    }
    res.json(reconciliation);
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
// BACKUP ENDPOINTS
// ============================================================================

app.post('/api/backup/create', async (req, res) => {
  try {
    const { type } = req.body as { type?: 'manual' | 'auto' | 'pre-import' | 'pre-reconcile' };
    const backup = await backupService.createBackup(type || 'manual');
    res.json(backup);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/backup/list', async (req, res) => {
  try {
    const backups = backupService.listBackups();
    res.json(backups);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/backup/restore', async (req, res) => {
  try {
    const { filename } = req.body as { filename: string };
    await backupService.restoreBackup(filename);
    res.json({ success: true, message: 'Backup restored successfully' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.delete('/api/backup/:filename', async (req, res) => {
  try {
    backupService.deleteBackup(req.params.filename);
    res.json({ success: true, message: 'Backup deleted' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/backup/clean', async (req, res) => {
  try {
    const { keepCount } = req.body as { keepCount?: number };
    const deletedCount = backupService.cleanOldBackups(keepCount);
    res.json({ deletedCount });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/backup/export-json', async (req, res) => {
  try {
    const json = await backupService.exportToJSON();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ledgerhound-export-${new Date().toISOString().split('T')[0]}.json"`);
    res.send(json);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/backup/stats', async (req, res) => {
  try {
    const stats = await backupService.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, async () => {
  console.log(`🚀 Ledgerhound API server running at http://localhost:${PORT}`);
  console.log(`📊 Database: SQLite via Prisma`);

  // Create automatic backup on startup
  try {
    await backupService.createBackup('auto');
    console.log(`💾 Automatic backup created on startup`);
  } catch (error) {
    console.error('⚠️  Failed to create startup backup:', (error as Error).message);
  }
});
