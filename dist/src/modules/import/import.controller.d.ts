import { ImportService } from './import.service';
import { ReviewImportDto } from './dto/review-import.dto';
import { ApproveImportDto } from './dto/approve-import.dto';
export declare class ImportController {
    private importService;
    constructor(importService: ImportService);
    importFromPath(user: {
        id: string;
    }, folderPath: string): Promise<{
        imported: number;
        skipped: number;
        autoApproved: number;
        needsReview: number;
    }>;
    uploadTxt(user: {
        id: string;
    }, file: Express.Multer.File): Promise<{
        imported: number;
        skipped: number;
        autoApproved: number;
        needsReview: number;
    }>;
    enrichFromEntry(user: {
        id: string;
    }, entryFolderPath: string): Promise<{
        processed: number;
        alreadyInDb: number;
        enriched: number;
        autoApproved: number;
        notFound: number;
    }>;
    findPending(user: {
        id: string;
    }): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        entryNumber: string | null;
        photoFilename: string | null;
        addressRaw: string | null;
        membershipDurationMonths: number;
        membershipAmount: import("@prisma/client/runtime/library").Decimal | null;
        paymentMode: string | null;
        joinDate: Date | null;
        sender: string | null;
        clientName: string | null;
        clientPhone: string | null;
        confidenceScore: number;
        needsManualReview: boolean;
        status: import("@prisma/client").$Enums.ImportStatus;
        reviewNote: string | null;
        reviewedAt: Date | null;
        resolvedClientId: string | null;
    }[]>;
    findAll(user: {
        id: string;
    }, status?: string): Promise<{
        entryNumber: string | null;
        count: number;
        records: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            entryNumber: string | null;
            photoFilename: string | null;
            addressRaw: string | null;
            membershipDurationMonths: number;
            membershipAmount: import("@prisma/client/runtime/library").Decimal | null;
            paymentMode: string | null;
            joinDate: Date | null;
            sender: string | null;
            clientName: string | null;
            clientPhone: string | null;
            confidenceScore: number;
            needsManualReview: boolean;
            status: import("@prisma/client").$Enums.ImportStatus;
            reviewNote: string | null;
            reviewedAt: Date | null;
            resolvedClientId: string | null;
        }[];
    }[]>;
    findOne(user: {
        id: string;
    }, id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        entryNumber: string | null;
        photoFilename: string | null;
        addressRaw: string | null;
        membershipDurationMonths: number;
        membershipAmount: import("@prisma/client/runtime/library").Decimal | null;
        paymentMode: string | null;
        joinDate: Date | null;
        sender: string | null;
        clientName: string | null;
        clientPhone: string | null;
        confidenceScore: number;
        needsManualReview: boolean;
        status: import("@prisma/client").$Enums.ImportStatus;
        reviewNote: string | null;
        reviewedAt: Date | null;
        resolvedClientId: string | null;
    }>;
    review(user: {
        id: string;
    }, id: string, dto: ReviewImportDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        entryNumber: string | null;
        photoFilename: string | null;
        addressRaw: string | null;
        membershipDurationMonths: number;
        membershipAmount: import("@prisma/client/runtime/library").Decimal | null;
        paymentMode: string | null;
        joinDate: Date | null;
        sender: string | null;
        clientName: string | null;
        clientPhone: string | null;
        confidenceScore: number;
        needsManualReview: boolean;
        status: import("@prisma/client").$Enums.ImportStatus;
        reviewNote: string | null;
        reviewedAt: Date | null;
        resolvedClientId: string | null;
    }>;
    approve(user: {
        id: string;
    }, id: string, dto: ApproveImportDto): Promise<{
        message: string;
        clientId: string;
    }>;
    reject(user: {
        id: string;
    }, id: string, note?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        entryNumber: string | null;
        photoFilename: string | null;
        addressRaw: string | null;
        membershipDurationMonths: number;
        membershipAmount: import("@prisma/client/runtime/library").Decimal | null;
        paymentMode: string | null;
        joinDate: Date | null;
        sender: string | null;
        clientName: string | null;
        clientPhone: string | null;
        confidenceScore: number;
        needsManualReview: boolean;
        status: import("@prisma/client").$Enums.ImportStatus;
        reviewNote: string | null;
        reviewedAt: Date | null;
        resolvedClientId: string | null;
    }>;
}
