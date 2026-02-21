import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImportService } from './import.service';
import { ReviewImportDto } from './dto/review-import.dto';
import { ApproveImportDto } from './dto/approve-import.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('import')
@UseGuards(JwtAuthGuard)
export class ImportController {
  constructor(private importService: ImportService) {}

  /**
   * POST /api/v1/import/from-path
   * Import directly from a server folder that already contains _chat.txt + photos.
   * Body: { folderPath: "/absolute/path/to/whatsapp/export/folder" }
   */
  @Post('from-path')
  importFromPath(
    @CurrentUser() user: { id: string },
    @Body('folderPath') folderPath: string,
  ) {
    if (!folderPath) throw new BadRequestException('folderPath is required');
    return this.importService.importFromPath(user.id, folderPath);
  }

  /**
   * POST /api/v1/import/whatsapp
   * Upload a WhatsApp .txt file from the browser (no photos).
   */
  @Post('whatsapp')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.endsWith('.txt'))
          return cb(new BadRequestException('Only .txt files accepted'), false);
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadTxt(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.importService.parseAndStore(user.id, file.buffer);
  }

  /**
   * POST /api/v1/import/enrich-from-entry
   * For every PENDING imported-fees record, look up the entry number in the
   * entry-chat folder and copy name / phone / address into the staging record.
   * Records with complete data are auto-approved; the rest stay PENDING with
   * a clear review note.
   *
   * Body: { entryFolderPath: "/absolute/path/to/WhatsApp Chat - New gym entry" }
   */
  @Post('enrich-from-entry')
  @HttpCode(HttpStatus.OK)
  enrichFromEntry(
    @CurrentUser() user: { id: string },
    @Body('entryFolderPath') entryFolderPath: string,
  ) {
    if (!entryFolderPath)
      throw new BadRequestException('entryFolderPath is required');
    return this.importService.enrichPendingFromEntryFile(
      user.id,
      entryFolderPath,
    );
  }

  /** GET /api/v1/import/pending */
  @Get('pending')
  findPending(@CurrentUser() user: { id: string }) {
    return this.importService.findPending(user.id);
  }

  /** GET /api/v1/import?status=PENDING|APPROVED|REJECTED */
  @Get()
  findAll(
    @CurrentUser() user: { id: string },
    @Query('status') status?: string,
  ) {
    return this.importService.findAll(user.id, status);
  }

  /** GET /api/v1/import/:id */
  @Get(':id')
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.importService.findOne(user.id, id);
  }

  /** PATCH /api/v1/import/:id — fill in missing name/phone/address */
  @Patch(':id')
  review(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ReviewImportDto,
  ) {
    return this.importService.review(user.id, id, dto);
  }

  /** POST /api/v1/import/:id/approve */
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ApproveImportDto,
  ) {
    return this.importService.approve(user.id, id, dto);
  }

  /** POST /api/v1/import/:id/reject */
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body('note') note?: string,
  ) {
    return this.importService.reject(user.id, id, note);
  }
}
