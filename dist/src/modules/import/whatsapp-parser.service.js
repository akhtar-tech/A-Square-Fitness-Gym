"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppParserService = void 0;
const common_1 = require("@nestjs/common");
const LINE_RE = /^[\u200e\s]*\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}:\d{2}:\d{2}\s*[AP]M)\]\s+(.+?):\s*(.*)$/i;
const PHOTO_RE = /<attached:\s*([\w.-]+\.(?:jpg|jpeg|png|webp))\s*>/i;
const ENTRY_RE = /\bA-?(\d{3,4})\b/i;
const PHONE_RE = /\b([6-9]\d{9})\b/;
const FEES_RE = /(?:(\d+)\s*months?\s*fees?\s+)?(\d{3,5})\s*(online|cash|upi|card|bank|neft|imps|gpay|phonepe|paytm)/i;
const CASH_AMT_RE = /CASH[-\s]*(\d{3,5})/i;
const WINDOW_SEC = 120;
let WhatsAppParserService = class WhatsAppParserService {
    parse(rawText) {
        const lines = rawText.split(/\r?\n/);
        const fmt = this.detectFmt(lines);
        const msgs = this.parseMessages(lines, fmt);
        return this.buildEntries(msgs);
    }
    detectFmt(lines) {
        for (const l of lines.slice(0, 20)) {
            const m = /^\[?[\u200e]*\[?(\d{1,2})\/(\d{1,2})\//.exec(l);
            if (m) {
                if (+m[2] > 12)
                    return 'MDY';
                if (+m[1] > 12)
                    return 'DMY';
            }
        }
        return 'MDY';
    }
    parseMessages(lines, fmt) {
        const result = [];
        let idx = 0;
        let cur = null;
        const flush = () => {
            if (!cur)
                return;
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
            }
            else if (cur && line.trim()) {
                cur.parts.push(line.trim());
            }
        }
        flush();
        return result;
    }
    buildEntries(msgs) {
        const entries = [];
        const usedPhoto = new Set();
        const seenEntry = new Set();
        const entryMsgs = msgs.filter((m) => ENTRY_RE.test(m.text));
        for (const em of entryMsgs) {
            const flags = [];
            const eMatch = ENTRY_RE.exec(em.text);
            const entryNumber = `A${eMatch[1].padStart(4, '0')}`;
            if (seenEntry.has(entryNumber)) {
                flags.push(`Duplicate entry ${entryNumber}`);
            }
            seenEntry.add(entryNumber);
            let photoMsg = null;
            if (em.isPhoto) {
                photoMsg = em;
                usedPhoto.add(em.idx);
            }
            else {
                let bestDiff = Infinity;
                for (const m of msgs) {
                    if (!m.isPhoto || usedPhoto.has(m.idx))
                        continue;
                    if (m.sender !== em.sender)
                        continue;
                    const diff = Math.abs(m.ts.getTime() - em.ts.getTime()) / 1000;
                    if (diff <= WINDOW_SEC && diff < bestDiff) {
                        bestDiff = diff;
                        photoMsg = m;
                    }
                }
                if (photoMsg)
                    usedPhoto.add(photoMsg.idx);
            }
            if (!photoMsg)
                flags.push('No photo');
            let auxFees = null;
            if (!this.hasFees(em.text) && photoMsg && !this.hasFees(photoMsg.text)) {
                for (const m of msgs) {
                    if (m.isPhoto || m === em)
                        continue;
                    if (m.sender !== em.sender)
                        continue;
                    const diff = Math.abs(m.ts.getTime() - em.ts.getTime()) / 1000;
                    if (diff <= WINDOW_SEC && /^\d{3,5}$/.test(m.text.trim())) {
                        auxFees = m.text.trim();
                        break;
                    }
                }
            }
            const infoText = photoMsg && photoMsg !== em ? photoMsg.text : '';
            const extracted = this.extractNamePhone(infoText);
            let name = extracted.name;
            const phone = extracted.phone;
            const addrFromInfo = extracted.addrFromInfo;
            if (!name) {
                name = this.extractNameFromFeesMessage(em.text);
            }
            if (!name)
                flags.push('Name not found');
            if (!phone)
                flags.push('Phone not found');
            const addrFromEntry = this.extractAddress(em.text);
            const address = addrFromEntry || addrFromInfo || null;
            const allText = [em.text, infoText, auxFees ?? ''].join('\n');
            const fees = this.extractFees(allText);
            if (!fees.amount)
                flags.push('Amount not found');
            if (!fees.mode)
                flags.push('Payment mode missing');
            if (fees.isSplit)
                flags.push('Split payment: ' + fees.note);
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
    extractNamePhone(text) {
        if (!text)
            return { name: null, phone: null, addrFromInfo: null };
        const lines = text
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l && !FEES_RE.test(l) && !ENTRY_RE.test(l));
        let phone = null;
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
        if (!phone)
            return { name: null, phone: null, addrFromInfo: null };
        let name = null;
        const addrParts = [];
        if (phoneLine === 0) {
            name =
                lines[0]
                    .substring(0, phonePos)
                    .replace(/[-\s.]+$/, '')
                    .trim() || null;
            addrParts.push(...lines.slice(1));
        }
        else {
            name = lines[0];
            addrParts.push(...lines.slice(1, phoneLine));
            const after = lines[phoneLine].substring(phonePos + 10).trim();
            if (after)
                addrParts.push(after);
            addrParts.push(...lines.slice(phoneLine + 1));
        }
        return {
            name: name || null,
            phone,
            addrFromInfo: addrParts.filter(Boolean).join(', ') || null,
        };
    }
    extractAddress(text) {
        const parts = [];
        for (const line of text.split('\n')) {
            const l = line.trim();
            if (!l || FEES_RE.test(l) || CASH_AMT_RE.test(l))
                continue;
            if (/^\d{3,5}$/.test(l))
                continue;
            const addr = l
                .replace(/\bA-?\d{3,4}\b\s*/i, '')
                .replace(/^[-\s,]+/, '')
                .trim();
            if (addr)
                parts.push(addr);
        }
        return parts.join(', ').trim() || null;
    }
    extractFees(text) {
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
        const splitM = /(\d{3,5})\s+(online|cash)\s+\+?\s*(\d{3,5})\s+(cash|online)/i.exec(text);
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
    extractNameFromFeesMessage(text) {
        if (!FEES_RE.test(text) && !CASH_AMT_RE.test(text))
            return null;
        const entryLine = text
            .split('\n')
            .find((l) => ENTRY_RE.test(l.trim()))
            ?.trim() ?? '';
        if (!entryLine)
            return null;
        let t = entryLine.replace(/\bA-?\d{3,4}\b/gi, '').trim();
        t = t
            .replace(/(?:\d+\s*months?\s*fees?\s+)?\d{3,5}\s*(?:online|cash|upi|card|bank|neft|imps|gpay|phonepe|paytm)[^\n]*/gi, '')
            .trim();
        t = t.replace(/\bReceived\b/gi, '').trim();
        if (/\b(block|sector|nagar|puri|pur|colony|vihar|mangol|mango|m\.p|road|lane|street|plot|flat|floor|phase)\b/i.test(t))
            return null;
        if (/\d/.test(t))
            return null;
        t = t
            .replace(/[^a-zA-Z\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!t || t.length < 2 || t.length > 30)
            return null;
        return t;
    }
    hasFees(text) {
        return FEES_RE.test(text) || CASH_AMT_RE.test(text);
    }
    parseTs(p1, p2, p3, timeStr, fmt) {
        const month = fmt === 'MDY' ? p1 : p2;
        const day = fmt === 'MDY' ? p2 : p1;
        const year = p3 < 100 ? 2000 + p3 : p3;
        const tm = /(\d{1,2}):(\d{2}):(\d{2})\s*([AP]M)/i.exec(timeStr);
        if (!tm)
            return new Date(year, month - 1, day);
        let h = +tm[1];
        const min = +tm[2], sec = +tm[3], ampm = tm[4].toUpperCase();
        if (ampm === 'PM' && h !== 12)
            h += 12;
        if (ampm === 'AM' && h === 12)
            h = 0;
        return new Date(year, month - 1, day, h, min, sec);
    }
};
exports.WhatsAppParserService = WhatsAppParserService;
exports.WhatsAppParserService = WhatsAppParserService = __decorate([
    (0, common_1.Injectable)()
], WhatsAppParserService);
//# sourceMappingURL=whatsapp-parser.service.js.map