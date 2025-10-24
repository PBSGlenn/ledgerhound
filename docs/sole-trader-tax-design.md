# Sole Trader Tax & BAS System - Pet Behaviour Services

## Your Business Structure

### Accounts
1. **Business Transaction Account** (Asset/TRANSFER)
   - Stripe deposits come here
   - Business debit card payments from here

2. **Personal Savings Account** (Asset/TRANSFER)
   - Regular transfers from business account
   - Pays credit card

3. **Personal Credit Card** (Liability/TRANSFER)
   - Most personal expenses
   - Paid from savings account

### Transaction Flows
```
Client → Stripe → Business Transaction Account → Business Debit Card → Business Expenses
                                                ↓
                                         Drawings (Transfer)
                                                ↓
                                    Personal Savings Account → Credit Card → Personal Expenses
```

## Tax Obligations

### 1. Quarterly BAS (Business Activity Statement)
**Due Dates**: 28 days after quarter end
- Q1 (Jul-Sep): Due 28 Oct
- Q2 (Oct-Dec): Due 28 Feb
- Q3 (Jan-Mar): Due 28 Apr
- Q4 (Apr-Jun): Due 28 Jul

**What You Report**:
- **G1**: Total Sales (GST-inclusive)
- **G2**: Export Sales (GST-free)
- **G3**: Other GST-free Sales
- **G10**: Capital Purchases
- **G11**: Non-capital Purchases
- **1A**: GST on Sales (divide G1 by 11)
- **1B**: GST on Purchases (divide G10+G11 by 11)
- **7**: GST Payable (1A minus 1B) or Refundable

### 2. Annual Income Tax Return (Individual)
**Due Date**: 31 October (if self-lodging)

**What You Report**:
- **Business Income** (Item 13 - Business Income)
  - Stripe payments received

- **Business Expenses** (Total at Item 13)
  - All business category expenses
  - Depreciation

- **Net Business Income** = Business Income - Business Expenses
  - This flows to your assessable income

- **Personal Deductions** (Items D1-D15)
  - Work-related expenses (if any)
  - Donations

- **Taxable Income** = Net Business Income - Personal Deductions
- **Tax Payable** = Calculated on tax brackets
- **Medicare Levy** = 2% of taxable income

## Database Schema Extensions

