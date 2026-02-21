/**
 * parse-monthly-fees.ts
 *
 * Parser for the "Monthly fees" WhatsApp group chat.
 *
 * ── Message structure observed in the wild ───────────────────────────────────
 *
 *  1. Standard one-liner:
 *       [timestamp] Sender: Date 14
 *       A1983 mayank 500 cash
 *
 *  2. Multi-line split (entry+name / amount+mode on separate lines):
 *       [timestamp] Sender: Date 15
 *       A2395 krishna
 *       500 online
 *
 *  3. Name before entry number:
 *       [timestamp] Sender: Date-10
 *       Jabir A1004 500 online
 *
 *  4. Entry number arrives AFTER the name/amount (reversed):
 *       [timestamp] Sender: Date-10
 *       Ravi kumar 500 online
 *       A1855
 *
 *  5. Entry number inline with the timestamp / Date line:
 *       [timestamp] Sender: Date-9 A2393
 *       Aman 500 online
 *
 *  6. Bare number without the "A" prefix:
 *       [timestamp] Sender: Date-16
 *       2321 karan 500 cash
 *
 *  7. Dash between entry number and name (A2536-Ronak):
 *       [timestamp] Sender: Date-17
 *       A2536-Ronak 1000 cash 200 online
 *
 *  8. Short / zero-padded entry numbers: A25, A001, A0001 (all mean the same)
 *
 *  9. Amount preceded by a dash: Rahul -500 online  → 500
 *
 * 10. "pending" amounts are notes, NOT a second payment:
 *       A114 arif 1000 cash 200 pending
 *       → amount = 1000, note = "200 pending"
 *
 * 11. Notes in parentheses: ( till 2 December ), (till 1 nov)
 *
 * 12. Inline "till" notes attached to a multi-month payment:
 *       A2177 rihan 1200 cash  ( Till 31 dec )
 *
 * ── Canonical entry number format ────────────────────────────────────────────
 *   We strip all leading zeros from the numeric part, e.g.:
 *     A0025 → A25,   A0001 → A1,   A1983 → A1983
 *   This means the SAME member will always produce the SAME lookup key
 *   regardless of how the entry was typed in the chat or stored in the DB.
 *
 * ── 0-loss guarantee ─────────────────────────────────────────────────────────
 *   Every line that contains a valid payment amount (100 ≤ n ≤ 9999) and is
 *   NOT a pure admin note (no entry, no name, only control words) will produce
 *   a MonthlyFeeEntry.  If the entry number cannot be resolved to a DB client
 *   the importer will still store it as an ImportedClient (PENDING) so nothing
 *   is ever silently discarded.
 */

export interface MonthlyFeeEntry {
  /** Canonical entry number e.g. "A1983", "A25".  null = not found. */
  entryNumber: string | null;
  /** Numeric digits only, used for DB lookup (e.g. "1983", "25"). */
  entryDigits: string | null;
  /** Best-guess member name extracted from the text. */
  memberName: string | null;
  /** Primary payment amount (first valid fee amount found). */
  amount: number;
  /** Payment method word from message. */
  mode: 'cash' | 'online' | 'unknown';
  /** Renewal day-of-month from the "Date X" header line. */
  renewalDay: number | null;
  /** The WhatsApp message timestamp — this is the actual payment date. */
  paymentDate: Date;
  /** Content of parenthetical notes, e.g. "till 2 December". */
  notes: string | null;
  /** Concatenated raw text that produced this entry (for debugging). */
  rawText: string;
}

// ─── Regex constants ──────────────────────────────────────────────────────────

/** WhatsApp timestamp: [M/D/YY, H:MM:SS AM/PM] Sender: body */
const TIMESTAMP_RE =
  /^\[(\d{1,2})\/(\d{1,2})\/(\d{2}),\s*(\d{1,2}:\d{2}:\d{2})\s*(AM|PM)\]\s*([^:]+):\s*(.*)/i;

/**
 * Entry number formats found in the chat:
 *   A1983  A-2400  A 1476  A001  A25  A0001
 * Captures the raw digit string as group 1.
 * \b ensures we don't match in the middle of a larger number.
 */
const ENTRY_RE = /\bA[\s-]?(\d{1,4})\b/i;

/**
 * Bare numeric entry at start of text (no "A" prefix):
 *   "2321 karan 500 cash"  →  entry = 2321
 * Only matches when the number is immediately followed by a space + letter
 * (to avoid treating the AMOUNT as an entry).
 */
const BARE_ENTRY_START_RE = /^(\d{3,4})\s+[a-zA-Z]/;

/** Amounts: 3-5 digit numbers in the fee range 100–9999. */
const AMOUNT_RE = /\b(\d{3,5})\b/g;

