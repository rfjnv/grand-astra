import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { FinanceAggregationService } from './finance-aggregation.service';
import { CurrencyNormalizationService } from './currency-normalization.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [FinanceController],
  providers: [FinanceService, FinanceAggregationService, CurrencyNormalizationService],
  exports: [CurrencyNormalizationService, FinanceAggregationService],
})
export class FinanceModule {}
