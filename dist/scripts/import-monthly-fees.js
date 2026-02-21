"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const client_1 = require("@prisma/client");
const parse_monthly_fees_1 = require("./parse-monthly-fees");
const prisma = new client_1.PrismaClient();
const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith('--'));
const DRY_RUN = args.includes('--dry-run');
const SHOW_STATS = args.includes('--stats') || DRY_RUN;
function canonicalEntry(raw) {
    const upper = raw.toUpperCase().trim();
    const digits = upper.replace(/^A[\s-]?/, '').replace(/^0+/, '') || '0';
    return 'A' + digits;
}
function toPaymentMethod(mode) {
    const m = mode.toLowerCase();
    if (m === 'online' ||
        m === 'upi' ||
        m === 'gpay' ||
        m === 'phonepe' ||
        m === 'paytm') {
        return client_1.PaymentMethod.UPI;
    }
    if (m === 'card')
        return client_1.PaymentMethod.CARD;
    if (m === 'bank' || m === 'neft' || m === 'imps')
        return client_1.PaymentMethod.BANK_TRANSFER;
    return client_1.PaymentMethod.CASH;
}
function dayStart(d) {
    const s = new Date(d);
    s.setHours(0, 0, 0, 0);
    return s;
}
function dayEnd(d) {
    const e = new Date(d);
    e.setHours(23, 59, 59, 999);
    return e;
}
function safeDate(d) {
    return Number.isNaN(d.getTime()) ? new Date() : d;
}
function buildNote(entry) {
    const parts = ['Monthly fee — WhatsApp import'];
    if (entry.entryNumber)
        parts.push(`entry ${entry.entryNumber}`);
    if (entry.renewalDay !== null)
        parts.push(`renewal day: ${entry.renewalDay}`);
    if (entry.notes)
        parts.push(entry.notes);
    return parts.join(' | ');
}
const stats = {
    total: 0,
    matched: 0,
    pending: 0,
    duplicatePayment: 0,
    duplicatePending: 0,
    errors: 0,
};
function printDryRun(entries, clientMap) {
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
            console.log(`  ✅  ${label.padEnd(6)}  ${e.memberName ?? ''}  ₹${e.amount}  ${mode}  ${e.paymentDate.toDateString()}  → ${client.name}${note}`);
            matched++;
        }
        else {
            console.log(`  🟡  ${label.padEnd(6)}  ${e.memberName ?? '(unknown)'}  ₹${e.amount}  ${mode}  ${e.paymentDate.toDateString()}  → PENDING${note}`);
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
async function run() {
    if (!filePath) {
        console.error('Usage: npm run import:monthly-fees <chat_file> [--dry-run] [--stats]');
        process.exit(1);
    }
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
        console.error(`File not found: ${resolved}`);
        process.exit(1);
    }
    const chatText = fs.readFileSync(resolved, 'utf-8');
    const entries = (0, parse_monthly_fees_1.parseMonthlyFees)(chatText);
    console.log(`\nParsed ${entries.length} payment entries from chat.\n`);
    const user = await prisma.user.findFirst({ where: { role: 'GYM_OWNER' } });
    if (!user) {
        console.error('No GYM_OWNER user found. Run the app setup first.');
        process.exit(1);
    }
    const allClients = await prisma.client.findMany({
        where: { userId: user.id },
        select: { id: true, name: true, entryNumber: true, endDate: true },
    });
    const clientMap = new Map();
    for (const c of allClients) {
        if (!c.entryNumber)
            continue;
        const key = canonicalEntry(c.entryNumber);
        if (!clientMap.has(key)) {
            clientMap.set(key, { id: c.id, name: c.name, endDate: c.endDate });
        }
        else {
            console.warn(`  ⚠️  Duplicate canonical entry ${key} in DB (clients: "${c.name}" and "${clientMap.get(key).name}"). Using first found.`);
        }
    }
    console.log(`Loaded ${clientMap.size} clients with entry numbers.\n`);
    if (DRY_RUN) {
        console.log('── DRY RUN (nothing written to DB) ──\n');
        printDryRun(entries, clientMap);
        await prisma.$disconnect();
        return;
    }
    for (const entry of entries) {
        stats.total++;
        const canonicalKey = entry.entryNumber
            ? canonicalEntry(entry.entryNumber)
            : null;
        const client = canonicalKey ? (clientMap.get(canonicalKey) ?? null) : null;
        const paidAt = safeDate(entry.paymentDate);
        try {
            if (client) {
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
                const currentEnd = client.endDate;
                const base = currentEnd > paidAt ? currentEnd : paidAt;
                const newEnd = new Date(base);
                newEnd.setMonth(newEnd.getMonth() + 1);
                await prisma.$transaction([
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
                    prisma.client.update({
                        where: { id: client.id },
                        data: {
                            membershipType: 'monthly',
                            endDate: newEnd,
                            isActive: true,
                        },
                    }),
                ]);
                client.endDate = newEnd;
                const label = entry.entryNumber ?? '?';
                const name = entry.memberName ?? client.name;
                console.log(`  ✅  ${label.padEnd(6)}  ${name}  ₹${entry.amount}  ${entry.mode}`);
                stats.matched++;
            }
            else {
                const existingPending = await prisma.importedClient.findFirst({
                    where: {
                        userId: user.id,
                        entryNumber: entry.entryNumber,
                        membershipAmount: entry.amount,
                        joinDate: { gte: dayStart(paidAt), lte: dayEnd(paidAt) },
                        status: client_1.ImportStatus.PENDING,
                    },
                    select: { id: true },
                });
                if (existingPending) {
                    console.log(`  ⏭️   ${entry.entryNumber ?? 'NO_ENTRY'}  — duplicate pending, skipped`);
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
                        status: client_1.ImportStatus.PENDING,
                        reviewNote: reason,
                        userId: user.id,
                    },
                });
                const label = entry.entryNumber ?? 'NO_ENTRY';
                const name = entry.memberName ?? '(unknown)';
                console.log(`  🟡  ${label.padEnd(6)}  ${name}  ₹${entry.amount}  → PENDING`);
                stats.pending++;
            }
        }
        catch (err) {
            const label = entry.entryNumber ?? 'NO_ENTRY';
            console.error(`  ❌  ${label}  — ERROR: ${err.message}`);
            stats.errors++;
        }
    }
    console.log('\n🎉  Import complete.\n');
    if (SHOW_STATS) {
        const totalRecorded = stats.matched + stats.pending;
        const totalInput = stats.total;
        const lossRate = totalInput > 0
            ? (((totalInput -
                totalRecorded -
                stats.duplicatePayment -
                stats.duplicatePending) /
                totalInput) *
                100).toFixed(1)
            : '0.0';
        console.log('── Final Summary ──────────────────────────────');
        console.log(`  Chat entries parsed          : ${stats.total}`);
        console.log(`  ✅  Matched → Payment created : ${stats.matched}`);
        console.log(`  🟡  Unmatched → PENDING       : ${stats.pending}`);
        console.log(`  ⏭️   Skipped (duplicates)      : ${stats.duplicatePayment + stats.duplicatePending}`);
        if (stats.errors > 0) {
            console.log(`  ❌  Errors                    : ${stats.errors}`);
        }
        console.log(`  Data loss rate               : ${lossRate}%`);
        console.log('───────────────────────────────────────────────\n');
    }
    await prisma.$disconnect();
}
run().catch((err) => {
    console.error('Fatal:', err.message);
    void prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=import-monthly-fees.js.map