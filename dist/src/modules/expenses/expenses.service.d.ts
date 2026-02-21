import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
export declare class ExpensesService {
    private prisma;
    constructor(prisma: PrismaService);
    create(userId: string, dto: CreateExpenseDto): Promise<{
        date: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        title: string;
        category: import("@prisma/client").$Enums.ExpenseCategory;
        description: string | null;
    }>;
    findAll(userId: string, query: {
        month?: string;
        year?: string;
        category?: string;
    }): Promise<{
        expenses: {
            date: Date;
            amount: import("@prisma/client/runtime/library").Decimal;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            title: string;
            category: import("@prisma/client").$Enums.ExpenseCategory;
            description: string | null;
        }[];
        total: number;
    }>;
    findOne(userId: string, expenseId: string): Promise<{
        date: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        title: string;
        category: import("@prisma/client").$Enums.ExpenseCategory;
        description: string | null;
    }>;
    update(userId: string, expenseId: string, dto: UpdateExpenseDto): Promise<{
        date: Date;
        amount: import("@prisma/client/runtime/library").Decimal;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        title: string;
        category: import("@prisma/client").$Enums.ExpenseCategory;
        description: string | null;
    }>;
    remove(userId: string, expenseId: string): Promise<{
        message: string;
    }>;
}
