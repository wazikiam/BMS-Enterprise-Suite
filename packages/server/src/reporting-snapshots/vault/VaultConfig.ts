// packages/server/src/reporting-snapshots/vault/VaultConfig.ts

/**
 * Audit Vault configuration.
 *
 * IMPORTANT:
 * - Vault is authoritative for audit payloads.
 * - Runtime caches are NOT authoritative.
 * - Never auto-restore from vault.
 */

export interface VaultConfig {
  /**
   * Root directory for the snapshot audit vault.
   * Must be stable and backed up.
   */
  rootDir: string;
}

export function loadVaultConfig(): VaultConfig {
  const rootDir =
    process.env.BMS_SNAPSHOT_VAULT_ROOT ??
    './data/snapshot-vault';

  return {
    rootDir,
  };
}