```prisma
// Add to existing schema.prisma

model TaxYear {
  id                String   @id @default(cuid())
  financialYear     String   @unique // "2024-25"
  startDate         DateTime // 2024-07-01
  endDate           DateTime // 2025-06-30
  taxFreeThreshold  Float    @default(18200)
  medicareLevyRate  Float    @default(0.02)
  isActive          Boolean  @default(true)

  taxBrackets       TaxBracket[]
  taxCategories     TaxCategory[]
  basReturns        BASReturn[]
  incomeTaxReturns  IncomeTaxReturn[]

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@map("tax_years")
}

model TaxBracket {
  id                String   @id @default(cuid())
  taxYearId         String
  taxYear           TaxYear  @relation(fields: [taxYearId], references: [id], onDelete: Cascade)

  minIncome         Float
  maxIncome         Float?   // null = no upper limit
  baseAmount        Float
  marginalRate      Float
  sortOrder         Int

  @@index([taxYearId])
  @@map("tax_brackets")
}

model TaxCategory {
  id                String   @id @default(cuid())
  taxYearId         String
  taxYear           TaxYear  @relation(fields: [taxYearId], references: [id], onDelete: Cascade)

  code              String   // "13-A", "D10", etc.
  label             String   // "Business income - Pet services"
  description       String?
  categoryType      String   // "BUSINESS_INCOME", "BUSINESS_EXPENSE", "PERSONAL_DEDUCTION"
  sortOrder         Int
  isActive          Boolean  @default(true)

  accountMappings   AccountTaxMapping[]

  @@unique([taxYearId, code])
  @@index([taxYearId, categoryType])
  @@map("tax_categories")
}

// Maps your account categories to tax categories
model AccountTaxMapping {
  id                String   @id @default(cuid())

  accountId         String
  account           Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)

  taxCategoryId     String
  taxCategory       TaxCategory @relation(fields: [taxCategoryId], references: [id], onDelete: Cascade)

  percentage        Float    @default(100) // For partial allocations
  notes             String?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([accountId, taxCategoryId])
  @@index([accountId])
  @@map("account_tax_mappings")
}

// BAS Return (Quarterly)
model BASReturn {
  id                String   @id @default(cuid())
  taxYearId         String
  taxYear           TaxYear  @relation(fields: [taxYearId], references: [id])

  quarter           Int      // 1, 2, 3, 4
  startDate         DateTime
  endDate           DateTime
  dueDate           DateTime

  // G fields (Sales)
  g1TotalSales      Float    @default(0) // GST-inclusive sales
  g2ExportSales     Float    @default(0) // GST-free exports
  g3OtherGSTFree    Float    @default(0) // Other GST-free

  // G fields (Purchases)
  g10CapitalPurch   Float    @default(0) // Capital acquisitions
  g11NonCapitalPurch Float   @default(0) // Non-capital acquisitions

  // Calculated fields (1A, 1B)
  gst1aOnSales      Float    @default(0) // G1 ÷ 11
  gst1bOnPurchases  Float    @default(0) // (G10 + G11) ÷ 11

  // Final amount (7)
  gst7Payable       Float    @default(0) // 1A - 1B (negative = refund)

  status            String   @default("DRAFT") // DRAFT, FINALIZED, LODGED
  lodgedDate        DateTime?

  calculatedAt      DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([taxYearId, quarter])
  @@index([taxYearId, quarter])
  @@map("bas_returns")
}

// Income Tax Return (Annual)
model IncomeTaxReturn {
  id                String   @id @default(cuid())
  taxYearId         String
  taxYear           TaxYear  @relation(fields: [taxYearId], references: [id])

  // Business Income (Item 13)
  businessIncome    Float    @default(0)
  businessExpenses  Float    @default(0)
  netBusinessIncome Float    @default(0) // Income - Expenses

  // Personal Deductions (Items D1-D15)
  personalDeductions Float   @default(0)

  // Total Income & Tax
  totalIncome       Float    @default(0)
  totalDeductions   Float    @default(0)
  taxableIncome     Float    @default(0)

  taxPayable        Float    @default(0)
  medicareLevyPayable Float  @default(0)
  totalTaxPayable   Float    @default(0)

  // Breakdown by tax category (JSON)
  incomeBreakdown   Json     // { "13-A": 45000, ... }
  deductionBreakdown Json    // { "D10": 500, "13-EXP-1": 12000, ... }

  status            String   @default("DRAFT") // DRAFT, FINALIZED, LODGED
  lodgedDate        DateTime?

  calculatedAt      DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([taxYearId])
  @@index([taxYearId])
  @@map("income_tax_returns")
}
```

## FY 2024-25 Configuration

### Tax Brackets (2024-25)
```typescript
const taxBrackets2024_25 = [
  { minIncome: 0,      maxIncome: 18200,   baseAmount: 0,     marginalRate: 0.00 },
  { minIncome: 18201,  maxIncome: 45000,   baseAmount: 0,     marginalRate: 0.19 },
  { minIncome: 45001,  maxIncome: 120000,  baseAmount: 5092,  marginalRate: 0.325 },
  { minIncome: 120001, maxIncome: 180000,  baseAmount: 29467, marginalRate: 0.37 },
  { minIncome: 180001, maxIncome: null,    baseAmount: 51667, marginalRate: 0.45 },
];
```

### Tax Categories (Sole Trader)

**Business Income**
- `13-A`: Pet behaviour consultation fees
- `13-B`: Other business income

