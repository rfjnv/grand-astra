import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CurrencyNormalizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getBaseCurrency(organizationId: string): Promise<string> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { baseCurrency: true },
    });
    return org.baseCurrency;
  }

  /**
   * Курс: 1 единица quoteCurrency = rateToBase единиц baseCurrency организации.
   */
  async resolveRateToBase(
    organizationId: string,
    quoteCurrency: string,
    asOf: Date,
  ): Promise<{ rate: Prisma.Decimal; baseCurrency: string }> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { baseCurrency: true },
    });
    if (quoteCurrency === org.baseCurrency) {
      return { rate: new Prisma.Decimal(1), baseCurrency: org.baseCurrency };
    }
    const row = await this.prisma.currencyRate.findFirst({
      where: {
        organizationId,
        quoteCurrency,
        validFrom: { lte: asOf },
      },
      orderBy: { validFrom: 'desc' },
    });
    if (!row) {
      throw new BadRequestException(
        `Нет курса для ${quoteCurrency} к базе ${org.baseCurrency} на дату. Добавьте запись CurrencyRate.`,
      );
    }
    return { rate: row.rateToBase, baseCurrency: org.baseCurrency };
  }

  async normalizeAmount(
    organizationId: string,
    amount: Prisma.Decimal | number | string,
    currency: string,
    asOf: Date,
  ): Promise<{ normalizedAmountBase: Prisma.Decimal; fxRateToBase: Prisma.Decimal }> {
    const { rate } = await this.resolveRateToBase(organizationId, currency, asOf);
    const a = new Prisma.Decimal(amount);
    return {
      normalizedAmountBase: a.mul(rate),
      fxRateToBase: rate,
    };
  }
}
