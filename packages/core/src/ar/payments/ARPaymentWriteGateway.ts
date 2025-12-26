// packages/core/src/ar/payments/ARPaymentWriteGateway.ts
// AR PAYMENT WRITE GATEWAY (CANONICAL, DETERMINISTIC)
//
// - No persistence
// - No side effects
// - Attaches actor metadata
// - Computes checksum
// - Single sanctioned boundary between core and infrastructure

import crypto from 'crypto';

import { ARPaymentEvent } from './ARPaymentEvents';

/* ------------------------------------------------
 * Types
 * ------------------------------------------------ */

export interface ARPaymentWriteActor {
  actorId: string;
  roles: readonly string[];
}

/**
 * Persistence-ready AR payment event record.
 * Uses type intersection because ARPaymentEvent is a union.
 */
export type ARPaymentEventRecord = ARPaymentEvent & {
  recordedAt: Date;
  actorId: string;
  actorRoles: readonly string[];
  checksum: string;
};

/* ------------------------------------------------
 * Gateway
 * ------------------------------------------------ */

export class ARPaymentWriteGateway {
  /**
   * Build a persistence-ready AR payment event.
   * This is the ONLY sanctioned way to cross from core into infrastructure.
   */
  static buildEvent(
    event: ARPaymentEvent,
    actor: ARPaymentWriteActor
  ): ARPaymentEventRecord {
    const recordedAt = new Date();

    const materialized = {
      ...event,
      recordedAt,
      actorId: actor.actorId,
      actorRoles: actor.roles,
    };

    const checksum = crypto
      .createHash('sha256')
      .update(JSON.stringify(materialized))
      .digest('hex');

    return {
      ...materialized,
      checksum,
    };
  }
}
