import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { OverduePaymentsJob } from './overdue-payments.job';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [OverduePaymentsJob],
})
export class JobsModule {}
