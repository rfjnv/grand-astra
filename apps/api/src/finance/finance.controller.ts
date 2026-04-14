import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceAggregationService } from './finance-aggregation.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateIncomeDto } from './dto/create-income.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { PatchScheduleDto } from './dto/patch-schedule.dto';
import { CreateCurrencyRateDto } from './dto/create-currency-rate.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionKeys } from '../common/permissions/permission-keys';

@Controller('finance')
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly aggregation: FinanceAggregationService,
  ) {}

  @RequirePermissions(PermissionKeys.FINANCE_READ)
  @Get('currency-rates')
  listRates(@CurrentUser() user: AuthUser) {
    return this.finance.listCurrencyRates(user);
  }

  @RequirePermissions(PermissionKeys.FINANCE_WRITE)
  @Post('currency-rates')
  createRate(@CurrentUser() user: AuthUser, @Body() dto: CreateCurrencyRateDto) {
    return this.finance.createCurrencyRate(user, dto);
  }

  @RequirePermissions(PermissionKeys.FINANCE_READ)
  @Get('expenses')
  listExpenses(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('responsibleId') responsibleId?: string,
  ) {
    return this.finance.listExpenses(user, { from, to, status, responsibleId });
  }

  @RequirePermissions(PermissionKeys.FINANCE_WRITE)
  @Post('expenses')
  createExpense(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    return this.finance.createExpense(user, dto);
  }

  @RequirePermissions(PermissionKeys.FINANCE_READ)
  @Get('incomes')
  listIncomes(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('dealId') dealId?: string,
    @Query('responsibleId') responsibleId?: string,
  ) {
    return this.finance.listIncomes(user, { from, to, dealId, responsibleId });
  }

  @RequirePermissions(PermissionKeys.FINANCE_WRITE)
  @Post('incomes')
  createIncome(@CurrentUser() user: AuthUser, @Body() dto: CreateIncomeDto) {
    return this.finance.createIncome(user, dto);
  }

  @RequirePermissions(PermissionKeys.FINANCE_SCHEDULES)
  @Get('schedules')
  listSchedules(@CurrentUser() user: AuthUser) {
    return this.finance.listSchedules(user);
  }

  @RequirePermissions(PermissionKeys.FINANCE_SCHEDULES)
  @Post('schedules')
  createSchedule(@CurrentUser() user: AuthUser, @Body() dto: CreateScheduleDto) {
    return this.finance.createSchedule(user, dto);
  }

  @RequirePermissions(PermissionKeys.FINANCE_SCHEDULES)
  @Patch('schedules/:id')
  patchSchedule(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: PatchScheduleDto) {
    return this.finance.patchSchedule(user, id, dto);
  }

  @RequirePermissions(PermissionKeys.FINANCE_SCHEDULES)
  @Get('schedules/overdue')
  overdue(@CurrentUser() user: AuthUser) {
    return this.finance.overdueSchedules(user);
  }

  @RequirePermissions(PermissionKeys.REPORTS_READ)
  @Get('aggregations/profit')
  profit(
    @CurrentUser() user: AuthUser,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.aggregation.profit(user, { from: new Date(from), to: new Date(to) });
  }

  @RequirePermissions(PermissionKeys.REPORTS_READ)
  @Get('aggregations/cashflow')
  cashflow(@CurrentUser() user: AuthUser, @Query('months') months?: string) {
    const m = months ? Number(months) : 6;
    return this.aggregation.cashflowByMonth(user, Number.isFinite(m) ? m : 6);
  }

  @RequirePermissions(PermissionKeys.REPORTS_READ)
  @Get('aggregations/receivables')
  receivables(@CurrentUser() user: AuthUser) {
    return this.aggregation.receivablesSummary(user);
  }

  @RequirePermissions(PermissionKeys.FINANCE_SCHEDULES)
  @Get('aggregations/overdue-detailed')
  overdueDetailed(@CurrentUser() user: AuthUser) {
    return this.aggregation.overdueSchedulesDetailed(user);
  }
}
