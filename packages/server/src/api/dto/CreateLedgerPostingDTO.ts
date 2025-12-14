// packages/server/src/api/dto/CreateLedgerPostingDTO.ts

/**
 * CreateLedgerPostingDTO
 *
 * HTTP boundary DTO for creating a ledger posting.
 *
 * PURPOSE:
 * - Define the exact shape accepted from the outside world
 * - Prevent domain leakage into the transport layer
 *
 * NOTES:
 * - This DTO is NOT a domain object
 * - No behavior, no validation logic here
 * - Validation is handled separately
 */

export interface CreateLedgerEntryDTO {
  accountId: string;
  side: 'DEBIT' | 'CREDIT';
  amount: number;
  currency: string;
  periodStart: string; // ISO-8601 date string
  periodEnd: string;   // ISO-8601 date string
}

export interface CreateLedgerPostingDTO {
  postingId: string;
  occurredAt: string; // ISO-8601 date string
  entries: CreateLedgerEntryDTO[];
}
