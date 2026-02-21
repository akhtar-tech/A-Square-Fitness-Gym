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
        userId: string;
        entryNumber: string | null;
        photoFilename: string | null;
    }>;
    findAll(userId: string, query: {
        active?: string;
        search?: string;
        skip?: number;
        take?: number;
    }, from: string): Promise<{
        data: ({
            payments: {
                id: string;
                membershipType: string | null;
                endDate: Date | null;
                amount: import("@prisma/client/runtime/library").Decimal;
                method: import("@prisma/client").$Enums.PaymentMethod;
                note: string | null;
                paidAt: Date;
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
            userId: string;
            entryNumber: string | null;
            photoFilename: string | null;
        })[];
        total: number;
        currentTabTotal: number;
        expiringTodayTotal: number;
        expiredTotal: number;
        expiringSoonTotal: number;
        skip: number;
        take: number;
        hasMore: boolean;
    }>;
    findOne(userId: string, clientId: string): Promise<{
        payments: {
            id: string;
            membershipType: string | null;
            endDate: Date | null;
            createdAt: Date;
            userId: string;
            amount: import("@prisma/client/runtime/library").Decimal;
            method: import("@prisma/client").$Enums.PaymentMethod;
            note: string | null;
            paidAt: Date;
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
        userId: string;
        entryNumber: string | null;
        photoFilename: string | null;
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
        userId: string;
        entryNumber: string | null;
        photoFilename: string | null;
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
    expiringToday(userId: string): Promise<{
        id: string;
        name: string;
        phone: string;
        membershipType: string;
        endDate: Date;
    }[]>;
    expired(userId: string): Promise<{
        id: string;
        name: string;
        phone: string;
        membershipType: string;
        endDate: Date;
    }[]>;
}
