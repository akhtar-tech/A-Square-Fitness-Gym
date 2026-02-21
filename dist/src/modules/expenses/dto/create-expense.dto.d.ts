export type ExpenseCategoryType = 'RENT' | 'UTILITIES' | 'EQUIPMENT' | 'SALARIES' | 'MAINTENANCE' | 'MARKETING' | 'OTHER';
export declare class CreateExpenseDto {
    title: string;
    amount: number;
    category: ExpenseCategoryType;
    description?: string;
    date?: string;
}
