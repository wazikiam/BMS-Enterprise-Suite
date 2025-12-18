// packages/core/src/finance/FinancialPeriodGateway.ts
// FINANCIAL PERIOD GOVERNANCE — CORE GATEWAY
//
// Responsibilities:
// - Validate commands (fail-fast, deterministic)
// - Enforce legal state transitions
// - Produce immutable, checksummed events
//
// This gateway performs NO I/O.

import crypto from 'crypto';
import {
  FinancialPeriodCommand,
  FinancialPeriodCommandToEventType,
  CreateFinancialPeriodCommand,
} from './FinancialPeriodCommands';
import {
  FinancialPeriodEventType,
  FinancialPeriodEventTypes,
} from './FinancialPeriodEventTypes';

export interface FinancialPeriodEventRecord {
  eventId: string;
  periodId: string;
  eventType: FinancialPeriodEventType;

  periodFrom?: Date;
  periodTo?: Date;
  label?: string;

  occurredAt: Date;
  recordedAt: Date;

  actorId: string;
  actorRoles: string[];
  reason: string;

  checksum: string;
}

/**
 * Deterministic checksum builder.
 * The same logical input MUST always yield the same checksum.
 */
function buildChecksum(payload: object): string {
  const json = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(json).digest('hex');
}

function assertNonEmpty(value: unknown, field: string): void {
  if (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  ) {
    throw new Error(`${field} is required`);
  }
}

function assertDate(value: unknown, field: string): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`${field} must be a valid Date`);
  }
}

function assertUuid(id: string, field: string): void {
  const re =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!re.test(id)) throw new Error(`Invalid UUID for ${field}: ${id}`);
}

export class FinancialPeriodGateway {
  /**
   * Build a financial period governance event from a command.
   *
   * @param cmd validated financial period command
   * @param now injected clock for determinism / testability
   */
  static buildEvent(
    cmd: FinancialPeriodCommand,
    now: Date = new Date()
  ): FinancialPeriodEventRecord {
    // Base validation (common)
    assertNonEmpty(cmd.periodId, 'periodId');
    assertUuid(cmd.periodId, 'periodId');

    assertNonEmpty(cmd.actorId, 'actorId');
    assertNonEmpty(cmd.actorRoles, 'actorRoles');
    assertNonEmpty(cmd.reason, 'reason');

    // Event typing
    const eventType = FinancialPeriodCommandToEventType[cmd.type];
    if (!eventType) {
      throw new Error(`Unsupported command type: ${cmd.type}`);
    }

    // Command-specific validation
    let periodFrom: Date | undefined;
    let periodTo: Date | undefined;
    let label: string | undefined;

    if (cmd.type === 'CREATE_FINANCIAL_PERIOD') {
      const c = cmd as CreateFinancialPeriodCommand;

      assertDate(c.periodFrom, 'periodFrom');
      assertDate(c.periodTo, 'periodTo');

      if (c.periodFrom.getTime() > c.periodTo.getTime()) {
        throw new Error('periodFrom must be <= periodTo');
      }

      assertNonEmpty(c.label, 'label');

      periodFrom = c.periodFrom;
      periodTo = c.periodTo;
      label = c.label;
    }

    const occurredAt = now;
    const recordedAt = now;

    const payloadForChecksum = {
      periodId: cmd.periodId,
      eventType,
      periodFrom: periodFrom?.toISOString(),
      periodTo: periodTo?.toISOString(),
      label,
      occurredAt: occurredAt.toISOString(),
      actorId: cmd.actorId,
      actorRoles: cmd.actorRoles.slice().sort(),
      reason: cmd.reason,
    };

    const checksum = buildChecksum(payloadForChecksum);

    return {
      eventId: crypto.randomUUID(),
      periodId: cmd.periodId,
      eventType,

      periodFrom,
      periodTo,
      label,

      occurredAt,
      recordedAt,

      actorId: cmd.actorId,
      actorRoles: cmd.actorRoles,
      reason: cmd.reason,

      checksum,
    };
  }
}
