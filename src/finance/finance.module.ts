import { Module } from '@nestjs/common';
import { FinanceQAService } from './finance-qa.service';
import { EnhancedDateService } from './enhanced-date.service';
import { FinanceAnalysisService } from './finance-analysis.service';
import { AdvancedFinanceParserService } from './advanced-finance-parser.service';
import { AdvancedFinanceResponseService } from './advanced-finance-response.service';
import { BudgetManagementService } from './budget-management.service';
import { FinancialInsightService } from './financial-insight.service';
import { SavingsSimulationService } from './savings-simulation.service';

@Module({
  providers: [
    FinanceQAService,
    EnhancedDateService,
    FinanceAnalysisService,
    AdvancedFinanceParserService,
    AdvancedFinanceResponseService,
    BudgetManagementService,
    FinancialInsightService,
    SavingsSimulationService,
  ],
  exports: [
    FinanceQAService,
    EnhancedDateService,
    FinanceAnalysisService,
    AdvancedFinanceParserService,
    AdvancedFinanceResponseService,
    BudgetManagementService,
    FinancialInsightService,
    SavingsSimulationService,
  ],
})
export class FinanceModule {}
