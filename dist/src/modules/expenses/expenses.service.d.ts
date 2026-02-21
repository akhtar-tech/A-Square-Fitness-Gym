import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
export declare class ExpensesService {
    private prisma;
    constructor(prisma: PrismaService);
    create(userId: string, dto: CreateExpenseDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        date: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        title: string;
        category: import("@prisma/client").$Enums.ExpenseCategory;
        description: string | null;
    }>;
    findAll(userId: string, query: {
        month?: number;
        year?: number;
        category?: string;
    }): Promise<{
        expenses: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            date: Date;
            amount: import("@prisma/client/runtime/library").Decimal;
            title: string;
            category: import("@prisma/client").$Enums.ExpenseCategory;
            description: string | null;
        }[];
        total: number;
    }>;
    findOne(userId: string, expenseId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        date: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        title: string;
        category: import("@prisma/client").$Enums.ExpenseCategory;
        description: string | null;
    }>;
    update(userId: string, expenseId: string, dto: UpdateExpenseDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        date: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        title: string;
        category: import("@prisma/client").$Enums.ExpenseCategory;
        description: string | null;
    }>;
    remove(userId: string, expenseId: string): Promise<{
        message: string;
    }>;
}
