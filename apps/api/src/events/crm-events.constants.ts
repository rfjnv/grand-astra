export const CrmEvents = {
  DEAL_STAGE_CHANGED: 'crm.deal.stage_changed',
  DEAL_CREATED: 'crm.deal.created',
  CLIENT_CREATED: 'crm.client.created',
  PAYMENT_RECEIVED: 'crm.payment.received',
  EXPENSE_CREATED: 'crm.expense.created',
  PAYMENT_OVERDUE: 'crm.payment.overdue',
} as const;

export type DealStageChangedPayload = {
  organizationId: string;
  dealId: string;
  fromStageId: string | null;
  toStageId: string;
  actorUserId: string;
  dealType: string;
};

export type DealCreatedPayload = {
  organizationId: string;
  dealId: string;
  actorUserId: string;
  responsibleUserId: string;
  clientLabel: string;
};

export type ClientCreatedPayload = {
  organizationId: string;
  clientId: string;
  actorUserId: string;
  clientLabel: string;
};

export type PaymentReceivedPayload = {
  organizationId: string;
  incomeId: string;
  actorUserId: string;
  amount: string;
  currency: string;
  dealId: string | null;
};

export type PaymentOverduePayload = {
  organizationId: string;
  scheduleId: string;
  dealId: string;
  amount: string;
  currency: string;
  dueDate: Date;
};
