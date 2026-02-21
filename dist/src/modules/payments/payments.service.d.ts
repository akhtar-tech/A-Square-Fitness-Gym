import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Prisma } from '@prisma/client';
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
        membershipType: string | null;
        endDate: Date | null;
        createdAt: Date;
        userId: string;
        amount: Prisma.Decimal;
        method: import("@prisma/client").$Enums.PaymentMethod;
        note: string | null;
        paidAt: Date;
        clientId: string;
    }>;
    findAll(userId: string, query: {
        clientId?: string;
        month?: number;
        year?: number;
        skip?: number;
        take?: number;
    }): Promise<{
        data: ({
            client: {
                name: string;
                phone: string;
                entryNumber: string | null;
                photoFilename: string | null;
            };
        } & {
            id: string;
            membershipType: string | null;
            endDate: Date | null;
            createdAt: Date;
            userId: string;
            amount: Prisma.Decimal;
            method: import("@prisma/client").$Enums.PaymentMethod;
            note: string | null;
            paidAt: Date;
            clientId: string;
        })[];
        total: number;
        skip: number;
        take: number;
        hasMore: boolean;
    }>;
    findOne(userId: string, paymentId: string): Promise<{
        client: {
            name: string;
            phone: string;
            entryNumber: string | null;
            photoFilename: string | null;
        };
    } & {
        id: string;
        membershipType: string | null;
        endDate: Date | null;
        createdAt: Date;
        userId: string;
        amount: Prisma.Decimal;
        method: import("@prisma/client").$Enums.PaymentMethod;
        note: string | null;
        paidAt: Date;
        clientId: string;
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
        membershipType: string | null;
        endDate: Date | null;
        createdAt: Date;
        userId: string;
        amount: Prisma.Decimal;
        method: import("@prisma/client").$Enums.PaymentMethod;
        note: string | null;
        paidAt: Date;
        clientId: string;
    }>;
    remove(userId: string, paymentId: string): Promise<{
        message: string;
    }>;
}