**Business Expenses** (Item 13 - Business Expenses)
- `13-EXP-MOTOR`: Motor vehicle expenses
- `13-EXP-TRAVEL`: Travel expenses
- `13-EXP-OFFICE`: Office & supplies
- `13-EXP-MARKETING`: Marketing & advertising
- `13-EXP-PROF`: Professional services (accountant, legal)
- `13-EXP-INSURE`: Insurance
- `13-EXP-PHONE`: Phone & internet (business portion)
- `13-EXP-BANK`: Bank fees
- `13-EXP-SUBSCRIPTIONS`: Software & subscriptions
- `13-EXP-OTHER`: Other business expenses
- `13-EXP-DEPREC`: Depreciation

**Personal Deductions**
- `D10`: Gifts & donations
- `D15`: Cost of managing tax affairs

### Suggested Account Mappings

```typescript
const defaultMappings = {
  // Business Income
  "Income/Sales Revenue": "13-A",
  "Income/Service Revenue": "13-A",
  "Income/Consulting Income": "13-A",

  // Business Expenses
  "Expense/Vehicle Expenses/Fuel": "13-EXP-MOTOR",
  "Expense/Vehicle Expenses/Maintenance & Repairs": "13-EXP-MOTOR",
  "Expense/Vehicle Expenses/Registration & Insurance": "13-EXP-MOTOR",

  "Expense/Business Travel/Accommodation": "13-EXP-TRAVEL",
  "Expense/Business Travel/Flights": "13-EXP-TRAVEL",
  "Expense/Business Travel/Meals While Travelling": "13-EXP-TRAVEL",

  "Expense/Office & Supplies": "13-EXP-OFFICE",
  "Expense/Marketing & Advertising": "13-EXP-MARKETING",
  "Expense/Professional Services/Accounting": "13-EXP-PROF",
  "Expense/Professional Services/Legal": "13-EXP-PROF",
  "Expense/Insurance": "13-EXP-INSURE",
  "Expense/Communications/Mobile Phone": "13-EXP-PHONE",
  "Expense/Communications/Internet": "13-EXP-PHONE",
  "Expense/Bank Charges": "13-EXP-BANK",
  "Expense/Subscriptions & Software": "13-EXP-SUBSCRIPTIONS",
  "Expense/Depreciation": "13-EXP-DEPREC",
  "Expense/Other Business Expenses": "13-EXP-OTHER",

  // Personal Deductions
  "Expense/Gifts & Donations": "D10",
};
```

## BAS Calculation Logic

```typescript
class BASCalculationService {
  async calculateBAS(quarter: number, financialYear: string) {
    // Get quarter date range
    const { startDate, endDate } = getQuarterDates(quarter, financialYear);

    // Get all business transactions in quarter with GST
    const businessTransactions = await prisma.posting.findMany({
      where: {
        isBusiness: true,
        transaction: {
          date: { gte: startDate, lte: endDate },
          status: 'NORMAL'
        }
      },
      include: {
        transaction: true,
        account: true
      }
    });

    // Separate income vs expenses
    const income = businessTransactions.filter(p =>
      p.account.type === 'INCOME' && p.amount > 0
    );
    const expenses = businessTransactions.filter(p =>
      p.account.type === 'EXPENSE' && p.amount > 0
    );

    // Calculate G1 (Total sales - GST inclusive)
    const g1TotalSales = income
      .filter(p => p.gstCode === 'GST')
      .reduce((sum, p) => sum + p.amount, 0);

    // Calculate G11 (Non-capital purchases - GST inclusive)
    const g11NonCapital = expenses
      .filter(p => p.gstCode === 'GST')
      .reduce((sum, p) => sum + p.amount, 0);

    // Calculate GST amounts (1/11th of totals)
    const gst1aOnSales = g1TotalSales / 11;
    const gst1bOnPurchases = g11NonCapital / 11;

    // Calculate net GST payable (or refund if negative)
    const gst7Payable = gst1aOnSales - gst1bOnPurchases;

    return {
      quarter,
      startDate,
      endDate,
      g1TotalSales,
      g2ExportSales: 0, // You don't have exports
      g3OtherGSTFree: 0,
      g10CapitalPurch: 0, // Track separately if you buy assets
      g11NonCapitalPurch: g11NonCapital,
      gst1aOnSales,
      gst1bOnPurchases,
      gst7Payable,

      // Detailed breakdown
      salesBreakdown: groupByCategory(income),
      expenseBreakdown: groupByCategory(expenses),
    };
  }
}
```

