// packages/server/src/ar/mapARInvoiceEvent.ts
// Maps persistence records → domain events
// This file is the ONLY translation boundary

import { ARInvoiceEvent } from '@bms/core/src/ar/AccountsReceivable';
import { ARInvoiceEventRecord } from './PostgresARInvoiceEventRepository';

export function mapARInvoiceEvent(
  record: ARInvoiceEventRecord
): ARInvoiceEvent {
  switch (record.eventType) {
    case 'AR_INVOICE_CREATED':
      return {
        type: 'AR_INVOICE_CREATED',
        invoiceId: record.invoiceId,
        customerId: record.payload.customerId,
        currency: record.payload.currency,
        totalAmount: record.payload.totalAmount,
        occurredAt: record.eventTime,
      };

    case 'AR_INVOICE_ISSUED':
      return {
        type: 'AR_INVOICE_ISSUED',
        invoiceId: record.invoiceId,
        issuedAt: new Date(record.payload.issuedAt),
        occurredAt: record.eventTime,
      };

    case 'AR_INVOICE_VOIDED':
      return {
        type: 'AR_INVOICE_VOIDED',
        invoiceId: record.invoiceId,
        reason: record.payload.reason,
        occurredAt: record.eventTime,
      };

    default:
      throw new Error(`Unknown AR invoice event: ${record.eventType}`);
  }
}
