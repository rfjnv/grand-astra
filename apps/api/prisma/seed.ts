import {
  PrismaClient,
  ClientType,
  InteractionType,
  PropertyKind,
  PropertyStatus,
  DealType,
  AttachmentKind,
  ExpenseScope,
  ExpenseStatus,
  ScheduleStatus,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/** Ключи как в `PermissionKeys` (кроме `*`). */
const ALL_PERM_KEYS = [
  'users.list',
  'users.create',
  'roles.manage',
  'clients.read',
  'clients.write',
  'deals.read',
  'deals.write',
  'deal_stages.manage',
  'properties.read',
  'properties.write',
  'construction.read',
  'construction.write',
  'finance.read',
  'finance.write',
  'finance.schedules',
  'reports.read',
  'audit.read',
  'notifications.read',
  'org.settings',
  'scope.own_records',
] as const;

async function seedPermissions() {
  for (const key of ALL_PERM_KEYS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key },
    });
  }
}

async function wireRole(orgId: string, slug: string, name: string, keys: readonly string[]) {
  const role = await prisma.role.upsert({
    where: { organizationId_slug: { organizationId: orgId, slug } },
    update: { name },
    create: { organizationId: orgId, slug, name, isSystem: true },
  });
  const perms = await prisma.permission.findMany({ where: { key: { in: [...keys] } } });
  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  for (const p of perms) {
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: p.id } });
  }
  return role;
}

async function seedRoles(orgId: string) {
  const all = [...ALL_PERM_KEYS];
  const director = all.filter((k) => k !== 'users.create' && k !== 'roles.manage');
  const manager = [
    'clients.read',
    'clients.write',
    'deals.read',
    'deals.write',
    'properties.read',
    'construction.read',
    'finance.schedules',
    'notifications.read',
    'scope.own_records',
  ];
  const accountant = [
    'clients.read',
    'deals.read',
    'properties.read',
    'finance.read',
    'finance.write',
    'finance.schedules',
    'reports.read',
    'notifications.read',
  ];
  const builder = [
    'clients.read',
    'deals.read',
    'properties.read',
    'construction.read',
    'construction.write',
    'notifications.read',
  ];
  await wireRole(orgId, 'owner', 'Владелец', all);
  await wireRole(orgId, 'director', 'Директор', director);
  await wireRole(orgId, 'manager', 'Менеджер', manager);
  await wireRole(orgId, 'accountant', 'Бухгалтер', accountant);
  await wireRole(orgId, 'builder_admin', 'Прораб / стройка', builder);
}

/** Курс демо: 1 USD = rate UZS (база организации). */
const USD_RATE = new Prisma.Decimal(12750);

function usdToBase(amount: number) {
  return new Prisma.Decimal(amount).mul(USD_RATE);
}

async function seedDealStages(orgId: string) {
  const stages: Array<{ id: string; dealType: DealType; name: string; sortOrder: number }> = [
    { id: 'seed_ds_sale_0', dealType: DealType.SALE, name: 'Лид', sortOrder: 0 },
    { id: 'seed_ds_sale_1', dealType: DealType.SALE, name: 'Показ', sortOrder: 1 },
    { id: 'seed_ds_sale_2', dealType: DealType.SALE, name: 'Договор', sortOrder: 2 },
    { id: 'seed_ds_sale_3', dealType: DealType.SALE, name: 'Закрыта', sortOrder: 3 },
    { id: 'seed_ds_rent_0', dealType: DealType.RENT, name: 'Лид', sortOrder: 0 },
    { id: 'seed_ds_rent_1', dealType: DealType.RENT, name: 'Просмотр', sortOrder: 1 },
    { id: 'seed_ds_rent_2', dealType: DealType.RENT, name: 'Активна', sortOrder: 2 },
    { id: 'seed_ds_rent_3', dealType: DealType.RENT, name: 'Завершена', sortOrder: 3 },
    { id: 'seed_ds_con_0', dealType: DealType.CONSTRUCTION, name: 'Лид', sortOrder: 0 },
    { id: 'seed_ds_con_1', dealType: DealType.CONSTRUCTION, name: 'Проектирование', sortOrder: 1 },
    { id: 'seed_ds_con_2', dealType: DealType.CONSTRUCTION, name: 'Строительство', sortOrder: 2 },
    { id: 'seed_ds_con_3', dealType: DealType.CONSTRUCTION, name: 'Сдача', sortOrder: 3 },
  ];
  for (const s of stages) {
    await prisma.dealStage.upsert({
      where: { id: s.id },
      update: { name: s.name, sortOrder: s.sortOrder, dealType: s.dealType },
      create: {
        id: s.id,
        organizationId: orgId,
        dealType: s.dealType,
        name: s.name,
        sortOrder: s.sortOrder,
      },
    });
  }
  return {
    saleLead: 'seed_ds_sale_0',
    saleContract: 'seed_ds_sale_2',
    saleClosed: 'seed_ds_sale_3',
    rentActive: 'seed_ds_rent_2',
    consExec: 'seed_ds_con_2',
  };
}

