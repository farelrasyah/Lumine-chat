
import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp/whatsapp.service';
import { MessageProcessorService } from './whatsapp/message-processor.service';
import { ParserModule } from './parser/parser.module';
import { SheetModule } from './sheet/sheet.module';
import { FinanceModule } from './finance/finance.module';
import { ReportsService } from './reports/reports.service';
import { ChartsService } from './charts/charts.service';
import { PdfGeneratorService } from './pdf/pdf-generator.service';

@Module({
  imports: [ParserModule, SheetModule, FinanceModule],
  providers: [WhatsAppService, MessageProcessorService, ReportsService, ChartsService, PdfGeneratorService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
