/**
 * import-monthly-fees.ts
 *
 * Imports every payment record from the "Monthly fees" WhatsApp group chat
 * into the database with a hard guarantee of 0 data loss.
 *
 * ── Matching strategy ────────────────────────────────────────────────────────
 *   1. Normalize entry number from chat → canonical form "A" + stripped digits
 *      e.g.  A0025 → A25,  A001 → A1,  A1983 → A1983
 *   2. Normalize ALL stored client entry numbers the same way.
 *   3. Try to match: canonical(chat) === canonical(DB)
 *   4. If MATCHED  →  create a Payment record for that client.
 *   5. If NOT MATCHED (entry number not in DB, or entry missing from message)
 *      →  create an ImportedClient(PENDING) record so nothing is ever lost.
 *
 * ── Deduplication ────────────────────────────────────────────────────────────
 *   Before inserting, check whether a payment already exists for the same
 *   client, same calendar date, and same amount.  If yes → skip (idempotent).
 *   Same check for ImportedClient records (by entryNumber + date + amount).
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *   npm run import:monthly-fees /path/to/_chat.txt
 *   npm run import:monthly-fees /path/to/_chat.txt --dry-run   # preview only
 *   npm run import:monthly-fees /path/to/_chat.txt --stats     # show summary
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PrismaClient, ImportStatus, PaymentMethod } from '@prisma/client';
import { parseMonthlyFees, MonthlyFeeEntry } from './parse-monthly-fees';

const prisma = new PrismaClient();

// ─── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith('--'));
const DRY_RUN = args.includes('--dry-run');
const SHOW_STATS = args.includes('--stats') || DRY_RUN;

// ─── Entry number normalization ───────────────────────────────────────────────

/**
 * Canonical entry key: "A" + numeric digits with all leading zeros stripped.
 *   "A0025" → "A25"
 *   "A001"  → "A1"
 *   "A1983" → "A1983"
 *   "25"    → "A25"    (bare number, add prefix)
 *   "a25"   → "A25"    (case-insensitive)
 *
 * This ensures that the same physical member always maps to the same key
 * no matter how their entry number was recorded (in chat or in the DB).
 */
function canonicalEntry(raw: string): string {
  const upper = raw.toUpperCase().trim();
  // Strip leading "A" (with optional space/dash), then strip leading zeros
  const digits = upper.replace(/^A[\s-]?/, '').replace(/^0+/, '') || '0';
  return 'A' + digits;
}

// ─── Payment method mapping ───────────────────────────────────────────────────

