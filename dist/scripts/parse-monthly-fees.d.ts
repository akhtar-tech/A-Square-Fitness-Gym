export interface MonthlyFeeEntry {
    entryNumber: string | null;
    entryDigits: string | null;
    memberName: string | null;
    amount: number;
    mode: 'cash' | 'online' | 'unknown';
    renewalDay: number | null;
    paymentDate: Date;
    notes: string | null;
    rawText: string;
}
export declare function normalizeEntry(digits: string): string;
export declare function parseMonthlyFees(chatText: string): MonthlyFeeEntry[];
