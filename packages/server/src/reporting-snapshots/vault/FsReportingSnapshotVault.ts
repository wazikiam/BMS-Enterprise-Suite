// packages/server/src/reporting-snapshots/vault/FsReportingSnapshotVault.ts

import fs from 'fs/promises';
import path from 'path';

import {
  ReportingSnapshotVault,
  ReportingSnapshotVaultBundleV1,
  ReportingSnapshotVaultRestoreEventV1,
  SealedHash,
} from '@bms/core/src/reporting-snapshots/vault/ReportingSnapshotVault';

import {
  VaultAlreadyExistsError,
  VaultIntegrityError,
  VaultIoError,
} from '@bms/core/src/reporting-snapshots/vault/VaultErrors';

export class FsReportingSnapshotVault implements ReportingSnapshotVault {
  private readonly rootDir: string;
  private readonly bundlesDir: string;
  private readonly eventsDir: string;
  private readonly restoreEventsFile: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.bundlesDir = path.join(rootDir, 'bundles');
    this.eventsDir = path.join(rootDir, 'events');
    this.restoreEventsFile = path.join(this.eventsDir, 'restore-events.jsonl');
  }

  async storeSealedBundle(bundle: ReportingSnapshotVaultBundleV1): Promise<void> {
    await this.ensureDirs();

    const bundlePath = this.bundlePath(bundle.sealedHash);
    const serialized = JSON.stringify(bundle, null, 2);

    try {
      await fs.writeFile(bundlePath, serialized, { flag: 'wx' });
    } catch (err: any) {
      if (err?.code === 'EEXIST') {
        const existing = await fs.readFile(bundlePath, 'utf-8');
        if (existing !== serialized) {
          throw new VaultIntegrityError(
            `Vault bundle integrity violation for sealedHash ${bundle.sealedHash}`
          );
        }
        return;
      }
      throw new VaultIoError(`Failed to write vault bundle: ${err?.message ?? err}`);
    }
  }

  async getSealedBundle(
    sealedHash: SealedHash
  ): Promise<ReportingSnapshotVaultBundleV1 | null> {
    const bundlePath = this.bundlePath(sealedHash);
    try {
      const raw = await fs.readFile(bundlePath, 'utf-8');
      return JSON.parse(raw) as ReportingSnapshotVaultBundleV1;
    } catch (err: any) {
      if (err?.code === 'ENOENT') return null;
      throw new VaultIoError(`Failed to read vault bundle: ${err?.message ?? err}`);
    }
  }

  async appendRestoreEvent(
    event: ReportingSnapshotVaultRestoreEventV1
  ): Promise<void> {
    await this.ensureDirs();
    const line = JSON.stringify(event) + '\n';

    try {
      await fs.appendFile(this.restoreEventsFile, line, { encoding: 'utf-8' });
    } catch (err: any) {
      throw new VaultIoError(
        `Failed to append restore event: ${err?.message ?? err}`
      );
    }
  }

  private bundlePath(sealedHash: SealedHash): string {
    return path.join(this.bundlesDir, `${sealedHash}.json`);
  }

  private async ensureDirs(): Promise<void> {
    try {
      await fs.mkdir(this.bundlesDir, { recursive: true });
      await fs.mkdir(this.eventsDir, { recursive: true });
    } catch (err: any) {
      throw new VaultIoError(`Failed to initialize vault directories: ${err?.message ?? err}`);
    }
  }
}
