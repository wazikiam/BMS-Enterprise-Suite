// packages/core/src/finance/FinancialPeriodCommands.ts
// FINANCIAL PERIOD GOVERNANCE — COMMAND CONTRACTS
//
// Finance Core — Period Close & Locking
// Commands are validated at the boundary before producing immutable events.

import { FinancialPeriodEventType } from './FinancialPeriodEventTypes';

/**
 * Base command metadata shared by all financial period commands.
 */
export interface FinancialPeriodCommandBase {
  periodId: string;      // stable identifier for the period lifecycle
  actorId: string;       // required, non-empty
  actorRoles: string[];  // required, non-empty
  reason: string;        // required, non-empty (audit justification)
}

/**
 * Create (open) a new financial period.
 */
export interface CreateFinancialPeriodCommand
  extends FinancialPeriodCommandBase {
  type: 'CREATE_FINANCIAL_PERIOD';
  periodFrom: Date;
  periodTo: Date;
  label: string;
}

/**
 * Close an existing financial period.
 */
export interface CloseFinancialPeriodCommand
  extends FinancialPeriodCommandBase {
  type: 'CLOSE_FINANCIAL_PERIOD';
}

/**
 * Reopen a previously closed financial period.
 * This is a governed exception, not a mutation.
 */
export interface ReopenFinancialPeriodCommand
  extends FinancialPeriodCommandBase {
  type: 'REOPEN_FINANCIAL_PERIOD';
}

/**
 * Place a legal hold on a financial period.
 */
export interface SetFinancialPeriodLegalHoldCommand
  extends FinancialPeriodCommandBase {
  type: 'SET_FINANCIAL_PERIOD_LEGAL_HOLD';
}

/**
 * Clear a legal hold on a financial period.
 */
export interface ClearFinancialPeriodLegalHoldCommand
  extends FinancialPeriodCommandBase {
  type: 'CLEAR_FINANCIAL_PERIOD_LEGAL_HOLD';
}

/**
 * Union of all supported financial period commands.
 */
export type FinancialPeriodCommand =
  | CreateFinancialPeriodCommand
  | CloseFinancialPeriodCommand
  | ReopenFinancialPeriodCommand
  | SetFinancialPeriodLegalHoldCommand
  | ClearFinancialPeriodLegalHoldCommand;

/**
 * Mapping from command to emitted event type.
 * This is intentionally explicit to avoid implicit behavior.
 */
export const FinancialPeriodCommandToEventType: Record<
  FinancialPeriodCommand['type'],
  FinancialPeriodEventType
> = {
  CREATE_FINANCIAL_PERIOD: 'PERIOD_CREATED',
  CLOSE_FINANCIAL_PERIOD: 'PERIOD_CLOSED',
  REOPEN_FINANCIAL_PERIOD: 'PERIOD_REOPENED',
  SET_FINANCIAL_PERIOD_LEGAL_HOLD: 'LEGAL_HOLD_SET',
  CLEAR_FINANCIAL_PERIOD_LEGAL_HOLD: 'LEGAL_HOLD_CLEARED',
};