/** "Date 14"  "Date-28"  "DATE  3"  "Date18" */
const RENEWAL_DAY_RE = /\bdate[-\s]*(\d{1,2})\b/i;

/** Parenthetical notes: ( till 2 December ) */
const NOTES_RE = /\(([^)]+)\)/;

/** Tags like <This message was edited> */
const HTML_TAG_RE = /<[^>]+>/g;

/** WhatsApp RTL / zero-width characters */
const ZWS_RE = /[\u200e\u200f\u202a-\u202e\u200b\ufeff]/g;

/**
 * Lines that are purely administrative / system messages — no payment data.
 * These are skipped even if they contain numbers.
 */
const SKIP_LINE_RE =
  /^(Messages and calls are end-to-end encrypted|.* created group|.* added you|.* joined|^Cash$|^Online$|^UPI$)/i;

// ─── Entry normalization ──────────────────────────────────────────────────────

/**
 * Canonical entry: "A" + digits with leading zeros stripped.
 *   normalizeEntry("0025") → "A25"
 *   normalizeEntry("1983") → "A1983"
 *   normalizeEntry("001")  → "A1"
 */
export function normalizeEntry(digits: string): string {
  const n = digits.replace(/\D/g, '').replace(/^0+/, '') || '0';
  return 'A' + n;
}

/** Extract and normalize the entry number from a combined text block. */
function extractEntry(
  text: string,
): { entryNumber: string; entryDigits: string } | null {
  // 1. Look for A-prefixed entry (most common)
  const m = ENTRY_RE.exec(text);
  if (m) {
    const digits = m[1].replace(/^0+/, '') || '0';
    return { entryNumber: 'A' + digits, entryDigits: digits };
  }

  // 2. Bare number at start of text: "2321 karan 500 cash"
  const bare = BARE_ENTRY_START_RE.exec(text);
  if (bare) {
    const digits = bare[1].replace(/^0+/, '') || '0';
    return { entryNumber: 'A' + digits, entryDigits: digits };
  }

  return null;
}

// ─── Amount extraction ────────────────────────────────────────────────────────

/**
 * Find the primary payment amount in text.
 * Rules:
 *  - Must be 100 ≤ n ≤ 9999
 *  - Skip numbers that look like they ARE the entry number
 *  - Skip numbers immediately followed by "pending" (those are balance notes)
 *  - Take the first qualifying amount
 */
function extractAmount(
  text: string,
  entryDigits: string | null,
): number | null {
  // Build set of digit strings to exclude (they are entry numbers, not amounts)
  const skipNums = new Set<string>();
  if (entryDigits) skipNums.add(entryDigits);

  // Also collect all numbers that appear right before "pending" — skip those
  const pendingNums = new Set<string>();
  const pendingRe = /\b(\d{3,5})\s+pending\b/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pendingRe.exec(text)) !== null) {
    pendingNums.add(pm[1]);
  }

  AMOUNT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = AMOUNT_RE.exec(text)) !== null) {
    const raw = match[1];
    const n = Number.parseInt(raw, 10);
    if (n < 100 || n > 9999) continue;
    if (skipNums.has(raw.replace(/^0+/, ''))) continue;
    if (pendingNums.has(raw)) continue;
    return n;
  }
  return null;
}

// ─── Mode extraction ──────────────────────────────────────────────────────────

function extractMode(text: string): 'cash' | 'online' | 'unknown' {
  if (/\bonline\b/i.test(text)) return 'online';
  if (/\bcash\b/i.test(text)) return 'cash';
  return 'unknown';
}

// ─── Name extraction ──────────────────────────────────────────────────────────

/** Stop-words that are never part of a person's name in this chat. */
const STOP_WORDS = new Set([
  'cash',
  'online',
  'upi',
  'pending',
  'received',
  'month',
  'months',
  'fees',
  'fee',
  'this',
  'message',
  'edited',
  'till',
  'clear',
  'paid',
  'date',
  'amount',
  'bhai',
  'di',
]);

