# Tax Reporting System Design

## Overview
Flexible tax reporting system for Australian income tax that handles changing tax laws across financial years.

## Architecture

### 1. Database Schema

```prisma
// Tax configuration per financial year
model TaxYear {
  id                String   @id @default(cuid())
  financialYear     String   @unique // "2024-25", "2025-26"
  startDate         DateTime // 2024-07-01
  endDate           DateTime // 2025-06-30
  taxFreeThreshold  Float    @default(18200)
  medicareLevyRate  Float    @default(0.02)
  isActive          Boolean  @default(false)

  taxBrackets       TaxBracket[]
  taxCategories     TaxCategory[]
  categoryMappings  TaxCategoryMapping[]

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

// Tax brackets for the year
model TaxBracket {
  id                String   @id @default(cuid())
  taxYearId         String
  taxYear           TaxYear  @relation(fields: [taxYearId], references: [id])

  minIncome         Float
  maxIncome         Float?   // null = no upper limit
  baseAmount        Float    // Base tax amount
  marginalRate      Float    // Rate for income above minIncome
  sortOrder         Int

  @@index([taxYearId])
}

// ATO tax return line items
model TaxCategory {
  id                String   @id @default(cuid())
  taxYearId         String
  taxYear           TaxYear  @relation(fields: [taxYearId], references: [id])

  code              String   // "D1", "D2", "P7", etc.
  label             String   // "Work-related deductions"
  description       String?  // Detailed help text
  category          String   // "INCOME", "DEDUCTION", "OFFSET"
  section           String   // "Individual", "Business", "Investment"
  sortOrder         Int
  isActive          Boolean  @default(true)

  mappings          TaxCategoryMapping[]

  @@unique([taxYearId, code])
  @@index([taxYearId, category])
}

// Maps user's account categories to tax categories
model TaxCategoryMapping {
  id                String   @id @default(cuid())
  taxYearId         String
  taxYear           TaxYear  @relation(fields: [taxYearId], references: [id])

  accountId         String   // User's expense/income category
  account           Account  @relation(fields: [accountId], references: [id])

  taxCategoryId     String
  taxCategory       TaxCategory @relation(fields: [taxCategoryId], references: [id])

  percentage        Float    @default(100) // Allow partial mapping (e.g., 50% personal, 50% business)
  notes             String?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([taxYearId, accountId, taxCategoryId])
  @@index([taxYearId, accountId])
}

// Tax calculation results (cached)
model TaxReturn {
  id                String   @id @default(cuid())
  taxYearId         String
  taxYear           TaxYear  @relation(fields: [taxYearId], references: [id])

  totalIncome       Float
  totalDeductions   Float
  taxableIncome     Float
  taxPayable        Float
  medicareLevy      Float
  totalTax          Float

  calculatedAt      DateTime @default(now())
  lineItems         Json     // Detailed breakdown

  @@index([taxYearId])
}
```

### 2. Tax Year Configuration

#### Pre-configured Tax Years (Seeded Data)

