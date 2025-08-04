import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp/whatsapp.service';
import { MessageProcessorService } from './whatsapp/message-processor.service';

@Module({
  providers: [WhatsAppService, MessageProcessorService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
