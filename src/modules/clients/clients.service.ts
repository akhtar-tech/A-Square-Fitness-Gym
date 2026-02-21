import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto, MembershipType } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { MEMBERSHIP_MONTHS } from '../../common/constants/membership.constants';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  // ─── Calculate end date from start + plan ──────────────────────────
  private calcEndDate(
    startDate: Date,
    membershipType: MembershipType,
    customEndDate?: string,
  ): Date {
    if (membershipType === 'custom') {
      if (!customEndDate)
        throw new BadRequestException(
          'endDate is required for custom membership',
        );
      return new Date(customEndDate);
    }
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + MEMBERSHIP_MONTHS[membershipType]);
    return end;
  }

  // ─── CREATE ────────────────────────────────────────────────────────
  async create(userId: string, dto: CreateClientDto) {
    const startDate = new Date(dto.startDate);
    const endDate = this.calcEndDate(
      startDate,
      dto.membershipType,
      dto.endDate,
    );

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

    // Use transaction to ensure client + payment are created atomically
    return await this.prisma.$transaction(async (tx) => {
      // 1. Create the client record (no fee — that lives in payments)
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

      // 2. Always create an initial Payment record (even if amount = 0)
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

  // ─── LIST ALL ─────────────────────────────────────────────────────
  async findAll(
    userId: string,
    query: { active?: string; search?: string; skip?: number; take?: number },
    from: string,
  ) {
    const now = new Date();

    // Build base where clause (userId + search + active filters only)
    const baseWhere: Record<string, unknown> = { userId };

    // Apply active filter if specified
    if (query.active !== undefined) {
      baseWhere.isActive = query.active === 'true';
    }

    // Apply search filter if specified
    if (query.search) {
      baseWhere.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { entryNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Get total count from base filters (WITHOUT date filter)
    // This represents the total count for the "All" tab with current search/active filters
    const total = await this.prisma.client.count({ where: baseWhere });

    // Clone baseWhere for adding date filters
    const where = { ...baseWhere };
    let currentTabTotal = total; // By default, same as total (for "all" tab)

    // Apply date filter based on the 'from' parameter
    if (from === 'expiring_today') {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0); // Start of today (00:00:00)
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999); // End of today (23:59:59)
      where.endDate = { gte: startOfDay, lte: endOfDay };
      where.isActive = true; // Only active clients
    } else if (from === 'expiring_soon') {
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const in2Days = new Date(startOfToday);
      in2Days.setDate(startOfToday.getDate() + 2);
      in2Days.setHours(23, 59, 59, 999);
      where.endDate = { gte: startOfToday, lte: in2Days };
      where.isActive = true; // Only active clients
    } else if (from === 'expired') {
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      where.endDate = { lt: startOfToday }; // Before today (before 00:00:00)
      where.isActive = true; // Only active clients
    }

    // Get count for current tab (with date filters applied)
    if (from !== 'all') {
      currentTabTotal = await this.prisma.client.count({ where });
    }

    // Determine orderBy based on the 'from' parameter
    let orderBy: { endDate: 'asc' | 'desc' } | undefined;
    if (from === 'expired') {
      orderBy = { endDate: 'desc' };
    } else if (from === 'expiring_soon' || from === 'expiring_today') {
      orderBy = { endDate: 'asc' };
    }

    // Fetch clients with pagination
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

    // Sort by entry number numerically — high to low (only for 'all' tab)
    // Clients without an entry number go to the end.
    const toNum = (entry: string | null | undefined): number => {
      if (!entry) return -1;
      const digits = entry.replaceAll(/\D/g, '');
      return digits ? Number(digits) : -1;
    };

    const sorted =
      from === 'all'
        ? clients.toSorted(
            (a, b) =>
              toNum(String(b.entryNumber ?? '')) -
              toNum(String(a.entryNumber ?? '')),
          )
        : clients;

    // Get counts for all tabs (without search/active filters for accurate badge counts)
    const badgeCountWhere = { userId };

    // Calculate date boundaries for badge counts
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const in2Days = new Date(startOfToday);
    in2Days.setDate(startOfToday.getDate() + 2);
    in2Days.setHours(23, 59, 59, 999);

    const [expiringTodayTotal, expiredTotal, expiringSoonTotal] =
      await Promise.all([
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
      total, // Total count for "All" tab (with search/active filters)
      currentTabTotal, // Total count for current active tab (with all filters including date)
      expiringTodayTotal,
      expiredTotal,
      expiringSoonTotal,
      skip: query.skip ?? 0,
      take: query.take ?? 50,
      hasMore: (query.skip ?? 0) + sorted.length < currentTabTotal,
    };
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

  // ─── EXPIRING SOON (next 2 days) ──────────────────────────────────
  async expiringSoon(userId: string) {
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

  // ─── EXPIRING today  ──────────────────────────────────
  async expiringToday(userId: string) {
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

  // ─── EXPIRED  ──────────────────────────────────
  async expired(userId: string) {
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
}
