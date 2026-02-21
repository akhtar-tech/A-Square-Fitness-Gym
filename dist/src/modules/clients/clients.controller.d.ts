import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
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
        entryNumber: string | null;
        photoFilename: string | null;
        userId: string;
    }>;
    findAll(user: {
        id: string;
    }, query: {
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
        entryNumber: string | null;
        photoFilename: string | null;
        userId: string;
    }>;
    remove(user: {
        id: string;
    }, id: string): Promise<{
        message: string;
    }>;
}
