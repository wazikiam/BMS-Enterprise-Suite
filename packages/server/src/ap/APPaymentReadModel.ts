// packages/server/src/ap/APPaymentReadModel.ts
// AP PAYMENT READ MODEL (SERVER)
//
// PHASE 6 — STEP 11
//
// Contract:
// - Derived ONLY from ap_payment_events
// - Read-only, deterministic
// - No side effects, no writes
// - Mirrors AR Payment READ rigor

import type {
  APPaymentEvent,
  APPaymentRecorded,
  APPaymentAllocatedToInvoice,
  APPaymentUnallocatedFromInvoice,
  APPaymentReversed,
} from '@bms/core/src/ap/APPaymentEvent';

export type APPaymentAllocationView = {
  invoiceId: string;
  allocatedMinor: number;
  currency: string;
};

export type APPaymentReadView = {
  paymentId: string;
  supplierId: string | null;

  amountMinor: number;
  currency: string;

  allocatedMinor: number;
  unallocatedMinor: number;

  method: string | null;
  reference?: string;
  notes?: string;

  status:
    | 'RECORDED'
    | 'PARTIALLY_ALLOCATED'
    | 'FULLY_ALLOCATED'
    | 'REVERSED';

  allocations: readonly APPaymentAllocationView[];

  occurredAt: string;
  lastEventAt: string;
};

export class APPaymentReadModel {
  /**
   * Deterministically fold an event stream into a read view.
   */
  static fold(events: readonly APPaymentEvent[]): APPaymentReadView {
    if (events.length === 0) {
      throw new Error('Cannot build AP payment read model from empty event stream');
    }

    let paymentId: string | null = null;
    let supplierId: string | null = null;

    let amountMinor = 0;
    let currency: string | null = null;

    let method: string | null = null;
    let reference: string | undefined;
    let notes: string | undefined;

    let reversed = false;

    const allocations = new Map<string, APPaymentAllocationView>();

    let occurredAt = events[0].occurredAt;
    let lastEventAt = events[0].occurredAt;

    for (const e of events) {
      lastEventAt = e.occurredAt;

      switch (e.eventType) {
        case 'AP_PAYMENT_RECORDED': {
          const ev = e as APPaymentRecorded;

          paymentId = ev.paymentId;
          supplierId = ev.supplierId;

          amountMinor = ev.amountMinor.amountMinor;
          currency = ev.amountMinor.currency;

          method = ev.method;
          reference = ev.reference;
          notes = ev.notes;

          occurredAt = ev.occurredAt;
          break;
        }

        case 'AP_PAYMENT_ALLOCATED_TO_INVOICE': {
          const ev = e as APPaymentAllocatedToInvoice;

          const existing = allocations.get(ev.invoiceId);
          const nextMinor =
            (existing?.allocatedMinor ?? 0) + ev.allocationMinor.amountMinor;

          allocations.set(ev.invoiceId, {
            invoiceId: ev.invoiceId,
            allocatedMinor: nextMinor,
            currency: ev.allocationMinor.currency,
          });
          break;
        }

        case 'AP_PAYMENT_UNALLOCATED_FROM_INVOICE': {
          const ev = e as APPaymentUnallocatedFromInvoice;

          const existing = allocations.get(ev.invoiceId);
          if (!existing) break;

          const nextMinor =
            existing.allocatedMinor - ev.unallocationMinor.amountMinor;

          if (nextMinor <= 0) {
            allocations.delete(ev.invoiceId);
          } else {
            allocations.set(ev.invoiceId, {
              invoiceId: ev.invoiceId,
              allocatedMinor: nextMinor,
              currency: ev.unallocationMinor.currency,
            });
          }
          break;
        }

        case 'AP_PAYMENT_REVERSED': {
          reversed = true;
          break;
        }

        default:
          assertNever(e);
      }
    }

    if (!paymentId || !currency) {
      throw new Error('Invalid AP payment event stream (missing base record)');
    }

    const allocatedMinor = Array.from(allocations.values()).reduce(
      (sum, a) => sum + a.allocatedMinor,
      0
    );

    const unallocatedMinor = Math.max(amountMinor - allocatedMinor, 0);

    let status: APPaymentReadView['status'] = 'RECORDED';
    if (reversed) {
      status = 'REVERSED';
    } else if (allocatedMinor === 0) {
      status = 'RECORDED';
    } else if (allocatedMinor < amountMinor) {
      status = 'PARTIALLY_ALLOCATED';
    } else {
      status = 'FULLY_ALLOCATED';
    }

    return {
      paymentId,
      supplierId,

      amountMinor,
      currency,

      allocatedMinor,
      unallocatedMinor,

      method,
      reference,
      notes,

      status,
      allocations: Object.freeze(Array.from(allocations.values())),

      occurredAt,
      lastEventAt,
    };
  }
}

export function assertNever(x: never): never {
  throw new Error(`Unhandled APPaymentEvent in read model: ${JSON.stringify(x)}`);
}
