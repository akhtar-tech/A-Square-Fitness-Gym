import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private dashboardService;
    constructor(dashboardService: DashboardService);
    getStats(user: {
        id: string;
    }): Promise<{
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
    getMonthlyTrend(user: {
        id: string;
    }, months?: string): Promise<{
        month: string;
        revenue: number;
        expenses: number;
        newClients: number;
    }[]>;
}
