// packages/core/src/domain/ledger/LedgerEntryError.ts

export class LedgerEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerEntryError';
  }
}
