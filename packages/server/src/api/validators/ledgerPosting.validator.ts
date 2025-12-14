// packages/server/src/api/validators/ledgerPosting.validator.ts

/**
 * Ledger Posting Validator
 *
 * ROLE:
 * - Validate HTTP input shape BEFORE touching domain objects
 * - Reject malformed or unsafe input early
 *
 * NON-RESPONSIBILITIES:
 * - NO business rules
 * - NO accounting invariants
 * - NO period state checks
 *
 * Those are enforced later by:
 * - LedgerPosting (domain)
 * - LedgerPostingWriteGuard (application)
 */

import { CreateLedgerPostingDTO } from '../dto/CreateLedgerPostingDTO';

export function validateCreateLedgerPostingDTO(
  input: any
): asserts input is CreateLedgerPostingDTO {
  if (!input || typeof input !== 'object') {
    throw new Error('Request body must be an object');
  }

  if (typeof input.postingId !== 'string' || input.postingId.trim() === '') {
    throw new Error('postingId is required and must be a non-empty string');
  }

  if (typeof input.occurredAt !== 'string') {
    throw new Error('occurredAt must be an ISO-8601 string');
  }

  if (!Array.isArray(input.entries) || input.entries.length < 2) {
    throw new Error('entries must be an array with at least two items');
  }

  for (const [index, entry] of input.entries.entries()) {
    if (typeof entry.accountId !== 'string' || entry.accountId.trim() === '') {
      throw new Error(`entries[${index}].accountId must be a non-empty string`);
    }

    if (entry.side !== 'DEBIT' && entry.side !== 'CREDIT') {
      throw new Error(
        `entries[${index}].side must be either DEBIT or CREDIT`
      );
    }

    if (typeof entry.amount !== 'number' || entry.amount <= 0) {
      throw new Error(
        `entries[${index}].amount must be a positive number`
      );
    }

    if (typeof entry.currency !== 'string' || entry.currency.trim() === '') {
      throw new Error(
        `entries[${index}].currency must be a non-empty string`
      );
    }

    if (typeof entry.periodStart !== 'string') {
      throw new Error(
        `entries[${index}].periodStart must be an ISO-8601 string`
      );
    }

    if (typeof entry.periodEnd !== 'string') {
      throw new Error(
        `entries[${index}].periodEnd must be an ISO-8601 string`
      );
    }
  }
}
