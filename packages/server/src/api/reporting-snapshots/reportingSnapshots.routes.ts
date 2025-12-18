// packages/server/src/api/reporting-snapshots/reportingSnapshots.routes.ts

import { Router } from 'express';

import { loadVaultConfig } from '../../reporting-snapshots/vault/VaultConfig';
import { FsReportingSnapshotVault } from '../../reporting-snapshots/vault/FsReportingSnapshotVault';

import { InMemoryRuntimeSnapshotStore } from '../../reporting-snapshots/runtime/InMemoryRuntimeSnapshotStore';

import { createReportingSnapshotController } from './createReportingSnapshot.controller';
import { getReportingSnapshotController } from './getReportingSnapshot.controller';
import { RestoreReportingSnapshotController } from './restoreSnapshot.controller';
import { StoreSealedSnapshotController } from './storeSealedSnapshot.controller';
import { ApplyRestoredSnapshotController } from './applyRestoredSnapshot.controller';
import { VaultStatusController } from './vaultStatus.controller';

export function reportingSnapshotsRouter(): Router {
  const router = Router();

  /**
   * ============================
   * Runtime Snapshot Store
   * ============================
   * NON-AUTHORITATIVE
   */
  const runtimeStore = new InMemoryRuntimeSnapshotStore();

  router.post('/', createReportingSnapshotController(runtimeStore));
  router.get('/:snapshotId', getReportingSnapshotController(runtimeStore));

  /**
   * ============================
   * Audit Vault
   * ============================
   */
  const vaultConfig = loadVaultConfig();
  const vault = new FsReportingSnapshotVault(vaultConfig.rootDir);

  /**
   * Explicit: store sealed snapshot payload into vault
   */
  const storeController = new StoreSealedSnapshotController(vault);
  router.post('/vault/store', (req, res) =>
    storeController.store(req, res)
  );

  /**
   * Explicit: restore sealed snapshot (fetch + log)
   */
  const restoreController = new RestoreReportingSnapshotController(
    vault,
    'runtime-default'
  );
  router.post('/vault/restore', (req, res) =>
    restoreController.restore(req, res)
  );

  /**
   * Explicit: apply restored snapshot to runtime
   */
  const applyController = new ApplyRestoredSnapshotController(
    vault,
    runtimeStore,
    'runtime-default'
  );
  router.post('/vault/apply', (req, res) =>
    applyController.apply(req, res)
  );

  /**
   * Read-only operational status
   */
  const statusController = new VaultStatusController(
    vault,
    runtimeStore
  );
  router.get('/vault/status', (req, res) =>
    statusController.getStatus(req, res)
  );

  return router;
}
