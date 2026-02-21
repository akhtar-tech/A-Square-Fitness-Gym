import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
export declare class ExpensesController {
    private expensesService;
    constructor(expensesService: ExpensesService);
    create(user: {
        id: string;
    }, dto: CreateExpenseDto): Promise<{
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
    findAll(user: {
        id: string;
    }, query: {
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
    findOne(user: {
        id: string;
    }, id: string): Promise<{
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
    update(user: {
        id: string;
    }, id: string, dto: UpdateExpenseDto): Promise<{
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
    remove(user: {
        id: string;
    }, id: string): Promise<{
        message: string;
    }>;
}
