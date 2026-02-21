import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const in7Days = new Date();
    in7Days.setDate(now.getDate() + 7);
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfTomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );

    // Run all queries in parallel
    const [
      totalClients,
      activeClients,
      expiredClients,
      newClientsThisMonth,
      monthlyRevenue,
      totalRevenue,
      monthlyExpenses,
      expiringSoon,
      expiresToday,
    ] = await Promise.all([
      // Total clients
      this.prisma.client.count({ where: { userId } }),

      // Active clients
      this.prisma.client.count({ where: { userId, isActive: true } }),

      // Expired / inactive clients
      this.prisma.client.count({ where: { userId, isActive: false } }),

      // New clients this month
      this.prisma.client.count({
        where: { userId, createdAt: { gte: startOfMonth } },
      }),

      // Revenue this month
      this.prisma.payment.aggregate({
        where: {
          userId,
          paidAt: { gte: startOfMonth, lt: startOfNextMonth },
        },
        _sum: { amount: true },
      }),

      // All-time revenue
      this.prisma.payment.aggregate({
        where: { userId },
        _sum: { amount: true },
      }),

      // Expenses this month
      this.prisma.expense.aggregate({
        where: {
          userId,
          date: { gte: startOfMonth, lt: startOfNextMonth },
        },
        _sum: { amount: true },
      }),

      // Clients expiring in next 7 days
      this.prisma.client.count({
        where: {
          userId,
          isActive: true,
          endDate: { gte: now, lte: in7Days },
        },
      }),

      // Clients whose membership expires today
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

  async getMonthlyTrend(userId: string, months = 6) {
    const result: Array<{
      month: string;
      revenue: number;
      expenses: number;
      newClients: number;
    }> = [];

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
        month: start.toISOString().slice(0, 7), // "YYYY-MM"
        revenue: Number(rev._sum.amount ?? 0),
        expenses: Number(exp._sum.amount ?? 0),
        newClients: clients,
      });
    }

    return result;
  }
}
