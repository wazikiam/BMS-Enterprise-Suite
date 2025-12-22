// packages/server/src/ar/arInvoiceDomainMapper.ts
// Persistence → Domain boundary (AR Invoices)
// This file is the SINGLE source of truth for mapping

import { ARInvoiceEvent } from '@bms/core/src/ar/AccountsReceivable';

export type ARInvoiceEventRecord = {
  eventType: string;
  invoiceId: string;
  eventTime: Date;
  payload: any;
};

export function toARInvoiceDomainEvent(
  row: ARInvoiceEventRecord
): ARInvoiceEvent {
  switch (row.eventType) {
    case 'AR_INVOICE_ISSUED':
      return {
        type: 'AR_INVOICE_ISSUED',
        invoiceId: row.invoiceId,
        issuedAt: new Date(row.payload.issuedAt),
        occurredAt: new Date(row.eventTime),
      };

    case 'AR_INVOICE_VOIDED':
      return {
        type: 'AR_INVOICE_VOIDED',
        invoiceId: row.invoiceId,
        reason: row.payload.reason,
        occurredAt: new Date(row.eventTime),
      };

    default:
      throw new Error(
        `Unsupported AR invoice event type: ${row.eventType}`
      );
  }
}
