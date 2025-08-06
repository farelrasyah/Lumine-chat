import { Module } from '@nestjs/common';
import { FinanceQAService } from './finance-qa.service';

@Module({
  providers: [FinanceQAService],
  exports: [FinanceQAService],
})
export class FinanceModule {}
