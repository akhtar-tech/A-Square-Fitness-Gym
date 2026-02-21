import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';
import { WhatsAppParserService } from './whatsapp-parser.service';

@Module({
  controllers: [ImportController],
  providers: [ImportService, WhatsAppParserService],
})
export class ImportModule {}
