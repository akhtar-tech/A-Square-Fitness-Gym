"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let DashboardService = class DashboardService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getStats(userId) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const in7Days = new Date();
        in7Days.setDate(now.getDate() + 7);
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const [totalClients, activeClients, expiredClients, newClientsThisMonth, monthlyRevenue, totalRevenue, monthlyExpenses, expiringSoon, expiresToday,] = await Promise.all([
            this.prisma.client.count({ where: { userId } }),
            this.prisma.client.count({ where: { userId, isActive: true } }),
            this.prisma.client.count({ where: { userId, isActive: false } }),
            this.prisma.client.count({
                where: { userId, createdAt: { gte: startOfMonth } },
            }),
            this.prisma.payment.aggregate({
                where: {
                    userId,
                    paidAt: { gte: startOfMonth, lt: startOfNextMonth },
                },
                _sum: { amount: true },
            }),
            this.prisma.payment.aggregate({
                where: { userId },
                _sum: { amount: true },
            }),
            this.prisma.expense.aggregate({
                where: {
                    userId,
                    date: { gte: startOfMonth, lt: startOfNextMonth },
                },
                _sum: { amount: true },
            }),
            this.prisma.client.count({
                where: {
                    userId,
                    isActive: true,
                    endDate: { gte: now, lte: in7Days },
                },
            }),
            this.prisma.client.count({
                where: {
                    userId,
                    isActive: true,
                    endDate: { gte: startOfToday, lt: startOfTomorrow },
                },
            }),
        ]);
        const monthlyRevenueNum = Number(monthlyRevenue._sum.amount ?? 0);
        const monthlyExpensesNum = Number(monthlyExpenses._sum.amount ?? 0);
        return {
            clients: {
                total: totalClients,
                active: activeClients,
                expired: expiredClients,
                newThisMonth: newClientsThisMonth,
                expiringSoon,
                expiresToday,
            },
            revenue: {
                thisMonth: monthlyRevenueNum,
                allTime: Number(totalRevenue._sum.amount ?? 0),
            },
            expenses: {
                thisMonth: monthlyExpensesNum,
            },
            profit: {
                thisMonth: monthlyRevenueNum - monthlyExpensesNum,
            },
        };
    }
    async getMonthlyTrend(userId, months = 6) {
        const result = [];
        for (let i = months - 1; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const start = new Date(date.getFullYear(), date.getMonth(), 1);
            const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
            const [rev, exp, clients] = await Promise.all([
                this.prisma.payment.aggregate({
                    where: { userId, paidAt: { gte: start, lt: end } },
                    _sum: { amount: true },
                }),
                this.prisma.expense.aggregate({
                    where: { userId, date: { gte: start, lt: end } },
                    _sum: { amount: true },
                }),
                this.prisma.client.count({
                    where: { userId, createdAt: { gte: start, lt: end } },
                }),
            ]);
            result.push({
                month: start.toISOString().slice(0, 7),
                revenue: Number(rev._sum.amount ?? 0),
                expenses: Number(exp._sum.amount ?? 0),
                newClients: clients,
            });
        }
        return result;
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map