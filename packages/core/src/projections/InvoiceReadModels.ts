// packages/core/src/projections/InvoiceReadModels.ts

import { InvoiceStatus, Money } from '../domain/Invoice';

export interface InvoiceSummaryRM {
  id: string;
  invoiceNumber?: string;
  status: InvoiceStatus;

  customerId: string;
  customerName?: string;

  issuedAt?: string; // ISO
  dueAt?: string; // ISO

  currency: string;
  total: Money;
  amountDue: Money;

  saleOrderId?: string;

  updatedAt: string; // ISO
}

export interface InvoiceDetailRM extends InvoiceSummaryRM {
  lines: Array<{
    lineId: string;
    productId?: string;
    description: string;
    quantity: number;
    unitPrice: Money;
    taxRate: number;
  }>;
  subtotal: Money;
  taxTotal: Money;
  paidTotal: Money;

  notes?: string;

  createdAt: string; // ISO
  cancelledAt?: string; // ISO
}
