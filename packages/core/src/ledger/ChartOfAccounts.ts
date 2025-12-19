// packages/core/src/ledger/ChartOfAccounts.ts
// CHART OF ACCOUNTS — CORE CANONICAL CONTRACT
//
// Governance-grade, read-only, deterministic
// Defines WHAT accounts exist and HOW they behave
//
// This file is:
// - Pure Core (no infrastructure)
// - Closed & explicit
// - Safe to freeze once AR/AP begins

/**
 * Normal balance side for an account.
 *
 * - ASSETS, EXPENSES → DEBIT
 * - LIABILITIES, EQUITY, REVENUE → CREDIT
 */
export type NormalBalance = 'DEBIT' | 'CREDIT';

/**
 * High-level statutory account categories.
 */
export enum AccountCategory {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
}

/**
 * Canonical account definition.
 */
export interface ChartAccount {
  code: string;
  name: string;
  category: AccountCategory;
  normalBalance: NormalBalance;
}

/**
 * Closed, explicit Chart of Accounts registry.
 *
 * NOTE:
 * - This list is intentionally minimal.
 * - Extend only with governance approval.
 */
export const CHART_OF_ACCOUNTS: readonly ChartAccount[] = [
  // ─────────────────────────────────────────────
  // ASSETS
  // ─────────────────────────────────────────────
  {
    code: '1000',
    name: 'Cash',
    category: AccountCategory.ASSET,
    normalBalance: 'DEBIT',
  },
  {
    code: '1100',
    name: 'Accounts Receivable',
    category: AccountCategory.ASSET,
    normalBalance: 'DEBIT',
  },

  // ─────────────────────────────────────────────
  // LIABILITIES
  // ─────────────────────────────────────────────
  {
    code: '2000',
    name: 'Accounts Payable',
    category: AccountCategory.LIABILITY,
    normalBalance: 'CREDIT',
  },

  // ─────────────────────────────────────────────
  // EQUITY
  // ─────────────────────────────────────────────
  {
    code: '3000',
    name: 'Owner Equity',
    category: AccountCategory.EQUITY,
    normalBalance: 'CREDIT',
  },

  // ─────────────────────────────────────────────
  // REVENUE
  // ─────────────────────────────────────────────
  {
    code: '4000',
    name: 'Sales Revenue',
    category: AccountCategory.REVENUE,
    normalBalance: 'CREDIT',
  },

  // ─────────────────────────────────────────────
  // EXPENSES
  // ─────────────────────────────────────────────
  {
    code: '5000',
    name: 'Operating Expenses',
    category: AccountCategory.EXPENSE,
    normalBalance: 'DEBIT',
  },
] as const;

/**
 * Fast lookup map by account code.
 */
export const ACCOUNT_BY_CODE: Readonly<
  Record<string, ChartAccount>
> = Object.freeze(
  CHART_OF_ACCOUNTS.reduce((acc, account) => {
    acc[account.code] = account;
    return acc;
  }, {} as Record<string, ChartAccount>)
);

/**
 * Assert that an account code exists in the Chart of Accounts.
 *
 * Writers SHOULD call this before producing ledger events.
 */
export function assertAccountExists(accountCode: string): ChartAccount {
  const account = ACCOUNT_BY_CODE[accountCode];
  if (!account) {
    throw new Error(`Unknown account code: ${accountCode}`);
  }
  return account;
}
