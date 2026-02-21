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
export declare class WhatsAppParserService {
    parse(rawText: string): ParsedEntry[];
    private detectFmt;
    private parseMessages;
    private buildEntries;
    private extractNamePhone;
    private extractAddress;
    private extractFees;
    extractNameFromFeesMessage(text: string): string | null;
    private hasFees;
    private parseTs;
}
