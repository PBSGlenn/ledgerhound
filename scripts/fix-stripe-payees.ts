/**
 * Fix "Mcquarie Bank" payees in Stripe register by looking up
 * customer names from the Stripe Charges/PaymentIntents API.
 */
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const DB_URL = 'file:C:\\Dev\\Ledgerhound\\prisma\\books\\book_1770973815778_ncl6o9xkt\\ledger.db';
const DRY_RUN = process.argv.includes('--dry-run');

const prisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
});

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== FIXING STRIPE PAYEES ===\n');

  // Get Stripe API key from settings
  const settingsRow = await prisma.settings.findUnique({ where: { key: 'stripe' } });
  if (!settingsRow) {
    console.error('Stripe settings not found in database');
    return;
  }
  const stripeSettings = JSON.parse(settingsRow.value);
  const apiKey = stripeSettings.apiKey;
  if (!apiKey) {
    console.error('No Stripe API key configured');
    return;
  }

  const stripe = new Stripe(apiKey);

  // Find all Stripe charge transactions with generic/wrong payees
  const badPayees = await prisma.transaction.findMany({
    where: {
      memo: 'Stripe charge',
      OR: [
        { payee: { contains: 'Mcquarie Bank' } },
        { payee: 'Stripe Charge' },
        { payee: { startsWith: 'Invoice Payment' } },
        { payee: 'Payment for Invoice' },
      ],
    },
    orderBy: { date: 'asc' },
  });

  console.log(`Found ${badPayees.length} transactions with generic payees\n`);

  let fixed = 0;
  let failed = 0;

  for (const tx of badPayees) {
    const date = new Date(tx.date).toISOString().slice(0, 10);
    const meta = tx.metadata ? JSON.parse(tx.metadata) : {};
    const sourceId = meta.source; // charge ID like ch_xxx or py_xxx

    if (!sourceId || typeof sourceId !== 'string') {
      console.log(`  SKIP: ${date} "${tx.payee}" — no source ID in metadata`);
      failed++;
      continue;
    }

    try {
      let customerName: string | null = null;

      if (sourceId.startsWith('ch_')) {
        // It's a charge - get billing details
        const charge = await stripe.charges.retrieve(sourceId, {
          expand: ['customer'],
        });
        customerName = charge.billing_details?.name
          || (typeof charge.customer === 'object' && charge.customer?.name)
          || charge.description
          || null;
      } else if (sourceId.startsWith('py_')) {
        // It's a payment intent payment - retrieve the payment intent
        const charge = await stripe.charges.retrieve(sourceId, {
          expand: ['customer', 'payment_intent'],
        });
        customerName = charge.billing_details?.name
          || (typeof charge.customer === 'object' && charge.customer?.name)
          || charge.description
          || null;
      } else if (sourceId.startsWith('pi_')) {
        const pi = await stripe.paymentIntents.retrieve(sourceId, {
          expand: ['customer', 'latest_charge'],
        });
        const charge = pi.latest_charge;
        if (typeof charge === 'object' && charge) {
          customerName = charge.billing_details?.name || null;
        }
        if (!customerName && typeof pi.customer === 'object' && pi.customer) {
          customerName = pi.customer.name || null;
        }
      }

      if (customerName) {
        console.log(`  FIX: ${date} "${tx.payee}" → "${customerName}" (${sourceId})`);
        if (!DRY_RUN) {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { payee: customerName },
          });
        }
        fixed++;
      } else {
        console.log(`  NONAME: ${date} "${tx.payee}" — no customer name found (${sourceId})`);
        failed++;
      }
    } catch (err: any) {
      console.log(`  ERROR: ${date} "${tx.payee}" — ${err.message} (${sourceId})`);
      failed++;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Fixed: ${fixed}`);
  console.log(`Failed/skipped: ${failed}`);
  if (DRY_RUN) console.log('(Dry run — no changes made)');
}

main().catch(console.error).finally(() => prisma.$disconnect());