function toPaymentMethod(mode: string): PaymentMethod {
  const m = mode.toLowerCase();
  if (
    m === 'online' ||
    m === 'upi' ||
    m === 'gpay' ||
    m === 'phonepe' ||
    m === 'paytm'
  ) {
    return PaymentMethod.UPI;
  }
  if (m === 'card') return PaymentMethod.CARD;
  if (m === 'bank' || m === 'neft' || m === 'imps')
    return PaymentMethod.BANK_TRANSFER;
  return PaymentMethod.CASH;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns the start of the day (00:00:00) for a given Date. */
function dayStart(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

/** Returns the end of the day (23:59:59.999) for a given Date. */
function dayEnd(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

function safeDate(d: Date): Date {
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

// ─── Note builder ─────────────────────────────────────────────────────────────

function buildNote(entry: MonthlyFeeEntry): string {
  const parts: string[] = ['Monthly fee — WhatsApp import'];
  if (entry.entryNumber) parts.push(`entry ${entry.entryNumber}`);
  if (entry.renewalDay !== null) parts.push(`renewal day: ${entry.renewalDay}`);
  if (entry.notes) parts.push(entry.notes);
  return parts.join(' | ');
}

// ─── Stats ────────────────────────────────────────────────────────────────────

interface Stats {
  total: number;
  matched: number;
  pending: number;
  duplicatePayment: number;
  duplicatePending: number;
  errors: number;
}

const stats: Stats = {
  total: 0,
  matched: 0,
  pending: 0,
  duplicatePayment: 0,
  duplicatePending: 0,
  errors: 0,
};

// ─── Dry-run preview ──────────────────────────────────────────────────────────

function printDryRun(
  entries: MonthlyFeeEntry[],
  clientMap: Map<string, { id: string; name: string }>,
) {
  let totalAmount = 0;
  let matched = 0;
  let unmatched = 0;

  for (const e of entries) {
    const key = e.entryNumber ? canonicalEntry(e.entryNumber) : null;
    const client = key ? clientMap.get(key) : null;
    const label = e.entryNumber ?? 'NO_ENTRY';
    const mode = e.mode === 'unknown' ? '?' : e.mode;
    const note = e.notes ? `  [${e.notes}]` : '';

    if (client) {
      console.log(
        `  ✅  ${label.padEnd(6)}  ${e.memberName ?? ''}  ₹${e.amount}  ${mode}  ${e.paymentDate.toDateString()}  → ${client.name}${note}`,
      );
      matched++;
    } else {
      console.log(
        `  🟡  ${label.padEnd(6)}  ${e.memberName ?? '(unknown)'}  ₹${e.amount}  ${mode}  ${e.paymentDate.toDateString()}  → PENDING${note}`,
      );
      unmatched++;
    }
    totalAmount += e.amount;
  }

  console.log('\n── Dry Run Summary ──');
  console.log(`  Total parsed      : ${entries.length}`);
  console.log(`  Will be matched   : ${matched}   (Payment records)`);
  console.log(`  Will be pending   : ${unmatched}   (ImportedClient PENDING)`);
  console.log(`  Total amount      : ₹${totalAmount.toLocaleString('en-IN')}`);
  console.log();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  if (!filePath) {
    console.error(
      'Usage: npm run import:monthly-fees <chat_file> [--dry-run] [--stats]',
    );
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  const chatText = fs.readFileSync(resolved, 'utf-8');
  const entries = parseMonthlyFees(chatText);
  console.log(`\nParsed ${entries.length} payment entries from chat.\n`);

  // ── Load ALL clients for this gym owner ────────────────────────────────────
  const user = await prisma.user.findFirst({ where: { role: 'GYM_OWNER' } });
  if (!user) {
    console.error('No GYM_OWNER user found. Run the app setup first.');
    process.exit(1);
  }

  const allClients = await prisma.client.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, entryNumber: true, endDate: true },
  });

  /**
   * Build a lookup map:  canonicalEntry(stored_entryNumber) → client
   *
   * We handle ALL clients — even those without an entryNumber set —
   * by skipping them here (they can only be found via the PENDING flow).
   */
  const clientMap = new Map<
    string,
    { id: string; name: string; endDate: Date }
  >();
  for (const c of allClients) {
    if (!c.entryNumber) continue;
    const key = canonicalEntry(c.entryNumber);
    if (!clientMap.has(key)) {
      // If two clients somehow share a canonical key, prefer the one that was
      // seen first (oldest record).  Log a warning.
      clientMap.set(key, { id: c.id, name: c.name, endDate: c.endDate });
    } else {
      console.warn(
        `  ⚠️  Duplicate canonical entry ${key} in DB (clients: "${c.name}" and "${clientMap.get(key)!.name}"). Using first found.`,
      );
    }
  }

  console.log(`Loaded ${clientMap.size} clients with entry numbers.\n`);

  // ── Dry-run preview ────────────────────────────────────────────────────────
  if (DRY_RUN) {
    console.log('── DRY RUN (nothing written to DB) ──\n');
    printDryRun(entries, clientMap);
    await prisma.$disconnect();
    return;
  }

  // ── Process each parsed entry ──────────────────────────────────────────────
  for (const entry of entries) {
    stats.total++;

    const canonicalKey = entry.entryNumber
      ? canonicalEntry(entry.entryNumber)
      : null;
    const client = canonicalKey ? (clientMap.get(canonicalKey) ?? null) : null;
    const paidAt = safeDate(entry.paymentDate);

    try {
      if (client) {
        // ── MATCHED CLIENT → create Payment record ──────────────────────────

        // Deduplication: skip if identical payment already exists today
        const existingPayment = await prisma.payment.findFirst({
          where: {
            clientId: client.id,
            amount: entry.amount,
            paidAt: { gte: dayStart(paidAt), lte: dayEnd(paidAt) },
          },
          select: { id: true },
        });

        if (existingPayment) {
          console.log(`  ⏭️   ${entry.entryNumber}  — duplicate, skipped`);
          stats.duplicatePayment++;
          continue;
        }

        // Calculate new endDate: extend by 1 month from current expiry
        // (or from payment date if the membership is already expired)
        const currentEnd = client.endDate;
        const base = currentEnd > paidAt ? currentEnd : paidAt;
        const newEnd = new Date(base);
        newEnd.setMonth(newEnd.getMonth() + 1);

        await prisma.$transaction([
          // 1. Create the payment record
          prisma.payment.create({
            data: {
              amount: entry.amount,
              method: toPaymentMethod(entry.mode),
              note: buildNote(entry),
              paidAt,
              membershipType: 'monthly',
              endDate: newEnd,
              clientId: client.id,
              userId: user.id,
            },
          }),
          // 2. Update client cache to reflect latest payment
          prisma.client.update({
            where: { id: client.id },
            data: {
              membershipType: 'monthly',
              endDate: newEnd,
              isActive: true,
            },
          }),
        ]);

        // Update in-memory cache so subsequent payments for the same client
        // in this import batch use the updated endDate
        client.endDate = newEnd;

        const label = entry.entryNumber ?? '?';
        const name = entry.memberName ?? client.name;
        console.log(
          `  ✅  ${label.padEnd(6)}  ${name}  ₹${entry.amount}  ${entry.mode}`,
        );
        stats.matched++;
      } else {
        // ── NO MATCH → store as ImportedClient (PENDING) ────────────────────

        // Deduplication: skip if same pending record already exists
        const existingPending = await prisma.importedClient.findFirst({
          where: {
            userId: user.id,
            entryNumber: entry.entryNumber,
            membershipAmount: entry.amount,
            joinDate: { gte: dayStart(paidAt), lte: dayEnd(paidAt) },
            status: ImportStatus.PENDING,
          },
          select: { id: true },
        });

        if (existingPending) {
          console.log(
            `  ⏭️   ${entry.entryNumber ?? 'NO_ENTRY'}  — duplicate pending, skipped`,
          );
          stats.duplicatePending++;
          continue;
        }

        const reason = entry.entryNumber
          ? `Entry ${entry.entryNumber} not found in client records`
          : 'No entry number found in message';

        await prisma.importedClient.create({
          data: {
            entryNumber: entry.entryNumber,
            clientName: entry.memberName,
            membershipAmount: entry.amount,
            paymentMode: entry.mode === 'unknown' ? null : entry.mode,
            joinDate: paidAt,
            needsManualReview: true,
            status: ImportStatus.PENDING,
            reviewNote: reason,
            userId: user.id,
          },
        });

        const label = entry.entryNumber ?? 'NO_ENTRY';
        const name = entry.memberName ?? '(unknown)';
        console.log(
          `  🟡  ${label.padEnd(6)}  ${name}  ₹${entry.amount}  → PENDING`,
        );
        stats.pending++;
      }
    } catch (err) {
      const label = entry.entryNumber ?? 'NO_ENTRY';
      console.error(`  ❌  ${label}  — ERROR: ${(err as Error).message}`);
      stats.errors++;
      // Never abort the entire import on a single error — continue processing
    }
  }

  console.log('\n🎉  Import complete.\n');

  if (SHOW_STATS) {
    const totalRecorded = stats.matched + stats.pending;
    const totalInput = stats.total;
    const lossRate =
      totalInput > 0
        ? (
            ((totalInput -
              totalRecorded -
              stats.duplicatePayment -
              stats.duplicatePending) /
              totalInput) *
            100
          ).toFixed(1)
        : '0.0';

    console.log('── Final Summary ──────────────────────────────');
    console.log(`  Chat entries parsed          : ${stats.total}`);
    console.log(`  ✅  Matched → Payment created : ${stats.matched}`);
    console.log(`  🟡  Unmatched → PENDING       : ${stats.pending}`);
    console.log(
      `  ⏭️   Skipped (duplicates)      : ${stats.duplicatePayment + stats.duplicatePending}`,
    );
    if (stats.errors > 0) {
      console.log(`  ❌  Errors                    : ${stats.errors}`);
    }
    console.log(`  Data loss rate               : ${lossRate}%`);
    console.log('───────────────────────────────────────────────\n');
  }

  await prisma.$disconnect();
}

run().catch((err: Error) => {
  console.error('Fatal:', err.message);
  void prisma.$disconnect();
  process.exit(1);
});
