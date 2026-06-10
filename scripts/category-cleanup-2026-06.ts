/**
 * One-off category cleanup for the live book DB, per finance's category audit
 * (Category Audit 2026-06-10.md) and meeting-room thread a6d0e03c:
 *
 *   1. Repair broken hierarchy metadata (fullPath/level/sortOrder)
 *   2. Promote "Yuko's Business" to top-level "Yuko Business" (flat)
 *   3. Clear stray isBusiness flags on the two Web Central bank postings
 *   4. Delete ~26 unused template categories (all $0 lifetime, Glenn-approved)
 *   5. Create Bank Fees children: Credit Card Interest / Account Fees / Penalty Fees
 *
 * Usage: npx tsx scripts/category-cleanup-2026-06.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';
import { CategoryService } from '../src/lib/services/categoryService';
import { copyFileSync, existsSync } from 'fs';

const DB_DIR = 'C:/Users/grubb/OneDrive/Pet Behaviour Services/Management/Dev/Ledgerhound/prisma/books/book_1770973815778_ncl6o9xkt';
const DB_FILE = `${DB_DIR}/ledger.db`;
const DRY_RUN = process.argv.includes('--dry-run');

const prisma = new PrismaClient({ datasourceUrl: `file:${DB_FILE}` });
const categoryService = new CategoryService(prisma);

/** Resolve a category by id prefix, asserting the name matches what we expect. */
async function byPrefix(prefix: string, expectedName: string) {
  const matches = await prisma.account.findMany({
    where: { id: { startsWith: prefix }, kind: 'CATEGORY' },
    select: { id: true, name: true, _count: { select: { postings: true, children: true } } },
  });
  if (matches.length !== 1) {
    throw new Error(`Prefix ${prefix} matched ${matches.length} categories (expected 1: ${expectedName})`);
  }
  if (matches[0].name !== expectedName) {
    throw new Error(`Prefix ${prefix} resolved to "${matches[0].name}", expected "${expectedName}" — aborting`);
  }
  return matches[0];
}

