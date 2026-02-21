import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
export declare class PaymentsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(userId: string, dto: CreatePaymentDto): Promise<{
        client: {
            name: string;
            phone: string;
            entryNumber: string | null;
            photoFilename: string | null;
        };
    } & {
        id: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        method: import("@prisma/client").$Enums.PaymentMethod;
        note: string | null;
        paidAt: Date;
        createdAt: Date;
        endDate: Date | null;
        membershipType: string | null;
        clientId: string;
        userId: string;
    }>;
    findAll(userId: string, query: {
        clientId?: string;
        month?: string;
        year?: string;
    }): Promise<({
        client: {
            name: string;
            phone: string;
            entryNumber: string | null;
            photoFilename: string | null;
        };
    } & {
        id: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        method: import("@prisma/client").$Enums.PaymentMethod;
        note: string | null;
        paidAt: Date;
        createdAt: Date;
        endDate: Date | null;
        membershipType: string | null;
        clientId: string;
        userId: string;
    })[]>;
    findOne(userId: string, paymentId: string): Promise<{
        client: {
            name: string;
            phone: string;
            entryNumber: string | null;
            photoFilename: string | null;
        };
    } & {
        id: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        method: import("@prisma/client").$Enums.PaymentMethod;
        note: string | null;
        paidAt: Date;
        createdAt: Date;
        endDate: Date | null;
        membershipType: string | null;
        clientId: string;
        userId: string;
    }>;
    update(userId: string, paymentId: string, dto: UpdatePaymentDto): Promise<{
        client: {
            name: string;
            phone: string;
            entryNumber: string | null;
            photoFilename: string | null;
        };
    } & {
        id: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        method: import("@prisma/client").$Enums.PaymentMethod;
        note: string | null;
        paidAt: Date;
        createdAt: Date;
        endDate: Date | null;
        membershipType: string | null;
        clientId: string;
        userId: string;
    }>;
    remove(userId: string, paymentId: string): Promise<{
        message: string;
    }>;
}
