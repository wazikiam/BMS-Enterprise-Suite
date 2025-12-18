// packages/core/src/reporting-snapshots/vault/VaultErrors.ts

export class VaultError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'VaultError';
  }
}

export class VaultAlreadyExistsError extends VaultError {
  constructor(message: string) {
    super('VAULT_ALREADY_EXISTS', message);
    this.name = 'VaultAlreadyExistsError';
  }
}

export class VaultIntegrityError extends VaultError {
  constructor(message: string) {
    super('VAULT_INTEGRITY_ERROR', message);
    this.name = 'VaultIntegrityError';
  }
}

export class VaultIoError extends VaultError {
  constructor(message: string) {
    super('VAULT_IO_ERROR', message);
    this.name = 'VaultIoError';
  }
}