## Income Tax Calculation Logic

```typescript
class IncomeTaxCalculationService {
  async calculateIncomeTax(financialYear: string) {
    const taxYear = await getTaxYear(financialYear);
    const { startDate, endDate } = taxYear;

    // Get all business income
    const businessIncome = await sumBusinessTransactions({
      dateRange: { startDate, endDate },
      accountType: 'INCOME',
      isBusiness: true
    });

    // Get all business expenses
    const businessExpenses = await sumBusinessTransactions({
      dateRange: { startDate, endDate },
      accountType: 'EXPENSE',
      isBusiness: true
    });

    // Net business income
    const netBusinessIncome = businessIncome - businessExpenses;

    // Get personal deductions (non-business)
    const personalDeductions = await sumPersonalDeductions({
      dateRange: { startDate, endDate }
    });

    // Calculate taxable income
    const taxableIncome = netBusinessIncome - personalDeductions;

    // Calculate tax using brackets
    const taxPayable = calculateTaxFromBrackets(
      taxableIncome,
      taxYear.taxBrackets
    );

    // Calculate medicare levy (2%)
    const medicareLevyPayable = taxableIncome * taxYear.medicareLevyRate;

    // Total tax
    const totalTaxPayable = taxPayable + medicareLevyPayable;

    return {
      businessIncome,
      businessExpenses,
      netBusinessIncome,
      personalDeductions,
      taxableIncome,
      taxPayable,
      medicareLevyPayable,
      totalTaxPayable,

      // Detailed breakdown by tax category
      incomeBreakdown: await getIncomeByTaxCategory(startDate, endDate),
      expenseBreakdown: await getExpensesByTaxCategory(startDate, endDate),
    };
  }

  private calculateTaxFromBrackets(income: number, brackets: TaxBracket[]) {
    let tax = 0;

    for (const bracket of brackets) {
      if (income > bracket.minIncome) {
        const taxableInBracket = bracket.maxIncome
          ? Math.min(income, bracket.maxIncome) - bracket.minIncome + 1
          : income - bracket.minIncome + 1;

        tax = bracket.baseAmount + (taxableInBracket * bracket.marginalRate);
      }
    }

    return tax;
  }
}
```

## Implementation Priority

### Phase 1: BAS (Immediate Need) ✅
1. Create tax schema migration
2. Seed FY 2024-25 data
3. Create BAS calculation service
4. Create BAS report UI (quarters)
5. Export BAS to PDF/CSV

**Goal**: Generate Q1-Q2 BAS for lodgement

### Phase 2: Income Tax (Before Oct 31)
1. Tax category mapping UI
2. Income tax calculation service
3. Full tax return report
4. Export for lodgement

### Phase 3: Automation
1. Auto-suggest mappings based on category names
2. Warning system for unmapped transactions
3. Year-end checklist
4. Historical comparison

## Quick Start: Your First BAS

1. **Ensure all business transactions marked**:
   - All Stripe income = `isBusiness: true`, `gstCode: 'GST'`
   - All business expenses = `isBusiness: true`, `gstCode: 'GST'`

2. **Run BAS calculation**:
   ```typescript
   const q1BAS = await calculateBAS(1, '2024-25'); // Jul-Sep 2024
   const q2BAS = await calculateBAS(2, '2024-25'); // Oct-Dec 2024
   ```

3. **Review & Lodge**:
   - Check totals match your records
   - Export to PDF
   - Lodge via Business Portal

## Next Steps

Should I:
1. **Create the Prisma migration** for tax tables?
2. **Seed the FY 2024-25 data** (tax brackets, categories)?
3. **Build BAS calculation service** first (for immediate need)?
4. **Create BAS report UI**?

Which would be most valuable for your immediate tax return preparation?
