// packages/server/src/cli/vault.ts

/**
 * BMS Snapshot Vault CLI
 *
 * Read-only operational tooling.
 * No mutation. No restore. No apply.
 */

import path from 'path';
import fs from 'fs/promises';

import { loadVaultConfig } from '../reporting-snapshots/vault/VaultConfig';
import { FsReportingSnapshotVault } from '../reporting-snapshots/vault/FsReportingSnapshotVault';

async function main() {
  const [, , command, arg] = process.argv;

  if (!command) {
    usage();
    process.exit(1);
  }

  const config = loadVaultConfig();
  const vault = new FsReportingSnapshotVault(config.rootDir);

  switch (command) {
    case 'status':
      await status(vault, arg);
      break;

    case 'verify':
      await verify(vault, arg);
      break;

    case 'events':
      await events(config.rootDir);
      break;

    default:
      usage();
      process.exit(1);
  }
}

function usage() {
  console.log(`
BMS Snapshot Vault CLI (read-only)

Commands:
  vault status <sealedHash>
  vault verify <sealedHash>
  vault events

Notes:
- CLI is read-only
- No restore or apply is possible from CLI
`);
}

async function status(vault: FsReportingSnapshotVault, sealedHash?: string) {
  if (!sealedHash) {
    throw new Error('sealedHash required');
  }

  const bundle = await vault.getSealedBundle(sealedHash);

  if (!bundle) {
    console.log('VAULT: NOT FOUND');
    return;
  }

  console.log('VAULT: PRESENT');
  console.log({
    snapshotId: bundle.snapshotId,
    version: bundle.version,
    period: bundle.period,
    asOf: bundle.asOf,
    sealedAt: bundle.sealedAt,
  });
}

async function verify(vault: FsReportingSnapshotVault, sealedHash?: string) {
  if (!sealedHash) {
    throw new Error('sealedHash required');
  }

  const bundle = await vault.getSealedBundle(sealedHash);

  if (!bundle) {
    console.log('VERIFY: NOT FOUND');
    return;
  }

  const crypto = await import('crypto');
  const computed = crypto
    .createHash('sha256')
    .update(JSON.stringify(bundle.payload))
    .digest('hex');

  if (computed === bundle.sealedHash) {
    console.log('VERIFY: OK (hash matches)');
  } else {
    console.error('VERIFY: FAILED');
    console.error({
      expected: bundle.sealedHash,
      computed,
    });
  }
}

async function events(rootDir: string) {
  const eventsFile = path.join(rootDir, 'events', 'restore-events.jsonl');

  try {
    const raw = await fs.readFile(eventsFile, 'utf-8');
    const lines = raw.trim().split('\n').map((l) => JSON.parse(l));
    console.log(lines);
  } catch {
    console.log('No events found.');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
