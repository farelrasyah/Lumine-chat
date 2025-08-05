
import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp/whatsapp.service';
import { MessageProcessorService } from './whatsapp/message-processor.service';
import { ParserModule } from './parser/parser.module';
import { SheetModule } from './sheet/sheet.module';

@Module({
  imports: [ParserModule, SheetModule],
  providers: [WhatsAppService, MessageProcessorService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
