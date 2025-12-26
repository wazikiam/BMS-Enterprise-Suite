// packages/server/src/reconciliation/ReconciliationOrchestrator.ts
// RECONCILIATION ORCHESTRATOR (SERVER)
//
// PHASE 9 — STEP 4
//
// Role:
// - Snapshot-aware orchestration for reconciliation runs
// - Produces AR + AP ControlAccountReconciliationReport outputs
// - Keeps reconciliation services pure by injecting correct providers (snapshot vs live)
//
// Scope limits (this step):
// - NO SQL here
// - NO routes / UI
// - NO DB migrations
// - Orchestrator only (composition + deterministic metadata)

import type { ControlAccountReconciliationReport } from '@bms/core/src/reconciliation/ControlAccountReconciliation';

import { APControlAccountReconciliationService } from './APControlAccountReconciliationService';
import { ARControlAccountReconciliationService } from './ARControlAccountReconciliationService';

export type ReconciliationRunInput = {
  periodFrom: string; // YYYY-MM-DD (inclusive)
  periodTo: string;   // YYYY-MM-DD (inclusive)
  asOf: string;       // YYYY-MM-DD

  snapshotId?: string | null;

  /**
   * Chart of Accounts control account codes used for reconciliation.
   * These are configuration inputs, not hardcoded domain rules.
   */
  apControlAccountCode: string;
  arControlAccountCode: string;
};

/**
 * Provider bundle selector.
 *
 * This orchestrator is intentionally decoupled from DB/query mechanics.
 * Callers must supply implementations that are either snapshot-backed or live-backed.
 */
export type ProviderBundle = {
  // Ledger provider is shared by AR/AP (same ledger system of record)
  ledger: {
    getControlAccountNetMinorByCurrency: (
      input: Parameters<
        APControlAccountReconciliationService['reconcile']
      >[0] extends { controlAccountCode: string }
        ? {
            controlAccountCode: string;
            periodFrom: string;
            periodTo: string;
            asOf: string;
            snapshotId?: string | null;
          }
        : never
    ) => Promise<ReadonlyArray<{ currency: string; ledgerControlNetMinor: number }>>;
  };

  ap: {
    getAPNetMinorByCurrency: (input: {
      periodFrom: string;
      periodTo: string;
      asOf: string;
      snapshotId?: string | null;
    }) => Promise<ReadonlyArray<{ currency: string; subledgerNetMinor: number }>>;
  };

  ar: {
    getARNetMinorByCurrency: (input: {
      periodFrom: string;
      periodTo: string;
      asOf: string;
      snapshotId?: string | null;
    }) => Promise<ReadonlyArray<{ currency: string; subledgerNetMinor: number }>>;
  };
};

export type ProviderSelector = {
  /**
   * Return providers that are snapshot-backed if snapshotId is provided,
   * otherwise return live-backed providers.
   */
  select(snapshotId?: string | null): ProviderBundle;
};

export type ReconciliationRunResult = {
  ap: ControlAccountReconciliationReport;
  ar: ControlAccountReconciliationReport;
};

export class ReconciliationOrchestrator {
  constructor(private readonly selector: ProviderSelector) {
    if (!selector) throw new Error('ReconciliationOrchestrator requires a ProviderSelector');
  }

  async run(input: ReconciliationRunInput): Promise<ReconciliationRunResult> {
    const providers = this.selector.select(input.snapshotId ?? null);

    const apService = new APControlAccountReconciliationService(
      { getControlAccountNetMinorByCurrency: providers.ledger.getControlAccountNetMinorByCurrency },
      { getAPNetMinorByCurrency: providers.ap.getAPNetMinorByCurrency }
    );

    const arService = new ARControlAccountReconciliationService(
      { getControlAccountNetMinorByCurrency: providers.ledger.getControlAccountNetMinorByCurrency },
      { getARNetMinorByCurrency: providers.ar.getARNetMinorByCurrency }
    );

    const [ap, ar] = await Promise.all([
      apService.reconcile({
        controlAccountCode: input.apControlAccountCode,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        asOf: input.asOf,
        snapshotId: input.snapshotId ?? null,
      }),
      arService.reconcile({
        controlAccountCode: input.arControlAccountCode,
        periodFrom: input.periodFrom,
        periodTo: input.periodTo,
        asOf: input.asOf,
        snapshotId: input.snapshotId ?? null,
      }),
    ]);

    return { ap, ar };
  }
}
