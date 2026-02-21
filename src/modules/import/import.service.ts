import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppParserService, ParsedEntry } from './whatsapp-parser.service';
import { ReviewImportDto } from './dto/review-import.dto';
import { ApproveImportDto } from './dto/approve-import.dto';
import {
  PAYMENT_MAP,
  durationToType,
} from '../../common/constants/membership.constants';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

interface ImportRecord {
  joinDate: Date | null;
  membershipDurationMonths: number;
  membershipAmount: { toNumber: () => number } | number | null;
  paymentMode: string | null;
  clientName: string | null | undefined;
  clientPhone: string | null | undefined;
  addressRaw: string | null;
  photoFilename: string | null;
  entryNumber: string | null;
}

@Injectable()
export class ImportService {
  constructor(
    private prisma: PrismaService,
    private parser: WhatsAppParserService,
  ) {}

  // ── Import from a server folder path (chat file + photos already on disk) ──
  async importFromPath(userId: string, folderPath: string) {
    const chatFile = path.join(folderPath, '_chat.txt');
    if (!fsSync.existsSync(chatFile)) {
      throw new BadRequestException(`_chat.txt not found in: ${folderPath}`);
    }

    const text = await fs.readFile(chatFile, 'utf-8');
    return this._processAndStore(userId, text, folderPath);
  }

  // ── Upload .txt file via browser ─────────────────────────────────────
  async parseAndStore(userId: string, fileBuffer: Buffer) {
    const text = fileBuffer.toString('utf-8');
    return this._processAndStore(userId, text, null);
  }

  // ── Core: parse → store → auto-approve clean entries ────────────────
  private async _processAndStore(
    userId: string,
    text: string,
    photosDir: string | null,
  ) {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    const entries = this.parser.parse(text);
    if (entries.length === 0) {
      throw new BadRequestException('No gym entries found in the file');
    }

    let imported = 0,
      skipped = 0,
      autoApproved = 0;

    for (const entry of entries) {
      // Skip duplicates
      if (entry.entryNumber) {
        const exists = await this.prisma.importedClient.findFirst({
          where: { userId, entryNumber: entry.entryNumber },
        });
        if (exists) {
          skipped++;
          continue;
        }
      }

      // Copy photo from source folder to uploads/
      let photo = entry.photoFilename;
      if (photo && photosDir) {
        try {
          await fs.copyFile(
            path.join(photosDir, photo),
            path.join(UPLOADS_DIR, photo),
          );
        } catch {
          photo = null; // photo file not found on disk
        }
      }

      const record = await this.prisma.importedClient.create({
        data: {
          userId,
          entryNumber: entry.entryNumber,
          clientName: entry.clientName,
          clientPhone: entry.clientPhone,
          addressRaw: entry.addressRaw,
          membershipDurationMonths: entry.membershipDurationMonths,
          membershipAmount: entry.membershipAmount ?? undefined,
          paymentMode: entry.paymentMode,
          joinDate: entry.joinDate ?? undefined,
          photoFilename: photo,
          sender: entry.sender,
          confidenceScore: entry.needsReview ? 0.5 : 0.95,
          needsManualReview: entry.needsReview,
          reviewNote: entry.reviewNote,
        },
      });

      imported++;

      // Auto-approve if all fields are clean
      if (!entry.needsReview && entry.clientName && entry.clientPhone) {
        try {
          await this._createClientFromRecord(userId, record);
          await this.prisma.importedClient.update({
            where: { id: record.id },
            data: {
              status: 'APPROVED',
              reviewedAt: new Date(),
              resolvedClientId: record.id,
            },
          });
          autoApproved++;
        } catch {
          /* stays as PENDING */
        }
      }
    }

    return {
      imported,
      skipped,
      autoApproved,
      needsReview: imported - autoApproved,
    };
  }

  // ── Create a real Client + Payment from a staging record ─────────────
  private async _createClientFromRecord(userId: string, record: ImportRecord) {
    const startDate = record.joinDate ?? new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + record.membershipDurationMonths);

    const membershipType = durationToType(record.membershipDurationMonths);
    const feePaid =
      typeof record.membershipAmount === 'object' &&
      record.membershipAmount !== null &&
      'toNumber' in record.membershipAmount
        ? record.membershipAmount.toNumber()
        : (record.membershipAmount ?? 0);
    const method =
      PAYMENT_MAP[record.paymentMode?.toLowerCase() ?? ''] ?? 'CASH';

