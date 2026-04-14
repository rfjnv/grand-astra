import { InteractionType } from '@prisma/client';
import { IsDateString, IsEnum, IsString } from 'class-validator';

export class CreateInteractionDto {
  @IsEnum(InteractionType)
  type!: InteractionType;

  @IsDateString()
  occurredAt!: string;

  @IsString()
  summary!: string;
}
