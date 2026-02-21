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
exports.ExpensesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let ExpensesService = class ExpensesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(userId, dto) {
        return this.prisma.expense.create({
            data: {
                title: dto.title,
                amount: dto.amount,
                category: dto.category,
                description: dto.description,
                date: dto.date ? new Date(dto.date) : new Date(),
                userId,
            },
        });
    }
    async findAll(userId, query) {
        const where = { userId };
        if (query.category) {
            where.category = query.category;
        }
        if (query.month && query.year) {
            const start = new Date(query.year, query.month - 1, 1);
            const end = new Date(query.year, query.month, 1);
            where.date = { gte: start, lt: end };
        }
        const expenses = await this.prisma.expense.findMany({
            where,
            orderBy: { date: 'desc' },
        });
        const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
        return { expenses, total };
    }
    async findOne(userId, expenseId) {
        const expense = await this.prisma.expense.findFirst({
            where: { id: expenseId, userId },
        });
        if (!expense) {
            throw new common_1.NotFoundException('Expense not found');
        }
        return expense;
    }
    async update(userId, expenseId, dto) {
        await this.findOne(userId, expenseId);
        return this.prisma.expense.update({
            where: { id: expenseId },
            data: {
                ...dto,
                category: dto.category,
                date: dto.date ? new Date(dto.date) : undefined,
            },
        });
    }
    async remove(userId, expenseId) {
        await this.findOne(userId, expenseId);
        await this.prisma.expense.delete({ where: { id: expenseId } });
        return { message: 'Expense deleted' };
    }
};
exports.ExpensesService = ExpensesService;
exports.ExpensesService = ExpensesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ExpensesService);
//# sourceMappingURL=expenses.service.js.map