import { Injectable } from '@nestjs/common';

export interface ParsedEntry {
  entryNumber: string | null;
  clientName: string | null;
  clientPhone: string | null;
  addressRaw: string | null;
  membershipDurationMonths: number;
  membershipAmount: number | null;
  paymentMode: string | null;
  joinDate: Date | null;
  photoFilename: string | null;
  sender: string | null;
  needsReview: boolean;
  reviewNote: string | null;
}

interface Msg {
  idx: number;
  ts: Date;
  sender: string;
  text: string; // photo tag stripped out
  isPhoto: boolean;
  photoFile: string | null;
}

// [9/16/24, 6:13:02 AM] or [16/09/24, 6:13:02 AM]
const LINE_RE =
  /^[\u200e\s]*\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}:\d{2}:\d{2}\s*[AP]M)\]\s+(.+?):\s*(.*)$/i;
const PHOTO_RE = /<attached:\s*([\w.-]+\.(?:jpg|jpeg|png|webp))\s*>/i;
const ENTRY_RE = /\bA-?(\d{3,4})\b/i; // A2400, A-2449, A2403
const PHONE_RE = /\b([6-9]\d{9})\b/; // Indian 10-digit mobile
// N month fees AMOUNT MODE  OR  AMOUNT MODE  OR  CASH-AMOUNT
const FEES_RE =
  /(?:(\d+)\s*months?\s*fees?\s+)?(\d{3,5})\s*(online|cash|upi|card|bank|neft|imps|gpay|phonepe|paytm)/i;
const CASH_AMT_RE = /CASH[-\s]*(\d{3,5})/i;
const WINDOW_SEC = 120;

@Injectable()
export class WhatsAppParserService {
  parse(rawText: string): ParsedEntry[] {
    const lines = rawText.split(/\r?\n/);
    const fmt = this.detectFmt(lines);
    const msgs = this.parseMessages(lines, fmt);
    return this.buildEntries(msgs);
  }

