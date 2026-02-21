export declare const MEMBERSHIP_MONTHS: {
    readonly monthly: 1;
    readonly quarterly: 3;
    readonly yearly: 12;
    readonly custom: 0;
};
export type MembershipType = keyof typeof MEMBERSHIP_MONTHS;
export declare const PAYMENT_MAP: Record<string, string>;
export declare function durationToType(months: number): string;
