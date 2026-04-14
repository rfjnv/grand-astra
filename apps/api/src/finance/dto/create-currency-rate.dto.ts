import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCurrencyRateDto {
  @IsString()
  quoteCurrency!: string;

  /** 1 quoteCurrency = rateToBase единиц baseCurrency организации */
  @Type(() => Number)
  @IsNumber()
  rateToBase!: number;

  @IsOptional()
  @IsDateString()
  validFrom?: string;
}
