import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { QueryClientDto } from './dto/query-client.dto';
export declare class ClientsController {
    private clientsService;
    constructor(clientsService: ClientsService);
    uploadPhoto(file: Express.Multer.File): {
        filename: string;
    };
    create(user: {
        id: string;
    }, dto: CreateClientDto): Promise<{
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
    findAll(user: {
        id: string;
    }, query: QueryClientDto): Promise<{
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
    expiringSoon(user: {
        id: string;
    }): Promise<{
        id: string;
        name: string;
        phone: string;
        membershipType: string;
        endDate: Date;
    }[]>;
    findOne(user: {
        id: string;
    }, id: string): Promise<{
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
    update(user: {
        id: string;
    }, id: string, dto: UpdateClientDto): Promise<{
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
    remove(user: {
        id: string;
    }, id: string): Promise<{
        message: string;
    }>;
}
