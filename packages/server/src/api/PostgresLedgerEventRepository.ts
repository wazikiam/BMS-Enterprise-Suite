// packages/server/src/api/PostgresLedgerEventRepository.ts
// POSTGRES LEDGER EVENT REPOSITORY (APPEND-ONLY)
// - No reads
// - No updates
// - No deletes
// - Actor-enforced
// - Deterministic checksum via core gateway

import {
  LedgerEventRecord,
  LedgerWriteActor,
  LedgerWriteCommand,
  LedgerWriteGateway
} from '@bms/core/src/ledger/LedgerWriteGateway';

export interface SqlClient {
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }>;
}

function assertUuid(id: string, field: string): void {
  // strict UUID v4-ish format; sufficient for rejecting obvious invalid input
  const re =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!re.test(id)) throw new Error(`Invalid UUID for ${field}: ${id}`);
}

function normalizeMoneyAmount(value: number | undefined, field: string): string | null {
  if (value === undefined) return null;

  if (!Number.isFinite(value)) {
    throw new Error(`${field} must be a finite number`);
  }
  if (value < 0) {
    throw new Error(`${field} must be non-negative`);
  }

  // Validate "exact to 6 decimals" without rounding side effects.
  const scaled = value * 1_000_000;
  const nearest = Math.round(scaled);

  // If the value is representable to 6 decimals, the difference is effectively zero.
  const diff = Math.abs(scaled - nearest);
  if (diff > 1e-6) {
    throw new Error(`${field} must have at most 6 decimal places`);
  }

  // Convert deterministically to a DB-safe numeric string (no scientific notation).
  // This does not change value because we validated representability above.
  const s = (nearest / 1_000_000).toFixed(6);

  // Trim trailing zeros, keep at least one decimal if needed.
  // Examples: "10.000000" -> "10", "10.120000" -> "10.12"
  return s.replace(/\.?0+$/, '');
}

export class PostgresLedgerEventRepository {
  constructor(private readonly db: SqlClient) {}

  /**
   * Append a single ledger event.
   * This is the only sanctioned write entry into public.ledger_events.
   */
  async append(cmd: LedgerWriteCommand, actor: LedgerWriteActor): Promise<LedgerEventRecord> {
    // core-level validation + checksum
    const event = LedgerWriteGateway.buildEvent(cmd, actor);

    // additional structural validation at boundary
    assertUuid(event.eventId, 'eventId');
    assertUuid(event.journalId, 'journalId');

    const debit = normalizeMoneyAmount(event.debitAmount, 'debitAmount');
    const credit = normalizeMoneyAmount(event.creditAmount, 'creditAmount');

    const sql = `
      INSERT INTO public.ledger_events(
        event_id,
        journal_id,
        event_type,
        occurred_at,
        recorded_at,
        account_code,
        debit_amount,
        credit_amount,
        currency,
        actor_id,
        actor_roles,
        reason,
        checksum
      )
      VALUES (
        $1,  $2,  $3,  $4,  $5,
        $6,  $7,  $8,  $9,  $10,
        $11, $12, $13
      );
    `;

    const params = [
      event.eventId,
      event.journalId,
      event.eventType,
      event.occurredAt.toISOString(),
      event.recordedAt.toISOString(),
      event.accountCode ?? null,
      debit,
      credit,
      event.currency,
      event.actorId,
      Array.from(event.actorRoles),
      event.reason,
      event.checksum
    ];

    await this.db.query(sql, params);

    return event;
  }
}