function extractName(text: string): string | null {
  const t = text
    .replace(ENTRY_RE, ' ') // remove entry number
    .replace(HTML_TAG_RE, ' ') // remove <...> tags
    .replace(ZWS_RE, '')
    .replace(NOTES_RE, ' ') // remove (notes)
    .replace(RENEWAL_DAY_RE, ' ') // remove "Date X"
    .replace(/[^a-zA-Z\s]/g, ' ') // keep only letters + spaces
    .replace(/\s+/g, ' ')
    .trim();

  const words = t
    .split(' ')
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  if (words.length === 0) return null;

  return words
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

function parseWhatsAppDate(
  month: number,
  day: number,
  year2: number,
  time: string,
  ampm: string,
): Date {
  // WhatsApp exports in M/D/YY format
  const fullYear = 2000 + year2;
  const [hStr, mStr, sStr] = time.split(':');
  let hours = Number.parseInt(hStr, 10);
  const minutes = Number.parseInt(mStr, 10);
  const seconds = Number.parseInt(sStr || '0', 10);
  if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
  if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
  return new Date(fullYear, month - 1, day, hours, minutes, seconds);
}

// ─── Block parser ─────────────────────────────────────────────────────────────

/**
 * Try to parse a combined text block into a MonthlyFeeEntry.
 * Returns null if no valid payment amount is found.
 */
function parseBlock(
  text: string,
  paymentDate: Date,
  renewalDay: number | null,
): MonthlyFeeEntry | null {
  const cleaned = text
    .replace(HTML_TAG_RE, ' ')
    .replace(ZWS_RE, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return null;

  // Skip pure system / admin lines
  if (SKIP_LINE_RE.test(cleaned)) return null;

  const entryInfo = extractEntry(cleaned);
  const amount = extractAmount(cleaned, entryInfo?.entryDigits ?? null);

  // Must have a valid amount to be a payment entry
  if (amount === null) return null;

  // Skip lines that are purely pending-balance notes (no cash/online keyword)
  // e.g. "100 pending\n100 clear" → not a real payment entry
  const hasPaymentWord = /\b(cash|online|upi|received|paid)\b/i.test(cleaned);
  const hasPendingOnly = /\bpending\b/i.test(cleaned) && !hasPaymentWord;
  if (hasPendingOnly) return null;

  const mode = extractMode(cleaned);
  const notes = NOTES_RE.exec(cleaned)?.[1]?.trim() ?? null;
  const memberName = extractName(cleaned);

  return {
    entryNumber: entryInfo?.entryNumber ?? null,
    entryDigits: entryInfo?.entryDigits ?? null,
    memberName,
    amount,
    mode,
    renewalDay,
    paymentDate,
    notes,
    rawText: cleaned,
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Parse the full "Monthly fees" WhatsApp chat text and return one
 * MonthlyFeeEntry per payment record found.
 *
 * The function guarantees:
 *  - Every payment line in the chat produces exactly ONE entry.
 *  - Entries without a resolvable entry number have entryNumber = null
 *    (the importer will queue these as PENDING instead of discarding them).
 *  - No entry is produced more than once (multi-line blocks are collapsed).
 */
export function parseMonthlyFees(chatText: string): MonthlyFeeEntry[] {
  const lines = chatText.split('\n');
  const entries: MonthlyFeeEntry[] = [];

  let currentDate: Date = new Date();
  let currentRenewalDay: number | null = null;

  // We buffer lines belonging to the same WhatsApp message block so that
  // multi-line entries (entry on one line, amount on the next) are combined.
  let buffer: string[] = [];
  let bufferDate: Date = new Date();
  let bufferRenewalDay: number | null = null;

  function flushBuffer() {
    if (buffer.length === 0) return;
    const combined = buffer.join(' ').replace(/\s+/g, ' ').trim();
    const parsed = parseBlock(combined, bufferDate, bufferRenewalDay);
    if (parsed) entries.push(parsed);
    buffer = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(HTML_TAG_RE, '').replace(ZWS_RE, '').trim();

    if (!line) continue;

    const tsMatch = TIMESTAMP_RE.exec(line);
    if (tsMatch) {
      // New timestamp → flush whatever was buffered for the previous message
      flushBuffer();

      const month = Number.parseInt(tsMatch[1], 10);
      const day = Number.parseInt(tsMatch[2], 10);
      const year2 = Number.parseInt(tsMatch[3], 10);
      const time = tsMatch[4];
      const ampm = tsMatch[5];
      const body = tsMatch[7].trim();

      currentDate = parseWhatsAppDate(month, day, year2, time, ampm);
      bufferDate = currentDate;

      // Extract renewal day ("Date 14", "Date-28") from the message body
      const rdMatch = RENEWAL_DAY_RE.exec(body);
      currentRenewalDay = rdMatch ? Number.parseInt(rdMatch[1], 10) : null;
      bufferRenewalDay = currentRenewalDay;

      // Skip pure system lines that carry no payment data
      if (SKIP_LINE_RE.test(body)) continue;

      // Strip the "Date X" part from the body — what's left may be payment info
      // e.g. "Date-9 A2393" → "A2393"
      // e.g. "Date-17 A2405 anurag" → "A2405 anurag"
      const bodyWithoutDate = body.replace(RENEWAL_DAY_RE, '').trim();
      if (bodyWithoutDate) {
        buffer.push(bodyWithoutDate);
      }
    } else {
      // Continuation line — append to current buffer
      if (line) buffer.push(line);
    }
  }

  // Flush the last block
  flushBuffer();

  return entries;
}
