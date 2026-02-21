import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
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
    findAll(user: {
        id: string;
    }, query: {
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
    remove(user: {
        id: string;
    }, id: string): Promise<{
        message: string;
    }>;
}
