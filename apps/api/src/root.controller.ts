import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

/** Корень без префикса `/api`: чтобы в браузере по базовому URL API не было пустого 404. */
@Controller()
export class RootController {
  @Public()
  @Get()
  root() {
    return {
      service: 'grandastra-api',
      message:
        'Это сервер API Grand Astra. Интерфейс CRM открывается по URL отдельного фронтенда (статический сайт).',
      health: '/api/health',
      healthDb: '/api/health/ready',
    };
  }
}
