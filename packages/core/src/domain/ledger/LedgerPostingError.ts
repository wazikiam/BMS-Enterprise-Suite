// packages/core/src/domain/ledger/LedgerPostingError.ts

export class LedgerPostingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerPostingError';
  }
}