**FY 2024-25** (Current)
```typescript
{
  financialYear: "2024-25",
  startDate: "2024-07-01",
  endDate: "2025-06-30",
  taxFreeThreshold: 18200,
  medicareLevyRate: 0.02,

  taxBrackets: [
    { min: 0,      max: 18200,   baseAmount: 0,     marginalRate: 0 },
    { min: 18201,  max: 45000,   baseAmount: 0,     marginalRate: 0.19 },
    { min: 45001,  max: 120000,  baseAmount: 5092,  marginalRate: 0.325 },
    { min: 120001, max: 180000,  baseAmount: 29467, marginalRate: 0.37 },
    { min: 180001, max: null,    baseAmount: 51667, marginalRate: 0.45 }
  ],

  taxCategories: [
    // Income
    { code: "1",   label: "Salary, wages, allowances", category: "INCOME", section: "Individual" },
    { code: "2",   label: "Employer lump sum payments", category: "INCOME", section: "Individual" },
    { code: "P7",  label: "Business income", category: "INCOME", section: "Business" },
    { code: "11",  label: "Australian interest", category: "INCOME", section: "Investment" },
    { code: "12",  label: "Australian dividends", category: "INCOME", section: "Investment" },

    // Deductions
    { code: "D1",  label: "Work-related car expenses", category: "DEDUCTION", section: "Individual" },
    { code: "D2",  label: "Work-related travel expenses", category: "DEDUCTION", section: "Individual" },
    { code: "D3",  label: "Work-related clothing expenses", category: "DEDUCTION", section: "Individual" },
    { code: "D4",  label: "Work-related self-education", category: "DEDUCTION", section: "Individual" },
    { code: "D5",  label: "Other work-related expenses", category: "DEDUCTION", section: "Individual" },
    { code: "D10", label: "Gifts and donations", category: "DEDUCTION", section: "Individual" },

    // Business Deductions
    { code: "P8",  label: "Cost of sales", category: "DEDUCTION", section: "Business" },
    { code: "P9",  label: "Contractor, sub-contractor expenses", category: "DEDUCTION", section: "Business" },
    { code: "P10", label: "Superannuation", category: "DEDUCTION", section: "Business" },
    { code: "P11", label: "Bad debts", category: "DEDUCTION", section: "Business" },
    { code: "P12", label: "Lease expenses", category: "DEDUCTION", section: "Business" },
    { code: "P13", label: "Interest expenses", category: "DEDUCTION", section: "Business" },
    { code: "P14", label: "Motor vehicle expenses", category: "DEDUCTION", section: "Business" },
    { code: "P15", label: "Repairs and maintenance", category: "DEDUCTION", section: "Business" },
    { code: "P16", label: "Other business expenses", category: "DEDUCTION", section: "Business" },
  ]
}
```

**FY 2025-26** (Stage 3 Tax Cuts)
```typescript
{
  financialYear: "2025-26",
  startDate: "2025-07-01",
  endDate: "2026-06-30",
  taxFreeThreshold: 18200,
  medicareLevyRate: 0.02,

  taxBrackets: [
    { min: 0,      max: 18200,   baseAmount: 0,     marginalRate: 0 },
    { min: 18201,  max: 45000,   baseAmount: 0,     marginalRate: 0.16 },  // CHANGED
    { min: 45001,  max: 135000,  baseAmount: 4288,  marginalRate: 0.30 },  // CHANGED
    { min: 135001, max: 190000,  baseAmount: 31288, marginalRate: 0.37 },  // CHANGED
    { min: 190001, max: null,    baseAmount: 51638, marginalRate: 0.45 }
  ],

  // Tax categories mostly same, but can have updates
}
```

### 3. Default Category Mappings (Suggested)

When user creates accounts, suggest mappings:

```typescript
const suggestedMappings = {
  // Personal Income
  "Income/Employment": "1",  // Salary, wages
  "Income/Investment Income": "11", // Interest

  // Personal Deductions
  "Expense/Gifts & Donations": "D10",
  "Expense/Education": "D4",

  // Business Income
  "Income/Sales Revenue": "P7",
  "Income/Service Revenue": "P7",
  "Income/Consulting Income": "P7",

  // Business Deductions
  "Expense/Office & Supplies": "P16",
  "Expense/Professional Services/Accounting": "P16",
  "Expense/Marketing & Advertising": "P16",
  "Expense/Vehicle Expenses": "P14",
  "Expense/Rent & Utilities": "P16",
  "Expense/Cost of Goods Sold": "P8",
  "Expense/Staff Costs/Wages": "P10",
  "Expense/Staff Costs/Superannuation": "P10",
  "Expense/Bank Charges/Interest": "P13",
  "Expense/Depreciation": "P16",
};
```

### 4. Tax Report Generation Workflow

#### Step 1: User Confirms Transactions
- All transactions for FY entered and categorized
- Reconciliation complete

#### Step 2: Review Tax Mappings
UI shows:
```
Category                           Tax Code   Amount      Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INCOME
Employment                         1          $75,000     ✓ Mapped
Investment Income (unmapped)       -          $500        ⚠ Needs mapping

DEDUCTIONS
Office & Supplies                  P16        $2,340      ✓ Mapped
Vehicle Expenses                   P14        $5,200      ✓ Mapped
Uncategorized                      -          $150        ⚠ Needs mapping
```

