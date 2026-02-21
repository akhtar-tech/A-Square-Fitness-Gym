import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
export declare class ClientsService {
    private prisma;
    constructor(prisma: PrismaService);
    private calcEndDate;
    create(userId: string, dto: CreateClientDto): Promise<{
        id: string;
        name: string;
        phone: string;
        email: string | null;
        membershipType: string;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
        entryNumber: string | null;
        photoFilename: string | null;
        userId: string;
    }>;
    findAll(userId: string, query: {
        active?: string;
        search?: string;
    }): Promise<({
        payments: {
            id: string;
            membershipType: string | null;
            endDate: Date | null;
            paidAt: Date;
            amount: import("@prisma/client/runtime/library").Decimal;
            method: import("@prisma/client").$Enums.PaymentMethod;
            note: string | null;
        }[];
    } & {
        id: string;
        name: string;
        phone: string;
        email: string | null;
        membershipType: string;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
        entryNumber: string | null;
        photoFilename: string | null;
        userId: string;
    })[]>;
    findOne(userId: string, clientId: string): Promise<{
        payments: {
            id: string;
            membershipType: string | null;
            endDate: Date | null;
            createdAt: Date;
            userId: string;
            paidAt: Date;
            amount: import("@prisma/client/runtime/library").Decimal;
            method: import("@prisma/client").$Enums.PaymentMethod;
            note: string | null;
            clientId: string;
        }[];
    } & {
        id: string;
        name: string;
        phone: string;
        email: string | null;
        membershipType: string;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
        entryNumber: string | null;
        photoFilename: string | null;
        userId: string;
    }>;
    update(userId: string, clientId: string, dto: UpdateClientDto): Promise<{
        id: string;
        name: string;
        phone: string;
        email: string | null;
        membershipType: string;
        startDate: Date;
        endDate: Date;
        isActive: boolean;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
        entryNumber: string | null;
        photoFilename: string | null;
        userId: string;
    }>;
    remove(userId: string, clientId: string): Promise<{
        message: string;
    }>;
    expiringSoon(userId: string): Promise<{
        id: string;
        name: string;
        phone: string;
        membershipType: string;
        endDate: Date;
    }[]>;
}
