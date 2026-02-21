export const MEMBERSHIP_MONTHS = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
  custom: 0,
} as const;

export type MembershipType = keyof typeof MEMBERSHIP_MONTHS;

export const PAYMENT_MAP: Record<string, string> = {
  online: 'UPI',
  upi: 'UPI',
  gpay: 'UPI',
  phonepe: 'UPI',
  paytm: 'UPI',
  card: 'CARD',
  cash: 'CASH',
  bank: 'BANK_TRANSFER',
  neft: 'BANK_TRANSFER',
  imps: 'BANK_TRANSFER',
  split: 'CASH',
};

export function durationToType(months: number): string {
  if (months === 1) return 'monthly';
  if (months === 3) return 'quarterly';
  if (months === 12) return 'yearly';
  return 'custom';
}
