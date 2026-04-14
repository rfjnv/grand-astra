import { Module } from '@nestjs/common';
import { DealsService } from './deals.service';
import { DealsController } from './deals.controller';
import { AuditModule } from '../audit/audit.module';
import { DealStagesModule } from '../deal-stages/deal-stages.module';

@Module({
  imports: [AuditModule, DealStagesModule],
  controllers: [DealsController],
  providers: [DealsService],
})
export class DealsModule {}
