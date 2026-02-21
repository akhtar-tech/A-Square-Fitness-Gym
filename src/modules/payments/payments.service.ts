import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentMethod } from '@prisma/client';

const MEMBERSHIP_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreatePaymentDto) {
    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, userId },
    });
    if (!client) throw new NotFoundException('Client not found');

    // ── Compute new endDate and plan if membership is being extended ──
    let newMembershipType: string | null = null;
    let newEndDate: Date | null = null;

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

    // ── Create the payment (stores its own plan + endDate snapshot) ──
    const payment = await this.prisma.payment.create({
      data: {
        amount: dto.amount,
        method: (dto.method as PaymentMethod) ?? 'CASH',
        note: dto.note,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        membershipType: newMembershipType,
        endDate: newEndDate,
        clientId: dto.clientId,
        userId,
      },
      include: { client: { select: { name: true, phone: true, photoFilename: true, entryNumber: true } } },
    });

    // ── Sync client cache ──────────────────────────────────────────
    const clientUpdate: Record<string, unknown> = {};
    if (newMembershipType && newEndDate) {
      clientUpdate.membershipType = newMembershipType;
      clientUpdate.endDate = newEndDate;
      clientUpdate.isActive = true;
    }

    // Always sync endDate/membershipType cache if we changed them
    if (Object.keys(clientUpdate).length > 0) {
      await this.prisma.client.update({
        where: { id: dto.clientId },
        data: clientUpdate,
      });
    }

    return payment;
  }

  async findAll(
  userId: string,
  query: { clientId?: string; month?: string; year?: string },
) {
  const where: any = { userId };

  if (query.clientId) where.clientId = query.clientId;

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
        paidAt: p._max.paidAt!,
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


  async findOne(userId: string, paymentId: string) {
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
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  // ─── UPDATE (amount / method / note / date only) ──────────────────
  async update(userId: string, paymentId: string, dto: UpdatePaymentDto) {
    await this.findOne(userId, paymentId);

    const data: Record<string, unknown> = {};
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.method !== undefined) data.method = dto.method as PaymentMethod;
    if (dto.note !== undefined) data.note = dto.note;
    if (dto.paidAt !== undefined) data.paidAt = new Date(dto.paidAt);

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

  async remove(userId: string, paymentId: string) {
    const payment = await this.findOne(userId, paymentId);
    const { clientId } = payment;

    await this.prisma.payment.delete({ where: { id: paymentId } });

    // ── Restore client cache from the new last payment ─────────────
    const prev = await this.prisma.payment.findFirst({
      where: { clientId, userId },
      orderBy: { paidAt: 'desc' },
    });

    if (prev) {
      // Restore to whatever the previous payment stored
      const restore: Record<string, unknown> = {};
      if (prev.membershipType && prev.endDate) {
        restore.membershipType = prev.membershipType;
        restore.endDate = prev.endDate;
      }
      if (Object.keys(restore).length > 0) {
        await this.prisma.client.update({ where: { id: clientId }, data: restore });
      }
    }
    // If no payments remain the client fields stay as-is (manual correction if needed)

    return { message: 'Payment deleted' };
  }
}
