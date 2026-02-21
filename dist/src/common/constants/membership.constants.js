"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_MAP = exports.MEMBERSHIP_MONTHS = void 0;
exports.durationToType = durationToType;
exports.MEMBERSHIP_MONTHS = {
    monthly: 1,
    quarterly: 3,
    yearly: 12,
    custom: 0,
};
exports.PAYMENT_MAP = {
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
function durationToType(months) {
    if (months === 1)
        return 'monthly';
    if (months === 3)
        return 'quarterly';
    if (months === 12)
        return 'yearly';
    return 'custom';
}
//# sourceMappingURL=membership.constants.js.map