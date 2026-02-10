import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { accountService } from '../src/lib/services/accountService.js';
import { Prisma, AccountType, AccountKind } from '@prisma/client';
import {
  validateBody,
  validateQuery,
  sendError,
  sendNotFound,
  sendConflict,
  sendServerError,
  sendValidationError,
  createAccountSchema,
  updateAccountSchema,
  createCategorySchema,
  updateCategorySchema,
  createTransactionSchema,
  updateTransactionSchema,
  reportDateRangeSchema,
  profitLossQuerySchema,
  startReconciliationSchema,
  reconcilePostingsSchema,
  importPreviewSchema,
  importExecuteSchema,
  createRuleSchema,
  updateRuleSchema,
  reorderRulesSchema,
  bulkAddTagsSchema,
  markClearedSchema,
  createBackupSchema,
  restoreBackupSchema,
  cleanBackupsSchema,
  stripeSettingsSchema,
  stripeImportSchema,
  accountTypeSchema,
  accountKindSchema,
} from './validation.js';
import { transactionService } from '../src/lib/services/transactionService.js';
import { reportService } from '../src/lib/services/reportService.js';
import { importService } from '../src/lib/services/importService.js';
import { reconciliationService } from '../src/lib/services/reconciliationService.js';
import { memorizedRuleService } from '../src/lib/services/memorizedRuleService.js';
import { backupService } from '../src/lib/services/backupService.js';
import { categoryService } from '../src/lib/services/categoryService.js';
import { settingsService } from '../src/lib/services/settingsService.js';
import { stripeImportService } from '../src/lib/services/stripeImportService.js';
import { PDFStatementService } from '../src/lib/services/pdfStatementService.js';
import { ReconciliationMatchingService } from '../src/lib/services/reconciliationMatchingService.js';

const app = express();
const PORT = 3001;

// Configure multer for file uploads (memory storage for PDFs)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Initialize PDF statement service
const pdfStatementService = new PDFStatementService();

// Initialize reconciliation matching service
const reconciliationMatchingService = new ReconciliationMatchingService();

// Security headers with helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'http://localhost:*', 'https://api.stripe.com'],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for development
}));

// Rate limiting - 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Higher limit for development; reduce in production
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configuration - restrict to known origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:1420',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:1420',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Optional API key authentication middleware
// Enable by setting API_KEY environment variable
const apiKeyAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = process.env.API_KEY;

  // Skip authentication if no API_KEY is configured (development mode)
  if (!apiKey) {
    return next();
  }

  // Check for API key in Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Provide API key in Authorization header.' });
  }

  const providedKey = authHeader.substring(7); // Remove 'Bearer ' prefix
  if (providedKey !== apiKey) {
    return res.status(403).json({ error: 'Invalid API key.' });
  }

  next();
};

// Apply authentication to all /api routes
app.use('/api/', apiKeyAuth);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ============================================================================
// ACCOUNT ENDPOINTS
// ============================================================================

app.get('/api/accounts', async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const typeParam = req.query.type as string | undefined;
    const kindParam = req.query.kind as string | undefined;
    const isRealParam = req.query.isReal as string | undefined;

    // Validate enum values if provided
    let type: AccountType | undefined;
    let kind: AccountKind | undefined;

    if (typeParam) {
      const typeResult = accountTypeSchema.safeParse(typeParam);
      if (!typeResult.success) {
        return sendError(res, 400, `Invalid account type: ${typeParam}. Must be one of: ${Object.values(AccountType).join(', ')}`);
      }
      type = typeResult.data;
    }

    if (kindParam) {
      const kindResult = accountKindSchema.safeParse(kindParam);
      if (!kindResult.success) {
        return sendError(res, 400, `Invalid account kind: ${kindParam}. Must be one of: ${Object.values(AccountKind).join(', ')}`);
      }
      kind = kindResult.data;
    }

    const isReal = isRealParam === 'true' ? true : isRealParam === 'false' ? false : undefined;

    const accounts = await accountService.getAllAccounts({
      includeArchived,
      type,
      kind,
      isReal,
    });
    res.json(accounts);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.get('/api/accounts/:id', async (req, res) => {
  try {
    const account = await accountService.getAccountById(req.params.id);
    if (!account) {
      return sendNotFound(res, 'Account');
    }
    res.json(account);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const data = validateBody(createAccountSchema, req.body, res);
    if (!data) return; // Validation error already sent

    const account = await accountService.createAccount(data);
    res.status(201).json(account);
  } catch (error) {
    // Check for duplicate name error
    const message = (error as Error).message;
    if (message.includes('already exists') || message.includes('duplicate') || message.includes('unique')) {
      return sendConflict(res, message);
    }
    return sendError(res, 400, message);
  }
});

app.put('/api/accounts/:id', async (req, res) => {
  try {
    const data = validateBody(updateAccountSchema, req.body, res);
    if (!data) return;

    const account = await accountService.updateAccount(req.params.id, data);
    res.json(account);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return sendNotFound(res, 'Account');
    }
    return sendError(res, 400, message);
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  try {
    await accountService.deleteAccount(req.params.id);
    res.status(204).send();
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return sendNotFound(res, 'Account');
    }
    return sendError(res, 400, message);
  }
});

