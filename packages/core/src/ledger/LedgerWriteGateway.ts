// packages/core/src/ledger/LedgerWriteGateway.ts
// AUTHORITATIVE LEDGER WRITE KERNEL
// All financial truth enters the system through this gate only

import crypto from 'crypto';
import { LedgerEventType, ALL_LEDGER_EVENT_TYPES } from './LedgerEventTypeRegistry';

export interface LedgerWriteActor {
  actorId: string;
  roles: readonly string[];
}

export interface LedgerWriteCommand {
  eventId: string;
  journalId: string;
  eventType: LedgerEventType;
  occurredAt: Date;

  accountCode?: string;
  debitAmount?: number;
  creditAmount?: number;
  currency: string;

  reason: string;
}

export interface LedgerEventRecord extends LedgerWriteCommand {
  recordedAt: Date;
  actorId: string;
  actorRoles: readonly string[];
  checksum: string;
}

export class LedgerWriteGateway {
  static validateEventType(eventType: LedgerEventType): void {
    if (!ALL_LEDGER_EVENT_TYPES.includes(eventType)) {
      throw new Error(`Ledger event type not registered: ${eventType}`);
    }
  }

  static validateAmounts(cmd: LedgerWriteCommand): void {
    const hasDebit = cmd.debitAmount !== undefined;
    const hasCredit = cmd.creditAmount !== undefined;

    if (hasDebit && hasCredit) {
      throw new Error('Ledger command cannot have both debit and credit amounts');
    }

    if (hasDebit && cmd.debitAmount! < 0) {
      throw new Error('Debit amount must be non-negative');
    }

    if (hasCredit && cmd.creditAmount! < 0) {
      throw new Error('Credit amount must be non-negative');
    }
  }

  static assertActor(actor: LedgerWriteActor): void {
    if (!actor.actorId) {
      throw new Error('Missing actorId');
    }
    if (!actor.roles || actor.roles.length === 0) {
      throw new Error('Actor roles are required');
    }
  }

  static computeChecksum(record: Omit<LedgerEventRecord, 'checksum'>): string {
    const payload = JSON.stringify({
      eventId: record.eventId,
      journalId: record.journalId,
      eventType: record.eventType,
      occurredAt: record.occurredAt.toISOString(),
      accountCode: record.accountCode ?? null,
      debitAmount: record.debitAmount ?? null,
      creditAmount: record.creditAmount ?? null,
      currency: record.currency,
      actorId: record.actorId,
      actorRoles: record.actorRoles,
      reason: record.reason
    });

    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  static buildEvent(
    cmd: LedgerWriteCommand,
    actor: LedgerWriteActor,
    recordedAt: Date = new Date()
  ): LedgerEventRecord {
    this.validateEventType(cmd.eventType);
    this.validateAmounts(cmd);
    this.assertActor(actor);

    const base: Omit<LedgerEventRecord, 'checksum'> = {
      ...cmd,
      recordedAt,
      actorId: actor.actorId,
      actorRoles: actor.roles
    };

    return {
      ...base,
      checksum: this.computeChecksum(base)
    };
  }
}
