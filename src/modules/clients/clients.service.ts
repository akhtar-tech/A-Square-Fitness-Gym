import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto, MembershipType } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const MEMBERSHIP_MONTHS: Record<MembershipType, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
  custom: 0,
};

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  // ─── Calculate end date from start + plan ──────────────────────────
  private calcEndDate(startDate: Date, membershipType: MembershipType, customEndDate?: string): Date {
    if (membershipType === 'custom') {
      if (!customEndDate) throw new BadRequestException('endDate is required for custom membership');
      return new Date(customEndDate);
    }
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + MEMBERSHIP_MONTHS[membershipType]);
    return end;
  }

  // ─── CREATE ────────────────────────────────────────────────────────
  async create(userId: string, dto: CreateClientDto) {
    const startDate = new Date(dto.startDate);
    const endDate = this.calcEndDate(startDate, dto.membershipType, dto.endDate);

    // Auto-assign entry number if the caller didn't supply one.
    // Strategy: find the max numeric entry number among existing clients for
    // this user and increment by 1.  If none exist, start at 1.
    let entryNumber = dto.entryNumber;
    if (!entryNumber) {
      const existing = await this.prisma.client.findMany({
        where: { userId },
        select: { entryNumber: true },
      });
      const toNum = (entry: string | null | undefined): number => {
        if (!entry) return 0;
        const digits = entry.replace(/\D/g, '');
        return digits ? Number(digits) : 0;
      };
      const maxNum = existing.reduce((max, c) => {
        const n = toNum(c.entryNumber as string | null | undefined);
        return n > max ? n : max;
      }, 0);
      entryNumber = String(maxNum + 1);
    }

    // 1. Create the client record (no fee — that lives in payments)
    const client = await this.prisma.client.create({
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

    // 2. Always create an initial Payment record (even if amount = 0)
    await this.prisma.payment.create({
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
  }

  // ─── LIST ALL ─────────────────────────────────────────────────────
  async findAll(userId: string, query: { active?: string; search?: string }) {
    const where: Record<string, unknown> = { userId };

    if (query.active !== undefined) {
      where.isActive = query.active === 'true';
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { entryNumber: { contains: query.search, mode: 'insensitive' } },
      ];
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
    });

    // Sort by entry number numerically — high to low.
    // Clients without an entry number go to the end.
    const toNum = (entry: string | null | undefined): number => {
      if (!entry) return -1;
      const digits = entry.replaceAll(/\D/g, '');
      return digits ? Number(digits) : -1;
    };
    return clients.sort(
      (a, b) =>
        toNum(String(b.entryNumber ?? '')) - toNum(String(a.entryNumber ?? '')),
    );
  }

  // ─── GET ONE ──────────────────────────────────────────────────────
  async findOne(userId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, userId },
      include: {
        payments: {
          orderBy: { paidAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  // ─── UPDATE ───────────────────────────────────────────────────────
  async update(userId: string, clientId: string, dto: UpdateClientDto) {
    await this.findOne(userId, clientId);

    // Only allow updating identity/profile fields — plan/expiry come from payments
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.photoFilename !== undefined) data.photoFilename = dto.photoFilename;
    if (dto.entryNumber !== undefined) data.entryNumber = dto.entryNumber;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.client.update({ where: { id: clientId }, data });
  }

  // ─── DELETE ───────────────────────────────────────────────────────
  async remove(userId: string, clientId: string) {
    await this.findOne(userId, clientId);
    await this.prisma.client.delete({ where: { id: clientId } });
    return { message: 'Client deleted' };
  }

  // ─── EXPIRING SOON (next 7 days) ──────────────────────────────────
  async expiringSoon(userId: string) {
    const now = new Date();
    const in2Days = new Date();
    in2Days.setDate(now.getDate() + 2);

    return this.prisma.client.findMany({
      where: {
        userId,
        isActive: true,
        endDate: { gte: now, lte: in2Days },
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
}
