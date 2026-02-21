export type MembershipType = 'monthly' | 'quarterly' | 'yearly' | 'custom';
export declare class CreateClientDto {
    name: string;
    phone: string;
    email?: string;
    membershipType: MembershipType;
    initialAmount: number;
    initialPaymentMethod?: 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER';
    startDate: string;
    endDate?: string;
    notes?: string;
    photoFilename?: string;
    entryNumber?: string;
}