app.get('/api/accounts/:id/balance', async (req, res) => {
  try {
    const balance = await accountService.getAccountBalance(req.params.id);
    res.json({ balance });
  } catch (error) {
    return sendServerError(res, error);
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
    return sendServerError(res, error);
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const data = validateBody(createCategorySchema, req.body, res);
    if (!data) return;

    const category = await accountService.createAccount({
      name: data.name,
      type: data.type as AccountType,
      isBusinessDefault: data.isBusinessDefault,
      defaultHasGst: data.defaultHasGst,
      parentId: data.parentId,
      isReal: false,
      sortOrder: data.sortOrder,
    });
    res.status(201).json(category);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('already exists') || message.includes('duplicate')) {
      return sendConflict(res, message);
    }
    return sendError(res, 400, message);
  }
});

// ============================================================================
// CATEGORY HIERARCHY ENDPOINTS
// ============================================================================

app.get('/api/categories/tree', async (req, res) => {
  try {
    const options = {
      includeRoot: req.query.includeRoot === 'true',
      type: req.query.type as AccountType | undefined,
      businessOnly: req.query.businessOnly === 'true',
      personalOnly: req.query.personalOnly === 'true',
      maxLevel: req.query.maxLevel ? parseInt(req.query.maxLevel as string) : undefined,
    };
    const tree = await categoryService.getCategoryTree(options);
    res.json(tree);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.get('/api/categories/leaf', async (req, res) => {
  try {
    const options = {
      type: req.query.type as AccountType | undefined,
      businessOnly: req.query.businessOnly === 'true',
      personalOnly: req.query.personalOnly === 'true',
    };
    const leafCategories = await categoryService.getLeafCategories(options);
    res.json(leafCategories);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.get('/api/categories/:id/path', async (req, res) => {
  try {
    const path = await categoryService.getCategoryPath(req.params.id);
    res.json(path);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.get('/api/categories/:id/children', async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const children = await categoryService.getCategoryChildren(req.params.id, { includeArchived });
    res.json(children);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.get('/api/categories/level/:level', async (req, res) => {
  try {
    const level = parseInt(req.params.level);
    const options = {
      type: req.query.type as AccountType | undefined,
      businessOnly: req.query.businessOnly === 'true',
      personalOnly: req.query.personalOnly === 'true',
    };
    const categories = await categoryService.getCategoriesByLevel(level, options);
    res.json(categories);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.get('/api/categories/search', async (req, res) => {
  try {
    const searchTerm = req.query.q as string;
    if (!searchTerm) {
      return sendError(res, 400, 'Search term required (q parameter)');
    }
    const options = {
      type: req.query.type as AccountType | undefined,
      businessOnly: req.query.businessOnly === 'true',
      personalOnly: req.query.personalOnly === 'true',
      leafOnly: req.query.leafOnly === 'true',
    };
    const results = await categoryService.searchCategories(searchTerm, options);
    res.json(results);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.get('/api/categories/:id/context', async (req, res) => {
  try {
    const context = await categoryService.getCategoryWithContext(req.params.id);
    res.json(context);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.post('/api/categories/create', async (req, res) => {
  try {
    const data = validateBody(createCategorySchema, req.body, res);
    if (!data) return;

    const category = await categoryService.createCategory({
      name: data.name,
      type: data.type as AccountType,
      parentId: data.parentId,
      isBusinessDefault: data.isBusinessDefault,
    });
    res.status(201).json(category);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('already exists') || message.includes('duplicate')) {
      return sendConflict(res, message);
    }
    return sendError(res, 400, message);
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    console.log('PUT /api/categories/:id - Request body:', req.body);
    console.log('PUT /api/categories/:id - Params:', req.params);

    const data = validateBody(updateCategorySchema, req.body, res);
    if (!data) return;

    console.log('PUT /api/categories/:id - Validated data:', data);

    const category = await categoryService.updateCategory(req.params.id, data);
    console.log('PUT /api/categories/:id - Success:', category);
    res.json(category);
  } catch (error) {
    console.error('PUT /api/categories/:id - Error:', error);
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return sendNotFound(res, 'Category');
    }
    return sendError(res, 400, message);
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    await categoryService.deleteCategory(req.params.id);
    res.status(204).send();
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return sendNotFound(res, 'Category');
    }
    return sendError(res, 400, message);
  }
});

app.post('/api/categories/:id/archive', async (req, res) => {
  try {
    const category = await categoryService.archiveCategory(req.params.id);
    res.json(category);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return sendNotFound(res, 'Category');
    }
    return sendError(res, 400, message);
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
    return sendServerError(res, error);
  }
});

app.get('/api/transactions/:id', async (req, res) => {
  try {
    const transaction = await transactionService.getTransactionById(req.params.id);
    if (!transaction) {
      return sendNotFound(res, 'Transaction');
    }
    res.json(transaction);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const data = validateBody(createTransactionSchema, req.body, res);
    if (!data) return;

    const transaction = await transactionService.createTransaction(data);
    res.status(201).json(transaction);
  } catch (error) {
    const message = (error as Error).message;
    // Double-entry or GST validation errors
    if (message.includes('must sum to zero') || message.includes('GST')) {
      return sendError(res, 422, message, { code: 'VALIDATION_ERROR' });
    }
    return sendError(res, 400, message);
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const data = validateBody(updateTransactionSchema.omit({ id: true }), req.body, res);
    if (!data) return;

    const transaction = await transactionService.updateTransaction({
      id: req.params.id,
      ...data
    });
    res.json(transaction);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return sendNotFound(res, 'Transaction');
    }
    if (message.includes('must sum to zero') || message.includes('GST')) {
      return sendError(res, 422, message, { code: 'VALIDATION_ERROR' });
    }
    return sendError(res, 400, message);
  }
});

app.post('/api/transactions/bulk-add-tags', async (req, res) => {
  try {
    const data = validateBody(bulkAddTagsSchema, req.body, res);
    if (!data) return;

    const { transactionIds, tags } = data;
    await transactionService.bulkAddTags(transactionIds, tags);
    res.status(204).send();
  } catch (error) {
    return sendError(res, 400, (error as Error).message);
  }
});

app.post('/api/transactions/mark-cleared', async (req, res) => {
  try {
    const data = validateBody(markClearedSchema, req.body, res);
    if (!data) return;

    await transactionService.markCleared(data.postingIds, data.cleared);
    res.status(204).send();
  } catch (error) {
    return sendError(res, 400, (error as Error).message);
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    await transactionService.deleteTransaction(req.params.id);
    res.status(204).send();
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return sendNotFound(res, 'Transaction');
    }
    return sendError(res, 400, message);
  }
});

// ============================================================================
// REPORT ENDPOINTS
// ============================================================================

app.get('/api/reports/profit-loss', async (req, res) => {
  try {
    // Validate required date parameters
    const queryData = validateQuery(profitLossQuerySchema, req.query, res);
    if (!queryData) return;

    const startDate = new Date(queryData.startDate);
    const endDate = new Date(queryData.endDate);
    const businessOnly = queryData.businessOnly === 'true';
    const gstInclusive = queryData.gstInclusive === 'true';

    const report = await reportService.generateProfitAndLoss(startDate, endDate, {
      businessOnly,
      gstInclusive,
    });
    res.json(report);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.get('/api/reports/gst-summary', async (req, res) => {
  try {
    // Validate required date parameters
    const queryData = validateQuery(reportDateRangeSchema, req.query, res);
    if (!queryData) return;

    const startDate = new Date(queryData.startDate);
    const endDate = new Date(queryData.endDate);

    const report = await reportService.generateGSTSummary(startDate, endDate);
    res.json(report);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.get('/api/reports/bas-draft', async (req, res) => {
  try {
    // Validate required date parameters
    const queryData = validateQuery(reportDateRangeSchema, req.query, res);
    if (!queryData) return;

    const startDate = new Date(queryData.startDate);
    const endDate = new Date(queryData.endDate);

    const report = await reportService.generateBASDraft(startDate, endDate);
    res.json(report);
  } catch (error) {
    return sendServerError(res, error);
  }
});

// ============================================================================
// IMPORT ENDPOINTS
// ============================================================================

app.post('/api/import/preview', async (req, res) => {
  try {
    const data = validateBody(importPreviewSchema, req.body, res);
    if (!data) return;

    const { csvText, mapping, sourceAccountId } = data;
    const rows = importService.parseCSV(csvText);
    const preview = await importService.previewImport(rows, mapping, sourceAccountId);
    res.json(preview);
  } catch (error) {
    return sendError(res, 400, (error as Error).message);
  }
});

app.post('/api/import/execute', async (req, res) => {
  try {
    const data = validateBody(importExecuteSchema, req.body, res);
    if (!data) return;

    const { previews, sourceAccountId, sourceName, mapping, options } = data;
    const result = await importService.importTransactions(previews, sourceAccountId, sourceName, mapping, options);
    res.status(201).json(result);
  } catch (error) {
    return sendError(res, 400, (error as Error).message);
  }
});

app.post('/api/import/mappings', async (req, res) => {
  try {
    const { name, mapping, accountId } = req.body;
    const savedMapping = await importService.saveImportMappingTemplate(name, mapping, accountId);
    res.status(201).json(savedMapping);
  } catch (error) {
    return sendError(res, 400, (error as Error).message);
  }
});

app.get('/api/import/mappings', async (req, res) => {
  try {
    const accountId = req.query.accountId as string | undefined;
    const mappings = await importService.getImportMappingTemplates(accountId);
    res.json(mappings);
  } catch (error) {
    return sendServerError(res, error);
  }
});

// ============================================================================
// RECONCILIATION ENDPOINTS
// ============================================================================

app.post('/api/reconciliation/start', async (req, res) => {
  try {
    const data = validateBody(startReconciliationSchema, req.body, res);
    if (!data) return;

    const reconciliation = await reconciliationService.createReconciliation({
      accountId: data.accountId,
      statementStartDate: new Date(data.statementStartDate),
      statementEndDate: new Date(data.statementEndDate),
      statementStartBalance: data.statementStartBalance,
      statementEndBalance: data.statementEndBalance,
      notes: data.notes,
    });
    res.status(201).json(reconciliation);
  } catch (error) {
    return sendError(res, 400, (error as Error).message);
  }
});

// Get in-progress (unlocked) reconciliation for an account
app.get('/api/reconciliation/in-progress/:accountId', async (req, res) => {
  try {
    const reconciliations = await reconciliationService.getReconciliations(req.params.accountId);
    // Find the most recent unlocked reconciliation
    const inProgress = reconciliations.find(r => !r.locked);
    res.json(inProgress || null);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.post('/api/reconciliation/:id/reconcile-postings', async (req, res) => {
  try {
    const data = validateBody(reconcilePostingsSchema, req.body, res);
    if (!data) return;

    await reconciliationService.reconcilePostings(req.params.id, data.postingIds);
    res.status(204).send();
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return sendNotFound(res, 'Reconciliation');
    }
    return sendError(res, 400, message);
  }
});

app.post('/api/reconciliation/:id/unreconcile-postings', async (req, res) => {
  try {
    const data = validateBody(reconcilePostingsSchema, req.body, res);
    if (!data) return;

    await reconciliationService.unreconcilePostings(req.params.id, data.postingIds);
    res.status(204).send();
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return sendNotFound(res, 'Reconciliation');
    }
    return sendError(res, 400, message);
  }
});

app.post('/api/reconciliation/:id/lock', async (req, res) => {
  try {
    const reconciliation = await reconciliationService.lockReconciliation(req.params.id);
    res.json(reconciliation);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return sendNotFound(res, 'Reconciliation');
    }
    return sendError(res, 400, message);
  }
});

app.get('/api/reconciliation/:id/status', async (req, res) => {
  try {
    const status = await reconciliationService.getReconciliationStatus(req.params.id);
    res.json(status);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.get('/api/reconciliation/:id', async (req, res) => {
  try {
    const reconciliation = await reconciliationService.getReconciliationById(req.params.id);
    if (!reconciliation) {
      return sendNotFound(res, 'Reconciliation');
    }
    res.json(reconciliation);
  } catch (error) {
    return sendServerError(res, error);
  }
});

// Parse PDF bank statement
app.post('/api/reconciliation/parse-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No PDF file uploaded');
    }

    const result = await pdfStatementService.parseStatement(req.file.buffer);
    res.json(result);
  } catch (error) {
    return sendError(res, 400, (error as Error).message);
  }
});

// Match statement transactions with ledger transactions
app.post('/api/reconciliation/:id/match-transactions', async (req, res) => {
  try {
    const { statementTransactions } = req.body;

    if (!statementTransactions || !Array.isArray(statementTransactions)) {
      return sendError(res, 400, 'statementTransactions array is required');
    }

    // Get reconciliation to find account and date range
    const reconciliation = await reconciliationService.getReconciliationById(req.params.id);
    if (!reconciliation) {
      return sendNotFound(res, 'Reconciliation');
    }

    // Match transactions
    const preview = await reconciliationMatchingService.matchTransactions(
      reconciliation.accountId,
      statementTransactions,
      reconciliation.statementStartDate,
      reconciliation.statementEndDate
    );

    res.json(preview);
  } catch (error) {
    return sendError(res, 400, (error as Error).message);
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
    return sendServerError(res, error);
  }
});

app.post('/api/rules', async (req, res) => {
  try {
    const data = validateBody(createRuleSchema, req.body, res);
    if (!data) return;

    const rule = await memorizedRuleService.createRule(data);
    res.status(201).json(rule);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('already exists')) {
      return sendConflict(res, message);
    }
    return sendError(res, 400, message);
  }
});

app.post('/api/rules/match', async (req, res) => {
  try {
    const { payee, memo } = req.body;
    if (!payee && !memo) {
      return sendError(res, 400, 'Either payee or memo is required');
    }
    const match = await memorizedRuleService.findMatchingRule(payee, memo);
    res.json(match || null);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.put('/api/rules/:id', async (req, res) => {
  try {
    const data = validateBody(updateRuleSchema, req.body, res);
    if (!data) return;

    const rule = await memorizedRuleService.updateRule(req.params.id, data);
    res.json(rule);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return sendNotFound(res, 'Rule');
    }
    return sendError(res, 400, message);
  }
});

app.delete('/api/rules/:id', async (req, res) => {
  try {
    await memorizedRuleService.deleteRule(req.params.id);
    res.status(204).send();
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return sendNotFound(res, 'Rule');
    }
    return sendError(res, 400, message);
  }
});

app.put('/api/rules/reorder', async (req, res) => {
  try {
    const data = validateBody(reorderRulesSchema, req.body, res);
    if (!data) return;

    await memorizedRuleService.reorderRules(data.ruleIds);
    res.status(204).send();
  } catch (error) {
    return sendError(res, 400, (error as Error).message);
  }
});

app.get('/api/rules/:id/preview', async (req, res) => {
  try {
    const result = await memorizedRuleService.previewRuleApplication(req.params.id);
    res.json(result);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('not found')) {
      return sendNotFound(res, 'Rule');
    }
    return sendError(res, 400, message);
  }
});

app.post('/api/rules/:id/apply-to-existing', async (req, res) => {
  try {
    const transactionIds = req.body?.transactionIds as string[] | undefined;
    const result = await memorizedRuleService.applyRuleToExisting(req.params.id, transactionIds);
    res.json(result);
  } catch (error) {
    sendServerError(res, error);
  }
});

// ============================================================================
// BACKUP ENDPOINTS
// ============================================================================

app.post('/api/backup/create', async (req, res) => {
  try {
    const data = validateBody(createBackupSchema, req.body || {}, res);
    if (!data) return;

    const backup = await backupService.createBackup(data.type);
    res.status(201).json(backup);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.get('/api/backup/list', async (req, res) => {
  try {
    const backups = backupService.listBackups();
    res.json(backups);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.post('/api/backup/restore', async (req, res) => {
  try {
    const data = validateBody(restoreBackupSchema, req.body, res);
    if (!data) return;

    await backupService.restoreBackup(data.filename);
    res.json({ success: true, message: 'Backup restored successfully' });
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('not found') || message.includes('does not exist')) {
      return sendNotFound(res, 'Backup');
    }
    return sendServerError(res, error);
  }
});

app.delete('/api/backup/:filename', async (req, res) => {
  try {
    if (!req.params.filename) {
      return sendError(res, 400, 'Filename is required');
    }
    backupService.deleteBackup(req.params.filename);
    res.status(204).send();
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('not found') || message.includes('does not exist')) {
      return sendNotFound(res, 'Backup');
    }
    return sendServerError(res, error);
  }
});

app.post('/api/backup/clean', async (req, res) => {
  try {
    const data = validateBody(cleanBackupsSchema, req.body || {}, res);
    if (!data) return;

    const deletedCount = backupService.cleanOldBackups(data.keepCount);
    res.json({ deletedCount });
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.get('/api/backup/export-json', async (req, res) => {
  try {
    const json = await backupService.exportToJSON();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ledgerhound-export-${new Date().toISOString().split('T')[0]}.json"`);
    res.send(json);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.get('/api/backup/stats', async (req, res) => {
  try {
    const stats = await backupService.getStats();
    res.json(stats);
  } catch (error) {
    return sendServerError(res, error);
  }
});

// ============================================================================
// STRIPE IMPORT ENDPOINTS
// ============================================================================

app.get('/api/stripe/settings', async (req, res) => {
  try {
    // Use public method that masks the API key
    const settings = await settingsService.getStripeSettingsPublic();
    res.json(settings);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.post('/api/stripe/settings', async (req, res) => {
  try {
    const { apiKey, accountId, payoutDestinationAccountId } = req.body;

    // Get existing settings to allow partial updates
    const existingSettings = await settingsService.getStripeSettings();

    // Validate required fields (use existing values if not provided)
    const finalApiKey = apiKey || existingSettings?.apiKey;
    const finalAccountId = accountId || existingSettings?.accountId;

    if (!finalApiKey || !finalAccountId) {
      return sendError(res, 400, 'Missing required fields: apiKey and accountId');
    }

    // Allow partial update: if payoutDestinationAccountId is explicitly provided (even as empty string),
    // use it; otherwise preserve existing value
    const finalPayoutDestination = payoutDestinationAccountId !== undefined
      ? payoutDestinationAccountId
      : existingSettings?.payoutDestinationAccountId;

    await settingsService.saveStripeSettings(
      finalApiKey,
      finalAccountId,
      finalPayoutDestination
    );

    res.json({ success: true, settings: await settingsService.getStripeSettingsPublic() });
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.delete('/api/stripe/settings', async (req, res) => {
  try {
    await settingsService.deleteStripeSettings();
    res.json({ success: true });
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.post('/api/stripe/test', async (req, res) => {
  try {
    const { apiKey, accountId } = req.body;

    if (!apiKey) {
      return sendError(res, 400, 'API key required');
    }

    // Use a temporary account ID for testing if not provided
    await stripeImportService.initialize({
      apiKey,
      accountId: accountId || 'temp-test-account-id',
    });

    const result = await stripeImportService.testConnection();
    res.json(result);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.post('/api/stripe/import', async (req, res) => {
  try {
    // Get stored settings
    const settings = await settingsService.getStripeSettings();
    if (!settings) {
      return sendError(res, 400, 'Stripe not configured');
    }

    // Initialize Stripe service
    await stripeImportService.initialize(settings);

    // Parse date options
    const { startDate, endDate, limit } = req.body;
    const options = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    };

    // Import transactions
    const result = await stripeImportService.importTransactions(options);
    res.json(result);
  } catch (error) {
    return sendServerError(res, error);
  }
});

app.get('/api/stripe/balance', async (req, res) => {
  try {
    const settings = await settingsService.getStripeSettings();
    if (!settings) {
      return sendError(res, 400, 'Stripe not configured');
    }

    await stripeImportService.initialize(settings);
    const balance = await stripeImportService.getBalance();
    res.json(balance);
  } catch (error) {
    return sendServerError(res, error);
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
