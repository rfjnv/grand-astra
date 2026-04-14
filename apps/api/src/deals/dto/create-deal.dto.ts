import { DealType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateDealDto {
  @IsEnum(DealType)
  type!: DealType;

  @IsOptional()
  @IsString()
  dealStageId?: string;

  @IsOptional()
  @IsString()
  responsibleUserId?: string;

  @IsString()
  clientId!: string;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsString()
  constructionProjectId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  advanceAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  balanceAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  closedAt?: string;
}
