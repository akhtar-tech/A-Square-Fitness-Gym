import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';
export declare class PaymentsController {
    private paymentsService;
    constructor(paymentsService: PaymentsService);
    create(user: {
        id: string;
    }, dto: CreatePaymentDto): Promise<{
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
        amount: import("@prisma/client/runtime/library").Decimal;
        method: import("@prisma/client").$Enums.PaymentMethod;
        note: string | null;
        paidAt: Date;
        clientId: string;
    }>;
    findAll(user: {
        id: string;
    }, query: QueryPaymentDto): Promise<{
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
            amount: import("@prisma/client/runtime/library").Decimal;
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
    findOne(user: {
        id: string;
    }, id: string): Promise<{
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
        amount: import("@prisma/client/runtime/library").Decimal;
        method: import("@prisma/client").$Enums.PaymentMethod;
        note: string | null;
        paidAt: Date;
        clientId: string;
    }>;
    update(user: {
        id: string;
    }, id: string, dto: UpdatePaymentDto): Promise<{
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
        amount: import("@prisma/client/runtime/library").Decimal;
        method: import("@prisma/client").$Enums.PaymentMethod;
        note: string | null;
        paidAt: Date;
        clientId: string;
    }>;
    remove(user: {
        id: string;
    }, id: string): Promise<{
        message: string;
    }>;
}
