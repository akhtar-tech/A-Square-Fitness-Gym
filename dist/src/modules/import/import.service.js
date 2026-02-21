"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs/promises"));
const fsSync = __importStar(require("fs"));
const path = __importStar(require("path"));
const prisma_service_1 = require("../../prisma/prisma.service");
const whatsapp_parser_service_1 = require("./whatsapp-parser.service");
const membership_constants_1 = require("../../common/constants/membership.constants");
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
let ImportService = class ImportService {
    prisma;
    parser;
    constructor(prisma, parser) {
        this.prisma = prisma;
        this.parser = parser;
    }
    async importFromPath(userId, folderPath) {
        const chatFile = path.join(folderPath, '_chat.txt');
        if (!fsSync.existsSync(chatFile)) {
            throw new common_1.BadRequestException(`_chat.txt not found in: ${folderPath}`);
        }
        const text = await fs.readFile(chatFile, 'utf-8');
        return this._processAndStore(userId, text, folderPath);
    }
    async parseAndStore(userId, fileBuffer) {
        const text = fileBuffer.toString('utf-8');
        return this._processAndStore(userId, text, null);
    }
    async _processAndStore(userId, text, photosDir) {
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        const entries = this.parser.parse(text);
        if (entries.length === 0) {
            throw new common_1.BadRequestException('No gym entries found in the file');
        }
        let imported = 0, skipped = 0, autoApproved = 0;
        for (const entry of entries) {
            if (entry.entryNumber) {
                const exists = await this.prisma.importedClient.findFirst({
                    where: { userId, entryNumber: entry.entryNumber },
                });
                if (exists) {
                    skipped++;
                    continue;
                }
            }
            let photo = entry.photoFilename;
            if (photo && photosDir) {
                try {
                    await fs.copyFile(path.join(photosDir, photo), path.join(UPLOADS_DIR, photo));
                }
                catch {
                    photo = null;
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
                }
                catch {
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
    async _createClientFromRecord(userId, record) {
        const startDate = record.joinDate ?? new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + record.membershipDurationMonths);
        const membershipType = (0, membership_constants_1.durationToType)(record.membershipDurationMonths);
        const feePaid = typeof record.membershipAmount === 'object' &&
            record.membershipAmount !== null &&
            'toNumber' in record.membershipAmount
            ? record.membershipAmount.toNumber()
            : (record.membershipAmount ?? 0);
        const method = membership_constants_1.PAYMENT_MAP[record.paymentMode?.toLowerCase() ?? ''] ?? 'CASH';
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
            await tx.payment.create({
                data: {
                    userId,
                    clientId: client.id,
                    amount: feePaid,
                    method: method,
                    paidAt: startDate,
                    membershipType,
                    endDate,
                    note: `Initial payment`,
                },
            });
            return client;
        });
    }
    findPending(userId) {
        return this.prisma.importedClient.findMany({
            where: { userId, status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
        });
    }
    async findAll(userId, status) {
        const where = { userId };
        if (status) {
            where.status = status;
        }
        const records = await this.prisma.importedClient.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        const grouped = new Map();
        for (const r of records) {
            const key = r.entryNumber ?? '__no_entry__';
            if (!grouped.has(key))
                grouped.set(key, []);
            grouped.get(key).push(r);
        }
        return Array.from(grouped.entries()).map(([key, items]) => ({
            entryNumber: key === '__no_entry__' ? null : key,
            count: items.length,
            records: items,
        }));
    }
    async findOne(userId, id) {
        const r = await this.prisma.importedClient.findFirst({
            where: { id, userId },
        });
        if (!r)
            throw new common_1.NotFoundException('Record not found');
        return r;
    }
    async review(userId, id, dto) {
        await this.findOne(userId, id);
        return this.prisma.importedClient.update({
            where: { id },
            data: { ...dto },
        });
    }
    async approve(userId, id, dto) {
        const record = await this.findOne(userId, id);
        if (record.status !== 'PENDING')
            throw new common_1.ConflictException(`Already ${record.status}`);
        const clientName = dto.clientName ?? record.clientName;
        const clientPhone = dto.clientPhone ?? record.clientPhone;
        if (!clientName)
            throw new common_1.BadRequestException('clientName is required');
        if (!clientPhone)
            throw new common_1.BadRequestException('clientPhone is required');
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
    async reject(userId, id, note) {
        const record = await this.findOne(userId, id);
        if (record.status !== 'PENDING')
            throw new common_1.ConflictException(`Already ${record.status}`);
        return this.prisma.importedClient.update({
            where: { id },
            data: { status: 'REJECTED', reviewNote: note, reviewedAt: new Date() },
        });
    }
    async enrichPendingFromEntryFile(userId, entryFolderPath) {
        const chatFile = path.join(entryFolderPath, '_chat.txt');
        if (!fsSync.existsSync(chatFile)) {
            throw new common_1.BadRequestException(`_chat.txt not found in: ${entryFolderPath}`);
        }
        const text = await fs.readFile(chatFile, 'utf-8');
        const entryRecords = this.parser.parse(text);
        const entryMap = new Map();
        for (const rec of entryRecords) {
            if (!rec.entryNumber)
                continue;
            const existing = entryMap.get(rec.entryNumber);
            if (!existing) {
                entryMap.set(rec.entryNumber, rec);
            }
            else {
                const existScore = (existing.clientName ? 1 : 0) + (existing.clientPhone ? 1 : 0);
                const newScore = (rec.clientName ? 1 : 0) + (rec.clientPhone ? 1 : 0);
                if (newScore > existScore)
                    entryMap.set(rec.entryNumber, rec);
            }
        }
        const pending = await this.prisma.importedClient.findMany({
            where: { userId, status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
        });
        let alreadyInDb = 0;
        let enriched = 0;
        let autoApproved = 0;
        let notFound = 0;
        for (const record of pending) {
            if (!record.entryNumber)
                continue;
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
            const entryData = entryMap.get(record.entryNumber);
            if (entryData) {
                const finalName = entryData.clientName
                    ? this.normalizeName(entryData.clientName)
                    : (record.clientName ?? null);
                const finalPhone = entryData.clientPhone ?? record.clientPhone ?? null;
                const finalAddress = entryData.addressRaw ?? record.addressRaw ?? null;
                const finalPhoto = record.photoFilename ?? entryData.photoFilename ?? null;
                const finalJoinDate = record.joinDate ?? entryData.joinDate ?? null;
                if (finalName && finalPhone) {
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
                    }
                    catch {
                        await this.prisma.importedClient.update({
                            where: { id: record.id },
                            data: {
                                clientName: finalName,
                                clientPhone: finalPhone,
                                addressRaw: finalAddress,
                                photoFilename: finalPhoto,
                                reviewNote: 'Enriched from entry file; approval failed — check for duplicates',
                            },
                        });
                    }
                }
                else {
                    const missingParts = [];
                    if (!finalName)
                        missingParts.push('name');
                    if (!finalPhone)
                        missingParts.push('phone');
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
            }
            else {
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
    normalizeName(name) {
        return name
            .trim()
            .split(/\s+/)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
    }
};
exports.ImportService = ImportService;
exports.ImportService = ImportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        whatsapp_parser_service_1.WhatsAppParserService])
], ImportService);
//# sourceMappingURL=import.service.js.map