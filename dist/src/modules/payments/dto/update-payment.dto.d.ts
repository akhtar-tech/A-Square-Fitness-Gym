export declare class UpdatePaymentDto {
    amount?: number;
    method?: 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER';
    note?: string;
    paidAt?: string;
}