// Audit §5 delete list, children before parents
const DELETE_LIST: Array<[string, string]> = [
  // Income
  ['992b229b', 'Bonuses'],
  ['df5a3bcb', 'Overtime'],
  ['d62a0505', 'Gifts Received'],
  ['2960891d', 'Refunds'],
  ['f3639f19', 'Consulting Fees'],
  ['d3230ce1', 'Product Sales'],
  ['d2371b73', 'Service Revenue'],
  ['6ff0513e', 'Sales'],
  // Business expenses
  ['05c03ef3', 'Direct Labor'],
  ['49bbbe23', 'Materials'],
  ['d28f70b0', 'Shipping & Freight'],
  ['4392c0df', 'Cost of Goods Sold'],
  ['85340bb3', 'Rent'],
  ['a7657774', 'Utilities'],
  ['20ff5074', 'Digital Marketing'],
  ['17526f95', 'Accounting'],
  ['ac985349', 'Legal'],
  ['40cf719b', 'Accommodation'],
  ['f66a31e9', 'Business Meals'],
  ['5d1556c4', 'Business Travel'],
  ['e7932fb2', 'Travel & Entertainment'],
  ['0f3172b3', 'Merchant Fees'],
  ['e7bb3f96', 'Superannuation — Employees'],
  // Personal expenses
  ['fb3d86e4', 'Car Rental'],
  ['9e9559da', 'Accomodation'], // the typo category — unused, deleting per audit §5
  ['60da0c95', 'Rent/Mortgage'],
  ['4fb657e6', 'Vehicle Maintenance'],
  ['194635c8', 'Hobbies'],
];

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}\n`);

  await prisma.$queryRawUnsafe('PRAGMA busy_timeout=10000');

  // ── 0. Backup ──
  if (!DRY_RUN) {
    const stamp = '2026-06-10-category-cleanup';
    const backup = `${DB_DIR}/ledger.db.bak-${stamp}`;
    if (existsSync(backup)) {
      throw new Error(`Backup ${backup} already exists — has this script already run?`);
    }
    // Checkpoint WAL into the main file so the copy is complete
    await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)');
    copyFileSync(DB_FILE, backup);
    console.log(`Backup written: ${backup}`);
  }

  // ── 1. Repair hierarchy metadata ──
  if (DRY_RUN) {
    console.log('[dry-run] would run repairHierarchy()');
  } else {
    const repair = await categoryService.repairHierarchy();
    console.log(`Hierarchy repaired: ${repair.pathsRepaired} paths, ${repair.sortOrdersRepaired} sortOrders`);
  }

  // ── 2. Yuko's Business → top-level "Yuko Business" ──
  const yuko = await byPrefix('3bf7f7d1', "Yuko's Business");
  if (DRY_RUN) {
    console.log(`[dry-run] would rename+move ${yuko.id} to top-level "Yuko Business"`);
  } else {
    const moved = await categoryService.updateCategory(yuko.id, {
      name: 'Yuko Business',
      parentId: null,
    });
    console.log(`Yuko promoted: ${moved.fullPath} (level ${moved.level})`);
  }

  // ── 3. Clear stray isBusiness on the two Web Central bank postings ──
  for (const txnPrefix of ['9b866845', '080438e2']) {
    const txns = await prisma.transaction.findMany({
      where: { id: { startsWith: txnPrefix } },
      include: { postings: true },
    });
    if (txns.length !== 1) throw new Error(`Txn prefix ${txnPrefix} matched ${txns.length}`);
    const flagged = txns[0].postings.filter((p) => p.isBusiness);
    for (const p of flagged) {
      if (DRY_RUN) {
        console.log(`[dry-run] would clear isBusiness on posting ${p.id} (txn ${txnPrefix}, amt ${p.amount})`);
      } else {
        await prisma.posting.update({ where: { id: p.id }, data: { isBusiness: false } });
        console.log(`Cleared isBusiness: posting ${p.id.slice(0, 8)} (txn ${txnPrefix}, amt ${p.amount})`);
      }
    }
    if (flagged.length === 0) console.log(`Txn ${txnPrefix}: no isBusiness postings (already clean)`);
  }

  // ── 4. Delete unused template categories ──
  let deleted = 0;
  for (const [prefix, name] of DELETE_LIST) {
    const cat = await byPrefix(prefix, name);
    if (cat._count.postings > 0) {
      throw new Error(`SAFETY STOP: "${name}" (${prefix}) has ${cat._count.postings} postings — not deleting`);
    }
    if (DRY_RUN) {
      console.log(`[dry-run] would delete "${name}" (${prefix}, kids=${cat._count.children})`);
    } else {
      await categoryService.deleteCategory(cat.id);
      deleted++;
    }
  }
  if (!DRY_RUN) console.log(`Deleted ${deleted} unused categories`);

  // ── 5. Bank Fees children ──
  const bankFees = await byPrefix('ecea6abb', 'Bank Fees');
  for (const childName of ['Credit Card Interest', 'Account Fees', 'Penalty Fees']) {
    if (DRY_RUN) {
      console.log(`[dry-run] would create "${childName}" under Bank Fees`);
    } else {
      const child = await categoryService.createCategory({
        name: childName,
        type: 'EXPENSE' as never,
        parentId: bankFees.id,
      });
      console.log(`Created: ${child.fullPath} (${child.id.slice(0, 8)})`);
    }
  }

  // ── Verification summary ──
  const remaining = await prisma.account.count({
    where: {
      kind: 'CATEGORY',
      type: { in: ['INCOME', 'EXPENSE'] },
      OR: [{ fullPath: null }, { level: 0 }],
    },
  });
  const total = await prisma.account.count({ where: { kind: 'CATEGORY' } });
  console.log(`\nFinal state: ${total} categories, ${remaining} with broken metadata`);
}

main()
  .catch((e) => {
    console.error('FAILED:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
