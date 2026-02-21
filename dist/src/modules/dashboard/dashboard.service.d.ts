import { PrismaService } from '../../prisma/prisma.service';
export declare class DashboardService {
    private prisma;
    constructor(prisma: PrismaService);
    getStats(userId: string): Promise<{
        clients: {
            total: number;
            active: number;
            expired: number;
            newThisMonth: number;
            expiringSoon: number;
            expiresToday: number;
        };
        revenue: {
            thisMonth: number;
            allTime: number;
        };
        expenses: {
            thisMonth: number;
        };
        profit: {
            thisMonth: number;
        };
    }>;
    getMonthlyTrend(userId: string, months?: number): Promise<{
        month: string;
        revenue: number;
        expenses: number;
        newClients: number;
    }[]>;
}
