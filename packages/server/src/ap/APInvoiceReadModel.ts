// packages/server/src/ap/APInvoiceReadModel.ts
// AP Invoice READ MODEL (SERVER)
//
// PHASE 6 — STEP 6
//
// Rules:
// - Derived ONLY from ap_invoice_events
// - Deterministic fold over event stream
// - No writes, no side effects
// - Void removes invoice from active set (kept as voided flag)

import type {
  APInvoiceEvent,
  APInvoiceIssued,
  APInvoiceUpdatedMetadata,
  APInvoiceVoided,
} from '@bms/core/src/ap/APInvoiceEvent';

export type APInvoiceReadView = {
  invoiceId: string;

  supplierId: string;
  supplierInvoiceNumber: string;

  invoiceDate: string;
  dueDate: string;

  currency: string;

  subtotalMinor: number;
  taxTotalMinor: number;
  totalMinor: number;

  notes?: string;

  status: 'OPEN' | 'VOIDED';

  issuedAt: string; // occurredAt of ISSUE
  lastUpdatedAt: string;
};

export class APInvoiceReadModel {
  static project(events: readonly APInvoiceEvent[]): APInvoiceReadView | null {
    let state: APInvoiceReadView | null = null;

    for (const event of events) {
      switch (event.eventType) {
        case 'AP_INVOICE_ISSUED': {
          const e = event as APInvoiceIssued;

          state = {
            invoiceId: e.invoiceId,

            supplierId: e.supplierId,
            supplierInvoiceNumber: e.supplierInvoiceNumber,

            invoiceDate: e.invoiceDate,
            dueDate: e.dueDate,

            currency: e.currency,

            subtotalMinor: e.subtotalMinor.amountMinor,
            taxTotalMinor: e.taxTotalMinor.amountMinor,
            totalMinor: e.totalMinor.amountMinor,

            notes: e.notes,

            status: 'OPEN',

            issuedAt: e.occurredAt,
            lastUpdatedAt: e.occurredAt,
          };
          break;
        }

        case 'AP_INVOICE_UPDATED_METADATA': {
          if (!state) break;
          const e = event as APInvoiceUpdatedMetadata;

          state = {
            ...state,
            supplierInvoiceNumber:
              e.supplierInvoiceNumber ?? state.supplierInvoiceNumber,
            dueDate: e.dueDate ?? state.dueDate,
            notes: e.notes ?? state.notes,
            lastUpdatedAt: e.occurredAt,
          };
          break;
        }

        case 'AP_INVOICE_VOIDED': {
          if (!state) break;
          const e = event as APInvoiceVoided;

          state = {
            ...state,
            status: 'VOIDED',
            lastUpdatedAt: e.occurredAt,
          };
          break;
        }

        default:
          assertNever(event);
      }
    }

    return state;
  }
}

function assertNever(x: never): never {
  throw new Error(`Unhandled APInvoiceEvent in read model: ${JSON.stringify(x)}`);
}
