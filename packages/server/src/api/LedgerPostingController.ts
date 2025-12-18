// packages/server/src/api/LedgerPostingController.ts
// LEDGER POSTING CONTROLLER — WRITE SIDE (Week 20 ENABLED)

import { Request, Response } from 'express';
import { PostgresLedgerEventRepository } from './PostgresLedgerEventRepository';
import {
  LedgerWriteCommand,
  LedgerWriteActor,
} from '@bms/core/src/ledger/LedgerWriteGateway';

export class LedgerPostingController {
  constructor(
    private readonly repository: PostgresLedgerEventRepository
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    try {
      const actorCtx = (req as any).actor;
      if (
        !actorCtx ||
        typeof actorCtx.id !== 'string' ||
        !Array.isArray(actorCtx.roles)
      ) {
        res.status(403).json({
          error: 'Forbidden: actor context missing',
        });
        return;
      }

      const body = req.body ?? {};

      const {
        eventId,
        journalId,
        eventType,
        occurredAt,
        accountCode,
        debitAmount,
        creditAmount,
        currency,
        reason,
      } = body;

      if (
        !eventId ||
        !journalId ||
        !eventType ||
        !occurredAt ||
        !currency ||
        !reason
      ) {
        res.status(400).json({
          error: 'Ledger event rejected',
          reason: 'Missing required fields',
        });
        return;
      }

      const occurredAtDate = new Date(occurredAt);
      if (Number.isNaN(occurredAtDate.getTime())) {
        res.status(400).json({
          error: 'Ledger event rejected',
          reason: 'Invalid occurredAt timestamp',
        });
        return;
      }

      const cmd: LedgerWriteCommand = {
        eventId,
        journalId,
        eventType,
        occurredAt: occurredAtDate,
        accountCode,
        debitAmount,
        creditAmount,
        currency,
        reason,
      };

      const actor: LedgerWriteActor = {
        actorId: actorCtx.id,
        roles: actorCtx.roles,
      };

      const event = await this.repository.append(cmd, actor);

      res.status(201).json({
        eventId: event.eventId,
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'Ledger event rejected',
        reason: err?.message ?? 'Unknown error',
      });
    }
  }
}