async function seedDemoData(
  orgId: string,
  stageIds: {
    saleLead: string;
    saleContract: string;
    saleClosed: string;
    rentActive: string;
    consExec: string;
  },
  managerId: string,
  accountantId: string,
  builderId: string,
) {
  const now = new Date();

  const clientPerson1 = await prisma.client.upsert({
    where: { id: 'seed_cl_person_1' },
    update: {},
    create: {
      id: 'seed_cl_person_1',
      organizationId: orgId,
      type: ClientType.PERSON,
      firstName: 'Шухрат',
      lastName: 'Назаров',
      phones: [{ label: 'основной', value: '+998 90 111-22-33' }],
      emails: [{ label: 'личный', value: 'shukhrat.n@mail.example' }],
      messengers: [{ type: 'Telegram', handle: '@shukhrat_n' }],
      leadSource: 'SEED_DEMO',
      status: 'NEGOTIATION',
      notes: 'Ищет 3-комнатную квартиру в Чиланзаре, бюджет до 85 000 $.',
      assignedUserId: managerId,
    },
  });

  const clientPerson2 = await prisma.client.upsert({
    where: { id: 'seed_cl_person_2' },
    update: {},
    create: {
      id: 'seed_cl_person_2',
      organizationId: orgId,
      type: ClientType.PERSON,
      firstName: 'Лола',
      lastName: 'Каримова',
      phones: [{ value: '+998 91 555-66-77' }],
      emails: [{ value: 'lola.k@mail.example' }],
      messengers: [],
      leadSource: 'SEED_DEMO',
      status: 'ACTIVE_TENANT',
      notes: 'Аренда офиса, платежи стабильные.',
      assignedUserId: managerId,
    },
  });

  const clientCompany = await prisma.client.upsert({
    where: { id: 'seed_cl_company_1' },
    update: {},
    create: {
      id: 'seed_cl_company_1',
      organizationId: orgId,
      type: ClientType.COMPANY,
      companyName: 'ООО «СтройИнвест Плюс»',
      phones: [{ label: 'офис', value: '+998 71 000-11-22' }],
      emails: [{ value: 'zakup@stroyinvest.example' }],
      messengers: [],
      leadSource: 'SEED_DEMO',
      status: 'CONTRACT',
      notes: 'Заказчик коттеджа в Кибрае, этап кровля.',
      assignedUserId: managerId,
    },
  });

  /** Дополнительные синтетические записи (явно помечены FAKE_SEED). */
  const clientFakePerson = await prisma.client.upsert({
    where: { id: 'seed_cl_fake_person' },
    update: {},
    create: {
      id: 'seed_cl_fake_person',
      organizationId: orgId,
      type: ClientType.PERSON,
      firstName: 'Мария',
      lastName: 'Демо',
      phones: [{ value: '+998 90 000-00-01' }],
      emails: [{ value: 'demo.fake@example.invalid' }],
      messengers: [],
      leadSource: 'FAKE_SEED',
      status: 'NEW',
      notes: 'Выдуманный контакт для наполнения списков и тестов UI.',
      assignedUserId: managerId,
    },
  });

  await prisma.client.upsert({
    where: { id: 'seed_cl_fake_company' },
    update: {},
    create: {
      id: 'seed_cl_fake_company',
      organizationId: orgId,
      type: ClientType.COMPANY,
      companyName: 'ИП «Пример-Тест»',
      phones: [{ value: '+998 71 000-00-02' }],
      emails: [{ value: 'info@example-fake.invalid' }],
      messengers: [],
      leadSource: 'FAKE_SEED',
      status: 'NEW',
      notes: 'Фиктивная организация, не использовать как реальный контрагент.',
      assignedUserId: managerId,
    },
  });

  await prisma.clientInteraction.upsert({
    where: { id: 'seed_int_1' },
    update: {},
    create: {
      id: 'seed_int_1',
      clientId: clientPerson1.id,
      type: InteractionType.CALL,
      occurredAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      summary: 'Уточнили район и этажность, отправили подборку из 4 объектов.',
      createdById: managerId,
    },
  });

  await prisma.clientInteraction.upsert({
    where: { id: 'seed_int_2' },
    update: {},
    create: {
      id: 'seed_int_2',
      clientId: clientPerson1.id,
      type: InteractionType.MEETING,
      occurredAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      summary: 'Показ квартиры на Чиланзаре, клиенту понравился вид из окон.',
      createdById: managerId,
    },
  });

  const project = await prisma.constructionProject.upsert({
    where: { id: 'seed_prj_cottage' },
    update: {},
    create: {
      id: 'seed_prj_cottage',
      organizationId: orgId,
      name: 'Коттедж 180 м² — Кибрай',
      description: 'Каркасно-кирпичный дом, участок 6 соток.',
      clientId: clientCompany.id,
      siteAddress: 'Кибрайский р-н, ул. Берёзовая, уч. 14',
      budgetAmount: 125000,
      currency: 'USD',
      plannedStart: new Date(now.getFullYear(), now.getMonth() - 2, 5),
      plannedEnd: new Date(now.getFullYear(), now.getMonth() + 4, 20),
      status: 'IN_PROGRESS',
    },
  });

  const stageFoundation = await prisma.constructionStage.upsert({
    where: { id: 'seed_stg_foundation' },
    update: {},
    create: {
      id: 'seed_stg_foundation',
      projectId: project.id,
      title: 'Фундамент и гидроизоляция',
      sortOrder: 1,
      dueDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      status: 'DONE',
      budgetAmount: 18000,
      notes: 'Плита монолит, гидроизоляция выполнена.',
    },
  });

  await prisma.constructionStage.upsert({
    where: { id: 'seed_stg_walls' },
    update: {},
    create: {
      id: 'seed_stg_walls',
      projectId: project.id,
      title: 'Коробка и кровля',
      sortOrder: 2,
      dueDate: new Date(now.getFullYear(), now.getMonth() + 1, 15),
      status: 'IN_PROGRESS',
      budgetAmount: 42000,
      notes: 'Идёт кладка, кровля запланирована на следующий месяц.',
    },
  });

  await prisma.stageContractor.upsert({
    where: { id: 'seed_contractor_1' },
    update: {},
    create: {
      id: 'seed_contractor_1',
      stageId: stageFoundation.id,
      name: 'ЧП «БетонСтрой»',
      phone: '+998 90 777-88-99',
      role: 'Бетонные работы',
    },
  });

  await prisma.stageMaterial.upsert({
    where: { id: 'seed_mat_1' },
    update: {},
    create: {
      id: 'seed_mat_1',
      stageId: stageFoundation.id,
      itemName: 'Бетон М300',
      quantity: 42,
      unit: 'м³',
      unitPrice: 95,
      totalPrice: 3990,
      recordedAt: new Date(now.getFullYear(), now.getMonth() - 1, 10),
    },
  });

  const propApartment = await prisma.property.upsert({
    where: { id: 'seed_pr_apartment_1' },
    update: {},
    create: {
      id: 'seed_pr_apartment_1',
      organizationId: orgId,
      kind: PropertyKind.APARTMENT,
      title: '3-комн., Чиланзар-8',
      addressLine: 'Чиланзарский р-н, 8-квартал, дом 42, кв. 17',
      city: 'Ташкент',
      country: 'UZ',
      areaM2: 78.5,
      salePrice: 82000,
      rentPrice: 650,
      currency: 'USD',
      status: PropertyStatus.RESERVED,
    },
  });

  const propLand = await prisma.property.upsert({
    where: { id: 'seed_pr_land_1' },
    update: { status: PropertyStatus.SOLD },
    create: {
      id: 'seed_pr_land_1',
      organizationId: orgId,
      kind: PropertyKind.LAND,
      title: 'Участок под ИЖС',
      addressLine: 'Янгиюльский р-н, массив «Зелёный дол», уч. 3-а',
      city: 'Ташкентская обл.',
      areaM2: 600,
      salePrice: 28000,
      currency: 'USD',
      status: PropertyStatus.SOLD,
    },
  });

  const propCommercial = await prisma.property.upsert({
    where: { id: 'seed_pr_commercial_1' },
    update: {},
    create: {
      id: 'seed_pr_commercial_1',
      organizationId: orgId,
      kind: PropertyKind.COMMERCIAL,
      title: 'Офис 120 м², центр',
      addressLine: 'ул. Шота Руставели, бизнес-центр «Орион», офис 402',
      city: 'Ташкент',
      areaM2: 120,
      salePrice: 195000,
      rentPrice: 1200,
      currency: 'USD',
      status: PropertyStatus.LEASED,
      ownerClientId: clientPerson2.id,
    },
  });

  await prisma.property.upsert({
    where: { id: 'seed_pr_house_uc' },
    update: {},
    create: {
      id: 'seed_pr_house_uc',
      organizationId: orgId,
      kind: PropertyKind.HOUSE,
      title: 'Дом на участке (стройка)',
      addressLine: project.siteAddress ?? 'Кибрай',
      city: 'Ташкентская обл.',
      areaM2: 180,
      salePrice: 135000,
      currency: 'USD',
      status: PropertyStatus.UNDER_CONSTRUCTION,
      constructionProjectId: project.id,
      ownerClientId: clientCompany.id,
    },
  });

  const propFakeStudio = await prisma.property.upsert({
    where: { id: 'seed_pr_studio_fake' },
    update: {},
    create: {
      id: 'seed_pr_studio_fake',
      organizationId: orgId,
      kind: PropertyKind.APARTMENT,
      title: 'Студия 32 м² (синтетика)',
      addressLine: 'ул. Выдуманная, 10',
      city: 'Ташкент',
      areaM2: 32,
      salePrice: 41000,
      currency: 'USD',
      status: PropertyStatus.AVAILABLE,
    },
  });

  await prisma.propertyAttachment.upsert({
    where: { id: 'seed_patt_1' },
    update: {},
    create: {
      id: 'seed_patt_1',
      propertyId: propApartment.id,
      fileName: 'plan.jpg',
      fileUrl: 'https://placehold.co/800x600/png?text=Plan+3BR',
      kind: AttachmentKind.PHOTO,
      uploadedById: managerId,
    },
  });

  const dealSale = await prisma.deal.upsert({
    where: { id: 'seed_deal_sale_1' },
    update: { dealStageId: stageIds.saleContract },
    create: {
      id: 'seed_deal_sale_1',
      organizationId: orgId,
      type: DealType.SALE,
      dealStageId: stageIds.saleContract,
      responsibleUserId: managerId,
      clientId: clientPerson1.id,
      propertyId: propApartment.id,
      openedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      amount: 82000,
      advanceAmount: 15000,
      balanceAmount: 67000,
      notes: 'Рассрочка на 8 месяцев, первый платёж внесён.',
    },
  });

  const dealRent = await prisma.deal.upsert({
    where: { id: 'seed_deal_rent_1' },
    update: { dealStageId: stageIds.rentActive },
    create: {
      id: 'seed_deal_rent_1',
      organizationId: orgId,
      type: DealType.RENT,
      dealStageId: stageIds.rentActive,
      responsibleUserId: managerId,
      clientId: clientPerson2.id,
      propertyId: propCommercial.id,
      openedAt: new Date(now.getFullYear(), now.getMonth() - 6, 1),
      amount: 1200,
      advanceAmount: 2400,
      balanceAmount: 0,
      notes: 'Депозит 2 месяца, аренда ежемесячно до 5 числа.',
    },
  });

  const dealBuild = await prisma.deal.upsert({
    where: { id: 'seed_deal_build_1' },
    update: { dealStageId: stageIds.consExec },
    create: {
      id: 'seed_deal_build_1',
      organizationId: orgId,
      type: DealType.CONSTRUCTION,
      dealStageId: stageIds.consExec,
      responsibleUserId: builderId,
      clientId: clientCompany.id,
      constructionProjectId: project.id,
      openedAt: new Date(now.getFullYear(), now.getMonth() - 2, 5),
      amount: 125000,
      advanceAmount: 37500,
      balanceAmount: 87500,
      notes: 'Договор подряда, оплата по этапам.',
    },
  });

  const dealClosed = await prisma.deal.upsert({
    where: { id: 'seed_deal_sale_closed' },
    update: { dealStageId: stageIds.saleClosed },
    create: {
      id: 'seed_deal_sale_closed',
      organizationId: orgId,
      type: DealType.SALE,
      dealStageId: stageIds.saleClosed,
      responsibleUserId: managerId,
      clientId: clientPerson2.id,
      propertyId: propLand.id,
      openedAt: new Date(now.getFullYear(), now.getMonth() - 5, 1),
      closedAt: new Date(now.getFullYear(), now.getMonth() - 3, 15),
      amount: 28000,
      advanceAmount: 28000,
      balanceAmount: 0,
      notes: 'Участок продан, сделка закрыта.',
    },
  });

  await prisma.deal.upsert({
    where: { id: 'seed_deal_fake_lead' },
    update: { dealStageId: stageIds.saleLead },
    create: {
      id: 'seed_deal_fake_lead',
      organizationId: orgId,
      type: DealType.SALE,
      dealStageId: stageIds.saleLead,
      responsibleUserId: managerId,
      clientId: clientFakePerson.id,
      propertyId: propFakeStudio.id,
      openedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      amount: 41000,
      notes: 'FAKE_SEED: фиктивная сделка на этапе «Лид».',
    },
  });

  const sch1Due = new Date(now.getFullYear(), now.getMonth(), 25);
  await prisma.scheduledPayment.upsert({
    where: { id: 'seed_sch_1' },
    update: {},
    create: {
      id: 'seed_sch_1',
      organizationId: orgId,
      dealId: dealSale.id,
      clientId: clientPerson1.id,
      dueDate: sch1Due,
      amount: 8500,
      currency: 'USD',
      normalizedAmountBase: usdToBase(8500),
      fxRateToBase: USD_RATE,
      purpose: 'Рассрочка (месяц 2)',
      status: ScheduleStatus.PLANNED,
    },
  });

  const schOverDue = new Date(now.getFullYear(), now.getMonth() - 1, 5);
  await prisma.scheduledPayment.upsert({
    where: { id: 'seed_sch_overdue' },
    update: {},
    create: {
      id: 'seed_sch_overdue',
      organizationId: orgId,
      dealId: dealRent.id,
      clientId: clientPerson2.id,
      dueDate: schOverDue,
      amount: 1200,
      currency: 'USD',
      normalizedAmountBase: usdToBase(1200),
      fxRateToBase: USD_RATE,
      purpose: 'Аренда офиса',
      status: ScheduleStatus.OVERDUE,
    },
  });

  const schPaidDue = new Date(now.getFullYear(), now.getMonth() - 1, 20);
  await prisma.scheduledPayment.upsert({
    where: { id: 'seed_sch_paid' },
    update: {},
    create: {
      id: 'seed_sch_paid',
      organizationId: orgId,
      dealId: dealBuild.id,
      clientId: clientCompany.id,
      dueDate: schPaidDue,
      amount: 15000,
      currency: 'USD',
      normalizedAmountBase: usdToBase(15000),
      fxRateToBase: USD_RATE,
      purpose: 'Этап: коробка',
      status: ScheduleStatus.PAID,
      paidAt: new Date(now.getFullYear(), now.getMonth() - 1, 19),
    },
  });

  await prisma.income.upsert({
    where: { id: 'seed_inc_rent_1' },
    update: {},
    create: {
      id: 'seed_inc_rent_1',
      organizationId: orgId,
      receivedAt: new Date(now.getFullYear(), now.getMonth(), 3),
      amount: 1200,
      currency: 'USD',
      normalizedAmountBase: usdToBase(1200),
      fxRateToBase: USD_RATE,
      incomeType: 'RENT',
      paymentMethod: 'Перевод на р/с',
      comment: 'Аренда офиса за текущий месяц',
      createdById: accountantId,
      clientId: clientPerson2.id,
      dealId: dealRent.id,
      propertyId: propCommercial.id,
    },
  });

  const incomeBuildMilestone = await prisma.income.upsert({
    where: { id: 'seed_inc_build_milestone' },
    update: {},
    create: {
      id: 'seed_inc_build_milestone',
      organizationId: orgId,
      receivedAt: new Date(now.getFullYear(), now.getMonth() - 1, 19),
      amount: 15000,
      currency: 'USD',
      normalizedAmountBase: usdToBase(15000),
      fxRateToBase: USD_RATE,
      incomeType: 'CONSTRUCTION',
      paymentMethod: 'Безнал',
      comment: 'Оплата по графику: этап «коробка»',
      createdById: accountantId,
      clientId: clientCompany.id,
      dealId: dealBuild.id,
      projectId: project.id,
    },
  });

  await prisma.scheduledPayment.update({
    where: { id: 'seed_sch_paid' },
    data: { linkedIncomeId: incomeBuildMilestone.id },
  });

  await prisma.income.upsert({
    where: { id: 'seed_inc_sale_partial' },
    update: {},
    create: {
      id: 'seed_inc_sale_partial',
      organizationId: orgId,
      receivedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      amount: 15000,
      currency: 'USD',
      normalizedAmountBase: usdToBase(15000),
      fxRateToBase: USD_RATE,
      incomeType: 'SALE',
      paymentMethod: 'Наличные / терминал',
      createdById: accountantId,
      clientId: clientPerson1.id,
      dealId: dealSale.id,
      propertyId: propApartment.id,
    },
  });

  await prisma.income.upsert({
    where: { id: 'seed_inc_company' },
    update: {},
    create: {
      id: 'seed_inc_company',
      organizationId: orgId,
      receivedAt: new Date(now.getFullYear(), now.getMonth(), 1),
      amount: 500,
      currency: 'USD',
      normalizedAmountBase: usdToBase(500),
      fxRateToBase: USD_RATE,
      incomeType: 'OTHER',
      paymentMethod: 'Прочее',
      comment: 'Мелкий сервисный доход (пример)',
      isCompanyLevel: true,
      createdById: accountantId,
    },
  });

  await prisma.expense.upsert({
    where: { id: 'seed_exp_company' },
    update: {},
    create: {
      id: 'seed_exp_company',
      organizationId: orgId,
      paymentDate: new Date(now.getFullYear(), now.getMonth(), 8),
      amount: 450,
      currency: 'USD',
      normalizedAmountBase: usdToBase(450),
      fxRateToBase: USD_RATE,
      expenseType: 'MARKETING',
      paymentTerms: 'По факту оказания услуг',
      paymentMethod: 'Безнал',
      comment: 'Таргет VK/Telegram на квартиры',
      status: ExpenseStatus.PAID,
      scope: ExpenseScope.COMPANY,
      createdById: accountantId,
    },
  });

  await prisma.expense.upsert({
    where: { id: 'seed_exp_deal' },
    update: {},
    create: {
      id: 'seed_exp_deal',
      organizationId: orgId,
      paymentDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      amount: 120,
      currency: 'USD',
      normalizedAmountBase: usdToBase(120),
      fxRateToBase: USD_RATE,
      expenseType: 'DOCUMENTS',
      paymentMethod: 'Наличные',
      comment: 'Нотариальное заверение по сделке SALE',
      status: ExpenseStatus.PAID,
      scope: ExpenseScope.DEAL,
      dealId: dealSale.id,
      createdById: accountantId,
    },
  });

  await prisma.expense.upsert({
    where: { id: 'seed_exp_construction' },
    update: {},
    create: {
      id: 'seed_exp_construction',
      organizationId: orgId,
      paymentDate: new Date(now.getFullYear(), now.getMonth() - 1, 12),
      amount: 8900,
      currency: 'USD',
      normalizedAmountBase: usdToBase(8900),
      fxRateToBase: USD_RATE,
      expenseType: 'MATERIALS',
      paymentTerms: 'Предоплата 30%',
      paymentMethod: 'Перевод',
      comment: 'Поставка арматуры и сетки',
      status: ExpenseStatus.PAID,
      scope: ExpenseScope.CONSTRUCTION,
      projectId: project.id,
      createdById: accountantId,
    },
  });

  await prisma.expense.upsert({
    where: { id: 'seed_exp_planned' },
    update: {},
    create: {
      id: 'seed_exp_planned',
      organizationId: orgId,
      paymentDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      amount: 2200,
      currency: 'USD',
      normalizedAmountBase: usdToBase(2200),
      fxRateToBase: USD_RATE,
      expenseType: 'SERVICES',
      paymentTerms: 'По счёту',
      paymentMethod: 'Безнал',
      comment: 'План: проектирование ландшафта',
      status: ExpenseStatus.PLANNED,
      scope: ExpenseScope.PROPERTY,
      propertyId: propLand.id,
      createdById: accountantId,
    },
  });

  await prisma.dealChangeLog.upsert({
    where: { id: 'seed_dch_1' },
    update: {},
    create: {
      id: 'seed_dch_1',
      dealId: dealSale.id,
      userId: managerId,
      changes: {
        dealStageId: { from: 'seed_ds_sale_1', to: stageIds.saleContract },
        advanceAmount: { from: '0', to: '15000' },
      },
    },
  });

}