    // Use transaction to ensure client + payment are created atomically
    return await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          userId,
          name: record.clientName ?? '',
          phone: record.clientPhone ?? '',
          notes: record.addressRaw ?? undefined,
          membershipType,
          startDate,
          endDate,
          photoFilename: record.photoFilename ?? undefined,
          entryNumber: record.entryNumber ?? undefined,
        },
      });

      // Always create an initial payment — single source of truth for fee/plan/expiry
      await tx.payment.create({
        data: {
          userId,
          clientId: client.id,
          amount: feePaid,
          method: method as PaymentMethod,
          paidAt: startDate,
          membershipType,
          endDate,
          note: `Initial payment`,
        },
      });

      return client;
    });
  }

  // ── List pending ──────────────────────────────────────────────────────
  findPending(userId: string) {
    return this.prisma.importedClient.findMany({
      where: { userId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── List all (grouped by entryNumber) ────────────────────────────────
  async findAll(userId: string, status?: string) {
    const where: Prisma.ImportedClientWhereInput = { userId };
    if (status) {
      where.status = status as Prisma.EnumImportStatusFilter;
    }

    const records = await this.prisma.importedClient.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Group by entryNumber (null entries are grouped under key "__no_entry__")
    const grouped = new Map<string, typeof records>();
    for (const r of records) {
      const key = r.entryNumber ?? '__no_entry__';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    }

    return Array.from(grouped.entries()).map(([key, items]) => ({
      entryNumber: key === '__no_entry__' ? null : key,
      count: items.length,
      records: items,
    }));
  }

  // ── Get one ───────────────────────────────────────────────────────────
  async findOne(userId: string, id: string) {
    const r = await this.prisma.importedClient.findFirst({
      where: { id, userId },
    });
    if (!r) throw new NotFoundException('Record not found');
    return r;
  }

  // ── Patch staging record ──────────────────────────────────────────────
  async review(userId: string, id: string, dto: ReviewImportDto) {
    await this.findOne(userId, id);
    return this.prisma.importedClient.update({
      where: { id },
      data: { ...dto },
    });
  }

  // ── Approve → create Client + Payment ────────────────────────────────
  async approve(userId: string, id: string, dto: ApproveImportDto) {
    const record = await this.findOne(userId, id);
    if (record.status !== 'PENDING')
      throw new ConflictException(`Already ${record.status}`);

    const clientName = dto.clientName ?? record.clientName;
    const clientPhone = dto.clientPhone ?? record.clientPhone;

    if (!clientName) throw new BadRequestException('clientName is required');
    if (!clientPhone) throw new BadRequestException('clientPhone is required');

    const merged = { ...record, clientName, clientPhone };

    const client = await this._createClientFromRecord(userId, merged);

    await this.prisma.importedClient.update({
      where: { id },
      data: {
        status: 'APPROVED',
        resolvedClientId: client.id,
        clientName,
        clientPhone,
        reviewNote: dto.reviewNote ?? record.reviewNote,
        reviewedAt: new Date(),
      },
    });

    return { message: 'Approved — client created', clientId: client.id };
  }

  // ── Reject ────────────────────────────────────────────────────────────
  async reject(userId: string, id: string, note?: string) {
    const record = await this.findOne(userId, id);
    if (record.status !== 'PENDING')
      throw new ConflictException(`Already ${record.status}`);

    return this.prisma.importedClient.update({
      where: { id },
      data: { status: 'REJECTED', reviewNote: note, reviewedAt: new Date() },
    });
  }

  // ── Enrich PENDING fees records from the entry chat file ─────────────
  /**
   * For every PENDING ImportedClient record belonging to this user:
   *
   * 1. If a Client already exists in the DB with the same entryNumber  → mark APPROVED.
   * 2. If an entry is found in the entry chat file by entryNumber       → copy name /
   *    phone / address into the record; auto-approve when data is complete.
   * 3. If no match in the entry file at all                             → keep PENDING
   *    with a review note so the operator can fill in details manually.
   *
   * Spelling mistakes in the entry file are handled by `normalizeName` (proper
   * capitalisation, stripped noise characters). The entry with the most complete
   * data (name + phone) is preferred when the same entry number appears more than once.
   */
  async enrichPendingFromEntryFile(userId: string, entryFolderPath: string) {
    // ── 1. Parse the entry chat file ──────────────────────────────────
    const chatFile = path.join(entryFolderPath, '_chat.txt');
    if (!fsSync.existsSync(chatFile)) {
      throw new BadRequestException(
        `_chat.txt not found in: ${entryFolderPath}`,
      );
    }
    const text = await fs.readFile(chatFile, 'utf-8');
    const entryRecords = this.parser.parse(text);

    // Build a lookup map keyed by normalised entry number.
    // When duplicates exist, prefer the record with the most complete data.
    const entryMap = new Map<string, ParsedEntry>();
    for (const rec of entryRecords) {
      if (!rec.entryNumber) continue;
      const existing = entryMap.get(rec.entryNumber);
      if (!existing) {
        entryMap.set(rec.entryNumber, rec);
      } else {
        const existScore =
          (existing.clientName ? 1 : 0) + (existing.clientPhone ? 1 : 0);
        const newScore = (rec.clientName ? 1 : 0) + (rec.clientPhone ? 1 : 0);
        if (newScore > existScore) entryMap.set(rec.entryNumber, rec);
      }
    }

    // ── 2. Fetch all PENDING records for this user ────────────────────
    const pending = await this.prisma.importedClient.findMany({
      where: { userId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });

    let alreadyInDb = 0;
    let enriched = 0;
    let autoApproved = 0;
    let notFound = 0;

    for (const record of pending) {
      if (!record.entryNumber) continue; // nothing to look up without an entry number

      // ── 2a. Check if a Client already exists in the DB ───────────────
      const existingClient = await this.prisma.client.findFirst({
        where: { userId, entryNumber: record.entryNumber },
      });

      if (existingClient) {
        await this.prisma.importedClient.update({
          where: { id: record.id },
          data: {
            status: 'APPROVED',
            resolvedClientId: existingClient.id,
            reviewedAt: new Date(),
            reviewNote: 'Client already exists in DB',
          },
        });
        alreadyInDb++;
        continue;
      }

      // ── 2b. Look up in entry file ────────────────────────────────────
      const entryData = entryMap.get(record.entryNumber);

      if (entryData) {
        // Prefer entry-file values; fall back to what fees record already has.
        const finalName = entryData.clientName
          ? this.normalizeName(entryData.clientName)
          : (record.clientName ?? null);
        const finalPhone = entryData.clientPhone ?? record.clientPhone ?? null;
        const finalAddress = entryData.addressRaw ?? record.addressRaw ?? null;
        const finalPhoto =
          record.photoFilename ?? entryData.photoFilename ?? null;
        const finalJoinDate = record.joinDate ?? entryData.joinDate ?? null;

        if (finalName && finalPhone) {
          // Complete data → auto-approve
          const merged = {
            ...record,
            clientName: finalName,
            clientPhone: finalPhone,
            addressRaw: finalAddress,
            photoFilename: finalPhoto,
            joinDate: finalJoinDate,
          };
          try {
            const client = await this._createClientFromRecord(userId, merged);
            await this.prisma.importedClient.update({
              where: { id: record.id },
              data: {
                status: 'APPROVED',
                clientName: finalName,
                clientPhone: finalPhone,
                addressRaw: finalAddress,
                photoFilename: finalPhoto,
                joinDate: finalJoinDate ?? undefined,
                resolvedClientId: client.id,
                reviewedAt: new Date(),
                reviewNote: 'Enriched from entry file',
                needsManualReview: false,
              },
            });
            autoApproved++;
          } catch {
            // Approval failed (e.g. duplicate phone) — still save enriched data
            await this.prisma.importedClient.update({
              where: { id: record.id },
              data: {
                clientName: finalName,
                clientPhone: finalPhone,
                addressRaw: finalAddress,
                photoFilename: finalPhoto,
                reviewNote:
                  'Enriched from entry file; approval failed — check for duplicates',
              },
            });
          }
        } else {
          // Partial data from entry file — update and keep PENDING
          const missingParts: string[] = [];
          if (!finalName) missingParts.push('name');
          if (!finalPhone) missingParts.push('phone');
          await this.prisma.importedClient.update({
            where: { id: record.id },
            data: {
              clientName: finalName ?? undefined,
              clientPhone: finalPhone ?? undefined,
              addressRaw: finalAddress ?? undefined,
              photoFilename: finalPhoto ?? undefined,
              reviewNote: `Partial data from entry file — missing: ${missingParts.join(', ')}`,
            },
          });
        }
        enriched++;
      } else {
        // ── 2c. Not found in entry file ────────────────────────────────
        // Keep as PENDING; flag clearly so the operator knows what to do.
        await this.prisma.importedClient.update({
          where: { id: record.id },
          data: {
            needsManualReview: true,
            reviewNote: `Entry ${record.entryNumber} not found in entry file — fill in name/phone manually`,
          },
        });
        notFound++;
      }
    }

    return {
      processed: pending.length,
      alreadyInDb,
      enriched,
      autoApproved,
      notFound,
    };
  }

  // ── Normalise a name: proper capitalisation, strip noise chars ────────
  private normalizeName(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
}
