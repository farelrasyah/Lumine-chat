import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { SheetModule } from './sheet/sheet.module';
import { ParserModule } from './parser/parser.module';

@Module({
  imports: [
    require('./whatsapp.module').WhatsAppModule,
    require('./scheduler.module').SchedulerModule,
    SheetModule,
    ParserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
