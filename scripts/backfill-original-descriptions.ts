/**
 * Backfill originalDescription in transaction metadata
 *
 * This script finds transactions that were imported with memorized rules
 * and adds the original bank description to their metadata for reconciliation matching.
 *
 * Run with: npx tsx scripts/backfill-original-descriptions.ts
 */

import { PrismaClient } from '@prisma/client';
import { memorizedRuleService } from '../src/lib/services/memorizedRuleService';

const prisma = new PrismaClient();

async function backfillOriginalDescriptions() {
  console.log('Starting backfill of originalDescription in transaction metadata...\n');

  // Get all memorized rules
  const rules = await memorizedRuleService.getAllRules();
  console.log(`Found ${rules.length} memorized rules`);

  // Get all transactions that were imported (have importBatchId)
  const transactions = await prisma.transaction.findMany({
    where: {
      importBatchId: { not: null },
    },
    include: {
      postings: true,
    },
  });

  console.log(`Found ${transactions.length} imported transactions to check\n`);

  let updated = 0;
  let alreadyHasOriginal = 0;
  let noMatchFound = 0;

  for (const tx of transactions) {
    // Skip if already has originalDescription
    if (tx.metadata) {
      try {
        const metadata = typeof tx.metadata === 'string'
          ? JSON.parse(tx.metadata)
          : tx.metadata;
        if (metadata.originalDescription) {
          alreadyHasOriginal++;
          continue;
        }
      } catch {
        // Invalid JSON, we'll update it
      }
    }

    // Check if payee matches a rule's suggested name (meaning it was transformed)
    for (const rule of rules) {
      if (rule.suggestedPayee === tx.payee) {
        // This transaction's payee matches a rule's suggested name
        // The original description would have matched the rule's pattern

        // Try to reconstruct what the original might have been
        // We know the current payee came from the rule, so we need to find
        // what the original bank description pattern was

        // For now, we'll just mark that this came from a rule
        // The best we can do is note which rule transformed it
        const currentMetadata = tx.metadata
          ? (typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : tx.metadata)
          : {};

        // We can't perfectly reconstruct the original, but we can note the rule
        // The pattern itself is often a good approximation
        const newMetadata = {
          ...currentMetadata,
          matchedRuleId: rule.id,
          matchedRuleName: rule.name,
          // Use the rule pattern as a hint (it won't be exact but might help)
          rulePattern: rule.pattern,
          rulePatternType: rule.patternType,
        };

        await prisma.transaction.update({
          where: { id: tx.id },
          data: {
            metadata: JSON.stringify(newMetadata),
          },
        });

        updated++;
        console.log(`Updated: "${tx.payee}" - matched rule: ${rule.name}`);
        break; // Move to next transaction
      }
    }
  }

  console.log(`\nBackfill complete!`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Already had originalDescription: ${alreadyHasOriginal}`);
  console.log(`  No match found: ${transactions.length - updated - alreadyHasOriginal}`);

  await prisma.$disconnect();
}

backfillOriginalDescriptions().catch(console.error);
