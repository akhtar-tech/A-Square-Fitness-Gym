import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseCategory } from '@prisma/client';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateExpenseDto) {
    return this.prisma.expense.create({
      data: {
        title: dto.title,
        amount: dto.amount,
        category: dto.category as ExpenseCategory,
        description: dto.description,
        date: dto.date ? new Date(dto.date) : new Date(),
        userId,
      },
    });
  }

  async findAll(
    userId: string,
    query: { month?: string; year?: string; category?: string },
  ) {
    const where: Record<string, unknown> = { userId };

    if (query.category) {
      where.category = query.category;
    }

    if (query.month && query.year) {
      const start = new Date(
        parseInt(query.year),
        parseInt(query.month) - 1,
        1,
      );
      const end = new Date(parseInt(query.year), parseInt(query.month), 1);
      where.date = { gte: start, lt: end };
    }

    const expenses = await this.prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    // Aggregate total
    const total = expenses.reduce(
      (sum, e) => sum + Number(e.amount),
      0,
    );

    return { expenses, total };
  }

  async findOne(userId: string, expenseId: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, userId },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return expense;
  }

  async update(userId: string, expenseId: string, dto: UpdateExpenseDto) {
    await this.findOne(userId, expenseId);

    return this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...dto,
        category: dto.category as ExpenseCategory | undefined,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  async remove(userId: string, expenseId: string) {
    await this.findOne(userId, expenseId);
    await this.prisma.expense.delete({ where: { id: expenseId } });
    return { message: 'Expense deleted' };
  }
}
