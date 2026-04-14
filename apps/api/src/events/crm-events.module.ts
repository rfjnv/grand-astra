import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CrmDomainListener } from './crm-domain.listener';
import { AuditModule } from '../audit/audit.module';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot(), AuditModule],
  providers: [CrmDomainListener],
  exports: [EventEmitterModule],
})
export class CrmEventsModule {}
