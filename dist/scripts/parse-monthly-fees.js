"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeEntry = normalizeEntry;
exports.parseMonthlyFees = parseMonthlyFees;
const TIMESTAMP_RE = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2}),\s*(\d{1,2}:\d{2}:\d{2})\s*(AM|PM)\]\s*([^:]+):\s*(.*)/i;
const ENTRY_RE = /\bA[\s-]?(\d{1,4})\b/i;
const BARE_ENTRY_START_RE = /^(\d{3,4})\s+[a-zA-Z]/;
const AMOUNT_RE = /\b(\d{3,5})\b/g;
const RENEWAL_DAY_RE = /\bdate[-\s]*(\d{1,2})\b/i;
const NOTES_RE = /\(([^)]+)\)/;
const HTML_TAG_RE = /<[^>]+>/g;
const ZWS_RE = /[\u200e\u200f\u202a-\u202e\u200b\ufeff]/g;
const SKIP_LINE_RE = /^(Messages and calls are end-to-end encrypted|.* created group|.* added you|.* joined|^Cash$|^Online$|^UPI$)/i;
function normalizeEntry(digits) {
    const n = digits.replace(/\D/g, '').replace(/^0+/, '') || '0';
    return 'A' + n;
}
function extractEntry(text) {
    const m = ENTRY_RE.exec(text);
    if (m) {
        const digits = m[1].replace(/^0+/, '') || '0';
        return { entryNumber: 'A' + digits, entryDigits: digits };
    }
    const bare = BARE_ENTRY_START_RE.exec(text);
    if (bare) {
        const digits = bare[1].replace(/^0+/, '') || '0';
        return { entryNumber: 'A' + digits, entryDigits: digits };
    }
    return null;
}
function extractAmount(text, entryDigits) {
    const skipNums = new Set();
    if (entryDigits)
        skipNums.add(entryDigits);
    const pendingNums = new Set();
    const pendingRe = /\b(\d{3,5})\s+pending\b/gi;
    let pm;
    while ((pm = pendingRe.exec(text)) !== null) {
        pendingNums.add(pm[1]);
    }
    AMOUNT_RE.lastIndex = 0;
    let match;
    while ((match = AMOUNT_RE.exec(text)) !== null) {
        const raw = match[1];
        const n = Number.parseInt(raw, 10);
        if (n < 100 || n > 9999)
            continue;
        if (skipNums.has(raw.replace(/^0+/, '')))
            continue;
        if (pendingNums.has(raw))
            continue;
        return n;
    }
    return null;
}
function extractMode(text) {
    if (/\bonline\b/i.test(text))
        return 'online';
    if (/\bcash\b/i.test(text))
        return 'cash';
    return 'unknown';
}
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
function extractName(text) {
    const t = text
        .replace(ENTRY_RE, ' ')
        .replace(HTML_TAG_RE, ' ')
        .replace(ZWS_RE, '')
        .replace(NOTES_RE, ' ')
        .replace(RENEWAL_DAY_RE, ' ')
        .replace(/[^a-zA-Z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const words = t
        .split(' ')
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
    if (words.length === 0)
        return null;
    return words
        .slice(0, 3)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}
function parseWhatsAppDate(month, day, year2, time, ampm) {
    const fullYear = 2000 + year2;
    const [hStr, mStr, sStr] = time.split(':');
    let hours = Number.parseInt(hStr, 10);
    const minutes = Number.parseInt(mStr, 10);
    const seconds = Number.parseInt(sStr || '0', 10);
    if (ampm.toUpperCase() === 'PM' && hours < 12)
        hours += 12;
    if (ampm.toUpperCase() === 'AM' && hours === 12)
        hours = 0;
    return new Date(fullYear, month - 1, day, hours, minutes, seconds);
}
function parseBlock(text, paymentDate, renewalDay) {
    const cleaned = text
        .replace(HTML_TAG_RE, ' ')
        .replace(ZWS_RE, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned)
        return null;
    if (SKIP_LINE_RE.test(cleaned))
        return null;
    const entryInfo = extractEntry(cleaned);
    const amount = extractAmount(cleaned, entryInfo?.entryDigits ?? null);
    if (amount === null)
        return null;
    const hasPaymentWord = /\b(cash|online|upi|received|paid)\b/i.test(cleaned);
    const hasPendingOnly = /\bpending\b/i.test(cleaned) && !hasPaymentWord;
    if (hasPendingOnly)
        return null;
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
function parseMonthlyFees(chatText) {
    const lines = chatText.split('\n');
    const entries = [];
    let currentDate = new Date();
    let currentRenewalDay = null;
    let buffer = [];
    let bufferDate = new Date();
    let bufferRenewalDay = null;
    function flushBuffer() {
        if (buffer.length === 0)
            return;
        const combined = buffer.join(' ').replace(/\s+/g, ' ').trim();
        const parsed = parseBlock(combined, bufferDate, bufferRenewalDay);
        if (parsed)
            entries.push(parsed);
        buffer = [];
    }
    for (const rawLine of lines) {
        const line = rawLine.replace(HTML_TAG_RE, '').replace(ZWS_RE, '').trim();
        if (!line)
            continue;
        const tsMatch = TIMESTAMP_RE.exec(line);
        if (tsMatch) {
            flushBuffer();
            const month = Number.parseInt(tsMatch[1], 10);
            const day = Number.parseInt(tsMatch[2], 10);
            const year2 = Number.parseInt(tsMatch[3], 10);
            const time = tsMatch[4];
            const ampm = tsMatch[5];
            const body = tsMatch[7].trim();
            currentDate = parseWhatsAppDate(month, day, year2, time, ampm);
            bufferDate = currentDate;
            const rdMatch = RENEWAL_DAY_RE.exec(body);
            currentRenewalDay = rdMatch ? Number.parseInt(rdMatch[1], 10) : null;
            bufferRenewalDay = currentRenewalDay;
            if (SKIP_LINE_RE.test(body))
                continue;
            const bodyWithoutDate = body.replace(RENEWAL_DAY_RE, '').trim();
            if (bodyWithoutDate) {
                buffer.push(bodyWithoutDate);
            }
        }
        else {
            if (line)
                buffer.push(line);
        }
    }
    flushBuffer();
    return entries;
}
//# sourceMappingURL=parse-monthly-fees.js.map