User can:
- Add/edit mappings
- Split a category across multiple tax codes
- Mark amounts as non-deductible

#### Step 3: Generate Tax Return Summary

Calculate:
1. **Total Income** by tax code
2. **Total Deductions** by tax code
3. **Taxable Income** = Total Income - Total Deductions
4. **Tax Payable** using bracket calculation
5. **Medicare Levy** = Taxable Income × 2%
6. **Total Tax** = Tax Payable + Medicare Levy

#### Step 4: Export Options
- PDF report (summary for accountant)
- CSV for import to tax software
- MyGov integration (future)

### 5. Handling Tax Law Changes

#### Option A: Version-Controlled Seed Files
```
prisma/tax-years/
  ├── 2024-25.ts
  ├── 2025-26.ts
  └── 2026-27.ts
```

Each year = separate seed file with all rules.

#### Option B: Migration-Based Updates
```sql
-- Migration: Update FY 2025-26 tax brackets
UPDATE TaxBracket SET marginalRate = 0.16
WHERE taxYearId = 'fy-2025-26' AND minIncome = 18201;
```

#### Option C: Admin UI (Future)
- Allow user to update tax rules
- Import ATO updates from JSON
- Preview changes before applying

**Recommendation**: Start with Option A (seed files), migrate to Option C later.

### 6. Key Design Principles

1. **Immutable Tax Years**: Once FY ends, lock that year's rules
2. **User Control**: User reviews/approves all mappings
3. **Audit Trail**: Log all tax calculations
4. **Flexibility**: Support edge cases (foreign income, capital gains, etc.)
5. **Professional Review**: Always recommend accountant review

### 7. Implementation Phases

**Phase 1: Foundation** (MVP)
- TaxYear, TaxBracket, TaxCategory models
- Seed FY 2024-25 data
- Basic tax calculation engine
- Simple text report

**Phase 2: Mapping UI**
- Category → Tax Code mapping interface
- Unmapped transaction warnings
- Split allocations

**Phase 3: Full Tax Return**
- Complete ATO form sections
- PDF export styled as tax return
- Support for offsets, HELP debt, etc.

**Phase 4: Advanced**
- Capital gains tax
- Investment property schedules
- MyGov integration
- Multi-year comparisons

### 8. Example Tax Calculation Service

```typescript
class TaxCalculationService {
  async generateTaxReturn(financialYear: string): Promise<TaxReturnSummary> {
    // 1. Get tax year config
    const taxYear = await getTaxYear(financialYear);

    // 2. Get all transactions in FY date range
    const transactions = await getTransactionsInDateRange(
      taxYear.startDate,
      taxYear.endDate
    );

    // 3. Group by tax category via mappings
    const incomeByTaxCode = await sumByTaxCategory(transactions, 'INCOME');
    const deductionsByTaxCode = await sumByTaxCategory(transactions, 'DEDUCTION');

    // 4. Calculate taxable income
    const totalIncome = sum(incomeByTaxCode.values());
    const totalDeductions = sum(deductionsByTaxCode.values());
    const taxableIncome = totalIncome - totalDeductions;

    // 5. Calculate tax using brackets
    const taxPayable = calculateTax(taxableIncome, taxYear.taxBrackets);
    const medicareLevy = taxableIncome * taxYear.medicareLevyRate;

    // 6. Return summary
    return {
      financialYear,
      incomeByTaxCode,
      deductionsByTaxCode,
      totalIncome,
      totalDeductions,
      taxableIncome,
      taxPayable,
      medicareLevy,
      totalTax: taxPayable + medicareLevy,
      unmappedCategories: findUnmappedCategories(transactions)
    };
  }
}
```

## Next Steps

1. Review this design - does it match your vision?
2. Decide on scope for MVP (Phase 1 only?)
3. Create Prisma schema additions
4. Seed initial tax year data (2024-25)
5. Build tax calculation service
6. Create tax mapping UI

## Questions to Consider

1. Do you file as individual, sole trader, or company?
2. Do you need business activity statements (BAS)?
3. Should we support multiple entities (personal + business)?
4. How important is historical data (prior years)?
5. Do you want quarterly estimates or just end-of-year?