  // ── Detect M/D/Y vs D/M/Y ───────────────────────────────────────────
  private detectFmt(lines: string[]): 'MDY' | 'DMY' {
    for (const l of lines.slice(0, 20)) {
      const m = /^\[?[\u200e]*\[?(\d{1,2})\/(\d{1,2})\//.exec(l);
      if (m) {
        if (+m[2] > 12) return 'MDY'; // second part is day → M/D/Y
        if (+m[1] > 12) return 'DMY'; // first part is day  → D/M/Y
      }
    }
    return 'MDY'; // default (WhatsApp US format)
  }

  // ── Parse raw lines into message objects ────────────────────────────
  private parseMessages(lines: string[], fmt: 'MDY' | 'DMY'): Msg[] {
    const result: Msg[] = [];
    let idx = 0;
    let cur: { sender: string; ts: Date; parts: string[] } | null = null;

    const flush = () => {
      if (!cur) return;
      const full = cur.parts.join('\n');
      const pm = PHOTO_RE.exec(full);
      result.push({
        idx: idx++,
        ts: cur.ts,
        sender: cur.sender,
        text: full.replace(PHOTO_RE, '').replace(/‎/g, '').trim(),
        isPhoto: !!pm,
        photoFile: pm ? pm[1] : null,
      });
      cur = null;
    };

    for (const raw of lines) {
      const line = raw.replace(/\u200e/g, '');
      const m = LINE_RE.exec(line);
      if (m) {
        flush();
        const [, p1, p2, p3, time, sender, body] = m;
        cur = {
          sender: sender.trim(),
          ts: this.parseTs(+p1, +p2, +p3, time, fmt),
          parts: [body],
        };
      } else if (cur && line.trim()) {
        cur.parts.push(line.trim());
      }
    }
    flush();
    return result;
  }

  // ── Match photo messages with entry messages ─────────────────────────
  private buildEntries(msgs: Msg[]): ParsedEntry[] {
    const entries: ParsedEntry[] = [];
    const usedPhoto = new Set<number>();
    const seenEntry = new Set<string>();

    // Only process messages that contain an entry number
    const entryMsgs = msgs.filter((m) => ENTRY_RE.test(m.text));

    for (const em of entryMsgs) {
      const flags: string[] = [];

      // ── 1. Entry number ─────────────────────────────────────────────
      const eMatch = ENTRY_RE.exec(em.text)!;
      const entryNumber = `A${eMatch[1].padStart(4, '0')}`;

      if (seenEntry.has(entryNumber)) {
        flags.push(`Duplicate entry ${entryNumber}`);
      }
      seenEntry.add(entryNumber);

      // ── 2. Find closest photo msg from same sender within ±120s ─────
      let photoMsg: Msg | null = null;

      if (em.isPhoto) {
        // All-in-one: entry and photo in same message
        photoMsg = em;
        usedPhoto.add(em.idx);
      } else {
        let bestDiff = Infinity;
        for (const m of msgs) {
          if (!m.isPhoto || usedPhoto.has(m.idx)) continue;
          if (m.sender !== em.sender) continue;
          const diff = Math.abs(m.ts.getTime() - em.ts.getTime()) / 1000;
          if (diff <= WINDOW_SEC && diff < bestDiff) {
            bestDiff = diff;
            photoMsg = m;
          }
        }
        if (photoMsg) usedPhoto.add(photoMsg.idx);
      }

      if (!photoMsg) flags.push('No photo');

      // ── 3. Look for standalone fees msg nearby (e.g. A2407 case) ───
      let auxFees: string | null = null;
      if (!this.hasFees(em.text) && photoMsg && !this.hasFees(photoMsg.text)) {
        for (const m of msgs) {
          if (m.isPhoto || m === em) continue;
          if (m.sender !== em.sender) continue;
          const diff = Math.abs(m.ts.getTime() - em.ts.getTime()) / 1000;
          if (diff <= WINDOW_SEC && /^\d{3,5}$/.test(m.text.trim())) {
            auxFees = m.text.trim();
            break;
          }
        }
      }

      // ── 4. Extract name + phone from photo message ──────────────────
      const infoText = photoMsg && photoMsg !== em ? photoMsg.text : '';
      const extracted = this.extractNamePhone(infoText);
      let name = extracted.name;
      const phone = extracted.phone;
      const addrFromInfo = extracted.addrFromInfo;

      // Fallback: for fees-style messages ("A1983 mayank 500 cash") where no
      // photo caption is available, pull the name from the entry line itself.
      if (!name) {
        name = this.extractNameFromFeesMessage(em.text);
      }

      if (!name) flags.push('Name not found');
      if (!phone) flags.push('Phone not found');

      // ── 5. Extract address from entry message ───────────────────────
      const addrFromEntry = this.extractAddress(em.text);
      const address = addrFromEntry || addrFromInfo || null;

      // ── 6. Extract fees ─────────────────────────────────────────────
      const allText = [em.text, infoText, auxFees ?? ''].join('\n');
      const fees = this.extractFees(allText);

      if (!fees.amount) flags.push('Amount not found');
      if (!fees.mode) flags.push('Payment mode missing');
      if (fees.isSplit) flags.push('Split payment: ' + fees.note);

      entries.push({
        entryNumber,
        clientName: name,
        clientPhone: phone,
        addressRaw: address,
        membershipDurationMonths: fees.duration,
        membershipAmount: fees.amount,
        paymentMode: fees.mode,
        joinDate: em.ts,
        photoFilename: photoMsg?.photoFile ?? null,
        sender: em.sender,
        needsReview: flags.length > 0,
        reviewNote: flags.length ? flags.join(' | ') : null,
      });
    }

    return entries;
  }

  // ── Extract name + phone from "Name 9999999999" or "Name-9999999999\nAddress" ──
  private extractNamePhone(text: string): {
    name: string | null;
    phone: string | null;
    addrFromInfo: string | null;
  } {
    if (!text) return { name: null, phone: null, addrFromInfo: null };

    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !FEES_RE.test(l) && !ENTRY_RE.test(l));

    // Find phone number across lines
    let phone: string | null = null;
    let phoneLine = -1;
    let phonePos = -1;

    for (let i = 0; i < lines.length; i++) {
      const m = PHONE_RE.exec(lines[i]);
      if (m) {
        phone = m[1];
        phoneLine = i;
        phonePos = m.index;
        break;
      }
    }

    if (!phone) return { name: null, phone: null, addrFromInfo: null };

    let name: string | null = null;
    const addrParts: string[] = [];

    if (phoneLine === 0) {
      // "Vikas 9818682821" or "Anurag-8287570903"
      name =
        lines[0]
          .substring(0, phonePos)
          .replace(/[-\s.]+$/, '')
          .trim() || null;
      addrParts.push(...lines.slice(1));
    } else {
      // Phone on later line: first line = name, in-between = address
      name = lines[0];
      addrParts.push(...lines.slice(1, phoneLine));
      const after = lines[phoneLine].substring(phonePos + 10).trim();
      if (after) addrParts.push(after);
      addrParts.push(...lines.slice(phoneLine + 1));
    }

    return {
      name: name || null,
      phone,
      addrFromInfo: addrParts.filter(Boolean).join(', ') || null,
    };
  }

  // ── Extract address from entry text, stripping entry# and fees ──────
  private extractAddress(text: string): string | null {
    const parts: string[] = [];
    for (const line of text.split('\n')) {
      const l = line.trim();
      if (!l || FEES_RE.test(l) || CASH_AMT_RE.test(l)) continue;
      if (/^\d{3,5}$/.test(l)) continue; // bare amount
      // Strip entry number prefix
      const addr = l
        .replace(/\bA-?\d{3,4}\b\s*/i, '')
        .replace(/^[-\s,]+/, '')
        .trim();
      if (addr) parts.push(addr);
    }
    return parts.join(', ').trim() || null;
  }

  // ── Extract fees ─────────────────────────────────────────────────────
  private extractFees(text: string): {
    duration: number;
    amount: number | null;
    mode: string | null;
    isSplit: boolean;
    note: string | null;
  } {
    // "1 month fees 500 cash" or "500 online"
    const fm = FEES_RE.exec(text);
    if (fm) {
      return {
        duration: fm[1] ? parseInt(fm[1]) : 1,
        amount: parseInt(fm[2]),
        mode: fm[3].toLowerCase(),
        isSplit: false,
        note: null,
      };
    }

    // "CASH-500" or "CASH 500"
    const cm = CASH_AMT_RE.exec(text);
    if (cm) {
      return {
        duration: 1,
        amount: parseInt(cm[1]),
        mode: 'cash',
        isSplit: false,
        note: null,
      };
    }

    // Check for split: "300 online 200 cash"
    const splitM =
      /(\d{3,5})\s+(online|cash)\s+\+?\s*(\d{3,5})\s+(cash|online)/i.exec(text);
    if (splitM) {
      const total = parseInt(splitM[1]) + parseInt(splitM[3]);
      return {
        duration: 1,
        amount: total,
        mode: 'split',
        isSplit: true,
        note: `${splitM[1]} ${splitM[2]} + ${splitM[3]} ${splitM[4]}`,
      };
    }

    // Bare amount on its own (e.g. standalone "500" message)
    const bare = /^(\d{3,5})$/m.exec(text.trim());
    if (bare) {
      return {
        duration: 1,
        amount: parseInt(bare[1]),
        mode: null,
        isSplit: false,
        note: null,
      };
    }

    return {
      duration: 1,
      amount: null,
      mode: null,
      isSplit: false,
      note: null,
    };
  }

  // ── Extract name from a fees-style entry message ─────────────────
  // Handles lines like "A1983 mayank 500 cash" or "A1113 Asif Received 1200 online"
  // Returns null if the text looks like an address entry instead of a fees entry.
  extractNameFromFeesMessage(text: string): string | null {
    if (!FEES_RE.test(text) && !CASH_AMT_RE.test(text)) return null;

    // Find the line that contains the entry number
    const entryLine =
      text
        .split('\n')
        .find((l) => ENTRY_RE.test(l.trim()))
        ?.trim() ?? '';
    if (!entryLine) return null;

    // Remove entry number
    let t = entryLine.replace(/\bA-?\d{3,4}\b/gi, '').trim();

    // Remove fees part ("3 month fees 1000 online", "500 cash", etc.)
    t = t
      .replace(
        /(?:\d+\s*months?\s*fees?\s+)?\d{3,5}\s*(?:online|cash|upi|card|bank|neft|imps|gpay|phonepe|paytm)[^\n]*/gi,
        '',
      )
      .trim();

    // Remove "Received" keyword
    t = t.replace(/\bReceived\b/gi, '').trim();

    // If text contains address indicators (block names, digits for house number, locality names)
    // it is NOT a name — skip it
    if (
      /\b(block|sector|nagar|puri|pur|colony|vihar|mangol|mango|m\.p|road|lane|street|plot|flat|floor|phase)\b/i.test(
        t,
      )
    )
      return null;
    if (/\d/.test(t)) return null; // e.g. "D-14" — address, not a name

    // Keep only letters and spaces
    t = t
      .replace(/[^a-zA-Z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Sanity check: a name should be 2–30 chars
    if (!t || t.length < 2 || t.length > 30) return null;

    return t;
  }

  private hasFees(text: string): boolean {
    return FEES_RE.test(text) || CASH_AMT_RE.test(text);
  }

  // ── Parse timestamp ──────────────────────────────────────────────────
  private parseTs(
    p1: number,
    p2: number,
    p3: number,
    timeStr: string,
    fmt: 'MDY' | 'DMY',
  ): Date {
    const month = fmt === 'MDY' ? p1 : p2;
    const day = fmt === 'MDY' ? p2 : p1;
    const year = p3 < 100 ? 2000 + p3 : p3;

    const tm = /(\d{1,2}):(\d{2}):(\d{2})\s*([AP]M)/i.exec(timeStr);
    if (!tm) return new Date(year, month - 1, day);

    let h = +tm[1];
    const min = +tm[2],
      sec = +tm[3],
      ampm = tm[4].toUpperCase();
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;

    return new Date(year, month - 1, day, h, min, sec);
  }
}
