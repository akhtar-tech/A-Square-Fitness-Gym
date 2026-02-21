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
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const MEMBERSHIP_MONTHS = {
    monthly: 1,
    quarterly: 3,
    yearly: 12,
};
let PaymentsService = class PaymentsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(userId, dto) {
        const client = await this.prisma.client.findFirst({
            where: { id: dto.clientId, userId },
        });
        if (!client)
            throw new common_1.NotFoundException('Client not found');
        let newMembershipType = null;
        let newEndDate = null;
        if (dto.extendMembership !== 'none') {
            const currentEnd = client.endDate < new Date() ? new Date() : client.endDate;
            newEndDate =
                dto.extendMembership === 'custom' && dto.newEndDate
                    ? new Date(dto.newEndDate)
                    : (() => {
                        const d = new Date(currentEnd);
                        d.setMonth(d.getMonth() + (MEMBERSHIP_MONTHS[dto.extendMembership] ?? 1));
                        return d;
                    })();
            newMembershipType = dto.extendMembership;
        }
        const payment = await this.prisma.payment.create({
            data: {
                amount: dto.amount,
                method: dto.method ?? 'CASH',
                note: dto.note,
                paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
                membershipType: newMembershipType,
                endDate: newEndDate,
                clientId: dto.clientId,
                userId,
            },
            include: { client: { select: { name: true, phone: true, photoFilename: true, entryNumber: true } } },
        });
        const clientUpdate = {};
        if (newMembershipType && newEndDate) {
            clientUpdate.membershipType = newMembershipType;
            clientUpdate.endDate = newEndDate;
            clientUpdate.isActive = true;
        }
        if (Object.keys(clientUpdate).length > 0) {
            await this.prisma.client.update({
                where: { id: dto.clientId },
                data: clientUpdate,
            });
        }
        return payment;
    }
    async findAll(userId, query) {
        const where = { userId };
        if (query.clientId)
            where.clientId = query.clientId;
        if (query.month && query.year) {
            const start = new Date(+query.year, +query.month - 1, 1);
            const end = new Date(+query.year, +query.month, 1);
            where.paidAt = { gte: start, lt: end };
        }
        const latestPerClient = await this.prisma.payment.groupBy({
            by: ['clientId'],
            where,
            _max: { paidAt: true },
        });
        return this.prisma.payment.findMany({
            where: {
                OR: latestPerClient.map(p => ({
                    clientId: p.clientId,
                    paidAt: p._max.paidAt,
                })),
            },
            orderBy: { paidAt: 'desc' },
            include: {
                client: {
                    select: {
                        name: true,
                        phone: true,
                        photoFilename: true,
                        entryNumber: true,
                    },
                },
            },
        });
    }
    async findOne(userId, paymentId) {
        const payment = await this.prisma.payment.findFirst({
            where: { id: paymentId, userId },
            include: {
                client: {
                    select: {
                        name: true,
                        phone: true,
                        photoFilename: true,
                        entryNumber: true,
                    },
                },
            },
        });
        if (!payment)
            throw new common_1.NotFoundException('Payment not found');
        return payment;
    }
    async update(userId, paymentId, dto) {
        await this.findOne(userId, paymentId);
        const data = {};
        if (dto.amount !== undefined)
            data.amount = dto.amount;
        if (dto.method !== undefined)
            data.method = dto.method;
        if (dto.note !== undefined)
            data.note = dto.note;
        if (dto.paidAt !== undefined)
            data.paidAt = new Date(dto.paidAt);
        return this.prisma.payment.update({
            where: { id: paymentId },
            data,
            include: {
                client: {
                    select: {
                        name: true,
                        phone: true,
                        photoFilename: true,
                        entryNumber: true,
                    },
                },
            },
        });
    }
    async remove(userId, paymentId) {
        const payment = await this.findOne(userId, paymentId);
        const { clientId } = payment;
        await this.prisma.payment.delete({ where: { id: paymentId } });
        const prev = await this.prisma.payment.findFirst({
            where: { clientId, userId },
            orderBy: { paidAt: 'desc' },
        });
        if (prev) {
            const restore = {};
            if (prev.membershipType && prev.endDate) {
                restore.membershipType = prev.membershipType;
                restore.endDate = prev.endDate;
            }
            if (Object.keys(restore).length > 0) {
                await this.prisma.client.update({ where: { id: clientId }, data: restore });
            }
        }
        return { message: 'Payment deleted' };
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map