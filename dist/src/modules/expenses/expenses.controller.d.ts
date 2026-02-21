import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpenseDto } from './dto/query-expense.dto';
export declare class ExpensesController {
    private expensesService;
    constructor(expensesService: ExpensesService);
    create(user: {
        id: string;
    }, dto: CreateExpenseDto): Promise<{
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
    findAll(user: {
        id: string;
    }, query: QueryExpenseDto): Promise<{
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
    findOne(user: {
        id: string;
    }, id: string): Promise<{
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
    update(user: {
        id: string;
    }, id: string, dto: UpdateExpenseDto): Promise<{
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
    remove(user: {
        id: string;
    }, id: string): Promise<{
        message: string;
    }>;
}
