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
exports.ClientsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const membership_constants_1 = require("../../common/constants/membership.constants");
let ClientsService = class ClientsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    calcEndDate(startDate, membershipType, customEndDate) {
        if (membershipType === 'custom') {
            if (!customEndDate)
                throw new common_1.BadRequestException('endDate is required for custom membership');
            return new Date(customEndDate);
        }
        const end = new Date(startDate);
        end.setMonth(end.getMonth() + membership_constants_1.MEMBERSHIP_MONTHS[membershipType]);
        return end;
    }
    async create(userId, dto) {
        const startDate = new Date(dto.startDate);
        const endDate = this.calcEndDate(startDate, dto.membershipType, dto.endDate);
        let entryNumber = dto.entryNumber;
        if (!entryNumber) {
            const existing = await this.prisma.client.findMany({
                where: { userId },
                select: { entryNumber: true },
            });
            const toNum = (entry) => {
                if (!entry)
                    return 0;
                const digits = entry.replace(/\D/g, '');
                return digits ? Number(digits) : 0;
            };
            const maxNum = existing.reduce((max, c) => {
                const n = toNum(c.entryNumber);
                return n > max ? n : max;
            }, 0);
            entryNumber = String(maxNum + 1);
        }
        return await this.prisma.$transaction(async (tx) => {
            const client = await tx.client.create({
                data: {
                    name: dto.name,
                    phone: dto.phone,
                    email: dto.email,
                    membershipType: dto.membershipType,
                    startDate,
                    endDate,
                    notes: dto.notes,
                    photoFilename: dto.photoFilename,
                    entryNumber: `A${entryNumber}`,
                    userId,
                },
            });
            await tx.payment.create({
                data: {
                    userId,
                    clientId: client.id,
                    amount: dto.initialAmount,
                    method: dto.initialPaymentMethod ?? 'CASH',
                    paidAt: startDate,
                    membershipType: dto.membershipType,
                    endDate,
                    note: 'Initial payment',
                },
            });
            return client;
        });
    }
    async findAll(userId, query, from) {
        const now = new Date();
        const baseWhere = { userId };
        if (query.active !== undefined) {
            baseWhere.isActive = query.active === 'true';
        }
        if (query.search) {
            baseWhere.OR = [
                { name: { contains: query.search, mode: 'insensitive' } },
                { phone: { contains: query.search, mode: 'insensitive' } },
                { entryNumber: { contains: query.search, mode: 'insensitive' } },
            ];
        }
        const total = await this.prisma.client.count({ where: baseWhere });
        const where = { ...baseWhere };
        let currentTabTotal = total;
        if (from === 'expiring_today') {
            const startOfDay = new Date(now);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(now);
            endOfDay.setHours(23, 59, 59, 999);
            where.endDate = { gte: startOfDay, lte: endOfDay };
            where.isActive = true;
        }
        else if (from === 'expiring_soon') {
            const startOfToday = new Date(now);
            startOfToday.setHours(0, 0, 0, 0);
            const in2Days = new Date(startOfToday);
            in2Days.setDate(startOfToday.getDate() + 2);
            in2Days.setHours(23, 59, 59, 999);
            where.endDate = { gte: startOfToday, lte: in2Days };
            where.isActive = true;
        }
        else if (from === 'expired') {
            const startOfToday = new Date(now);
            startOfToday.setHours(0, 0, 0, 0);
            where.endDate = { lt: startOfToday };
            where.isActive = true;
        }
        if (from !== 'all') {
            currentTabTotal = await this.prisma.client.count({ where });
        }
        let orderBy;
        if (from === 'expired') {
            orderBy = { endDate: 'desc' };
        }
        else if (from === 'expiring_soon' || from === 'expiring_today') {
            orderBy = { endDate: 'asc' };
        }
        const clients = await this.prisma.client.findMany({
            where,
            include: {
                payments: {
                    orderBy: { paidAt: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        amount: true,
                        paidAt: true,
                        method: true,
                        note: true,
                        membershipType: true,
                        endDate: true,
                    },
                },
            },
            skip: query.skip ?? 0,
            take: query.take ?? 50,
            orderBy,
        });
        const toNum = (entry) => {
            if (!entry)
                return -1;
            const digits = entry.replaceAll(/\D/g, '');
            return digits ? Number(digits) : -1;
        };
        const sorted = from === 'all'
            ? clients.toSorted((a, b) => toNum(String(b.entryNumber ?? '')) -
                toNum(String(a.entryNumber ?? '')))
            : clients;
        const badgeCountWhere = { userId };
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);
        const in2Days = new Date(startOfToday);
        in2Days.setDate(startOfToday.getDate() + 2);
        in2Days.setHours(23, 59, 59, 999);
        const [expiringTodayTotal, expiredTotal, expiringSoonTotal] = await Promise.all([
            this.prisma.client.count({
                where: {
                    ...badgeCountWhere,
                    isActive: true,
                    endDate: { gte: startOfToday, lte: endOfToday },
                },
            }),
            this.prisma.client.count({
                where: {
                    ...badgeCountWhere,
                    isActive: true,
                    endDate: { lt: startOfToday },
                },
            }),
            this.prisma.client.count({
                where: {
                    ...badgeCountWhere,
                    isActive: true,
                    endDate: { gte: startOfToday, lte: in2Days },
                },
            }),
        ]);
        return {
            data: sorted,
            total,
            currentTabTotal,
            expiringTodayTotal,
            expiredTotal,
            expiringSoonTotal,
            skip: query.skip ?? 0,
            take: query.take ?? 50,
            hasMore: (query.skip ?? 0) + sorted.length < currentTabTotal,
        };
    }
    async findOne(userId, clientId) {
        const client = await this.prisma.client.findFirst({
            where: { id: clientId, userId },
            include: {
                payments: {
                    orderBy: { paidAt: 'desc' },
                    take: 10,
                },
            },
        });
        if (!client)
            throw new common_1.NotFoundException('Client not found');
        return client;
    }
    async update(userId, clientId, dto) {
        await this.findOne(userId, clientId);
        const data = {};
        if (dto.name !== undefined)
            data.name = dto.name;
        if (dto.phone !== undefined)
            data.phone = dto.phone;
        if (dto.email !== undefined)
            data.email = dto.email;
        if (dto.notes !== undefined)
            data.notes = dto.notes;
        if (dto.photoFilename !== undefined)
            data.photoFilename = dto.photoFilename;
        if (dto.entryNumber !== undefined)
            data.entryNumber = dto.entryNumber;
        if (dto.isActive !== undefined)
            data.isActive = dto.isActive;
        return this.prisma.client.update({ where: { id: clientId }, data });
    }
    async remove(userId, clientId) {
        await this.findOne(userId, clientId);
        await this.prisma.client.delete({ where: { id: clientId } });
        return { message: 'Client deleted' };
    }
    async expiringSoon(userId) {
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const in2Days = new Date(startOfToday);
        in2Days.setDate(startOfToday.getDate() + 2);
        in2Days.setHours(23, 59, 59, 999);
        return this.prisma.client.findMany({
            where: {
                userId,
                isActive: true,
                endDate: { gte: startOfToday, lte: in2Days },
            },
            orderBy: { endDate: 'asc' },
            select: {
                id: true,
                name: true,
                phone: true,
                endDate: true,
                membershipType: true,
            },
        });
    }
    async expiringToday(userId) {
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);
        return this.prisma.client.findMany({
            where: {
                userId,
                isActive: true,
                endDate: { gte: startOfDay, lte: endOfDay },
            },
            orderBy: { endDate: 'asc' },
            select: {
                id: true,
                name: true,
                phone: true,
                endDate: true,
                membershipType: true,
            },
        });
    }
    async expired(userId) {
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        return this.prisma.client.findMany({
            where: {
                userId,
                isActive: true,
                endDate: { lt: startOfToday },
            },
            orderBy: { endDate: 'desc' },
            select: {
                id: true,
                name: true,
                phone: true,
                endDate: true,
                membershipType: true,
            },
        });
    }
};
exports.ClientsService = ClientsService;
exports.ClientsService = ClientsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ClientsService);
//# sourceMappingURL=clients.service.js.map