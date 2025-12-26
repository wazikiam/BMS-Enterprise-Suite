// packages/server/src/ar/payments/arPaymentWriteHandler.ts
//
// BMS Enterprise Suite — Server
// Phase 4.4 — AR Payments
//
// WRITE-SIDE COMMAND HANDLER (CANONICAL)
// - Actor enforced
// - Invariants enforced
// - Events decided in core
// - Events persisted append-only
// - No reads
// - No projections

import { Request, Response } from 'express';
import { getPostgresPool } from '../../db/PostgresClient';

import {
  ARPaymentCommand,
  decideARPayment,
  enforceARPaymentInvariants,
  initialARPaymentState,
  reduceARPayment,
} from '@bms/core';

import { ARPaymentWriteGateway } from '@bms/core/src/ar/payments/ARPaymentWriteGateway';
import { PostgresARPaymentEventRepository } from '../../api/PostgresARPaymentEventRepository';

export async function handleARPaymentCommand(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // ─────────────────────────────────────────────────────────
    // ACTOR (FAIL-CLOSED)
    // ─────────────────────────────────────────────────────────

    const actorCtx = (req as any).actor;
    if (!actorCtx) {
      res.status(403).json({ error: 'Forbidden: actor identity required' });
      return;
    }

    // ─────────────────────────────────────────────────────────
    // PARSE COMMAND
    // ─────────────────────────────────────────────────────────

    const command = req.body as ARPaymentCommand;
    if (!command || !command.commandType || !command.paymentId) {
      res.status(400).json({ error: 'Invalid ARPayment command payload' });
      return;
    }

    // ─────────────────────────────────────────────────────────
    // REBUILD STATE (EVENT-SOURCED)
    // ─────────────────────────────────────────────────────────

    const pool = getPostgresPool();
    const repo = new PostgresARPaymentEventRepository(pool);

    const { rows: pastEvents } = await pool.query(
      `
      SELECT
        event_id        AS "eventId",
        payment_id      AS "paymentId",
        event_type      AS "eventType",
        occurred_at     AS "eventTime",
        amount_minor    AS "amountMinor",
        currency,
        invoice_id      AS "invoiceId",
        reason
      FROM public.ar_payment_events
      WHERE payment_id = $1
      ORDER BY occurred_at ASC
      `,
      [command.paymentId]
    );

    let state = initialARPaymentState();
    for (const evt of pastEvents) {
      state = reduceARPayment(state, evt);
    }

    // ─────────────────────────────────────────────────────────
    // INVARIANTS + DECISION
    // ─────────────────────────────────────────────────────────

    enforceARPaymentInvariants(state, command);

    const newEvents = decideARPayment(state, command);
    if (newEvents.length === 0) {
      res.status(200).json({ status: 'NO_OP' });
      return;
    }

    // ─────────────────────────────────────────────────────────
    // PERSIST EVENTS (APPEND-ONLY)
    // ─────────────────────────────────────────────────────────

    const actor = {
      actorId: actorCtx.actorId,
      roles: actorCtx.roles,
    };

    for (const evt of newEvents) {
      const record = ARPaymentWriteGateway.buildEvent(evt, actor);
      await repo.append(record); // ✅ FIXED
    }

    res.status(201).json({
      status: 'OK',
      eventsAppended: newEvents.length,
    });
  } catch (err: any) {
    res.status(400).json({
      error: 'AR payment command rejected',
      reason: err?.message ?? 'Unknown error',
    });
  }
}