async function main() {
  const passwordHash = await bcrypt.hash('GrandAstra!1', 10);

  const org = await prisma.organization.upsert({
    where: { code: 'HQ' },
    update: { baseCurrency: 'UZS' },
    create: {
      name: 'Grand Astra (головной офис)',
      code: 'HQ',
      baseCurrency: 'UZS',
    },
  });

  let salesDept = await prisma.department.findFirst({
    where: { organizationId: org.id, name: 'Продажи и аренда' },
  });
  if (!salesDept) {
    salesDept = await prisma.department.create({
      data: { organizationId: org.id, name: 'Продажи и аренда' },
    });
  }

  let constructionDept = await prisma.department.findFirst({
    where: { organizationId: org.id, name: 'Строительство' },
  });
  if (!constructionDept) {
    constructionDept = await prisma.department.create({
      data: { organizationId: org.id, name: 'Строительство' },
    });
  }

  await seedPermissions();
  await seedRoles(org.id);

  const roleOwner = await prisma.role.findFirstOrThrow({ where: { organizationId: org.id, slug: 'owner' } });
  const roleDirector = await prisma.role.findFirstOrThrow({ where: { organizationId: org.id, slug: 'director' } });
  const roleManager = await prisma.role.findFirstOrThrow({ where: { organizationId: org.id, slug: 'manager' } });
  const roleAccountant = await prisma.role.findFirstOrThrow({
    where: { organizationId: org.id, slug: 'accountant' },
  });
  const roleBuilder = await prisma.role.findFirstOrThrow({
    where: { organizationId: org.id, slug: 'builder_admin' },
  });

  const userSeeds: Array<{
    email: string;
    firstName: string;
    lastName: string;
    roleId: string;
    departmentId?: string;
  }> = [
    { email: 'owner@grandastra.local', firstName: 'Алишер', lastName: 'Каримов', roleId: roleOwner.id },
    {
      email: 'director@grandastra.local',
      firstName: 'Диана',
      lastName: 'Рахимова',
      roleId: roleDirector.id,
      departmentId: salesDept.id,
    },
    {
      email: 'manager@grandastra.local',
      firstName: 'Бобур',
      lastName: 'Тошев',
      roleId: roleManager.id,
      departmentId: salesDept.id,
    },
    {
      email: 'accountant@grandastra.local',
      firstName: 'Гулнора',
      lastName: 'Сидикова',
      roleId: roleAccountant.id,
    },
    {
      email: 'builder@grandastra.local',
      firstName: 'Жасур',
      lastName: 'Умаров',
      roleId: roleBuilder.id,
      departmentId: constructionDept.id,
    },
  ];

  for (const u of userSeeds) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        roleId: u.roleId,
        departmentId: u.departmentId ?? null,
        organizationId: org.id,
        passwordHash,
      },
      create: {
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        roleId: u.roleId,
        passwordHash,
        organizationId: org.id,
        departmentId: u.departmentId ?? null,
      },
    });
  }

  const director = await prisma.user.findUniqueOrThrow({ where: { email: 'director@grandastra.local' } });
  await prisma.department.update({
    where: { id: salesDept.id },
    data: { directorUserId: director.id },
  });

  await prisma.currencyRate.upsert({
    where: { id: 'seed_fx_usd' },
    update: { rateToBase: USD_RATE },
    create: {
      id: 'seed_fx_usd',
      organizationId: org.id,
      quoteCurrency: 'USD',
      rateToBase: USD_RATE,
      validFrom: new Date(2020, 0, 1),
    },
  });

  const stageIds = await seedDealStages(org.id);

  const manager = await prisma.user.findUniqueOrThrow({ where: { email: 'manager@grandastra.local' } });
  const accountant = await prisma.user.findUniqueOrThrow({ where: { email: 'accountant@grandastra.local' } });
  const builder = await prisma.user.findUniqueOrThrow({ where: { email: 'builder@grandastra.local' } });

  await seedDemoData(org.id, stageIds, manager.id, accountant.id, builder.id);

  // eslint-disable-next-line no-console
  console.log('Seed OK. Демо-данные загружены (в т.ч. FAKE_SEED). Учётные данные не выводятся в лог.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
