export declare class CreatePaymentDto {
    clientId: string;
    amount: number;
    method?: 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER';
    note?: string;
    paidAt?: string;
    extendMembership: 'none' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
    newEndDate?: string;
}
