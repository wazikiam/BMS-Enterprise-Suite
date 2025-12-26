// packages/server/src/api/reconciliation.routes.ts
// RECONCILIATION ROUTES (READ-ONLY)
//
// PHASE 10 — STEP 1
//
// Endpoints:
// - GET /api/reconciliation/ap-control
// - GET /api/reconciliation/ar-control
//
// Query params:
// - periodFrom=YYYY-MM-DD (required)
// - periodTo=YYYY-MM-DD (required)
// - asOf=YYYY-MM-DD (required)
// - snapshotId=<uuid> (optional)
// - controlAccountCode=<string> (required)
//
// Notes:
// - Read-only, governance-safe
// - Uses existing reconciliation services; provider wiring is injected by a factory
// - No SQL here; providers come from composition layer

import { Router, Request, Response } from 'express';

import { APControlAccountReconciliationService } from '../reconciliation/APControlAccountReconciliationService';
import { ARControlAccountReconciliationService } from '../reconciliation/ARControlAccountReconciliationService';

export type LedgerControlAccountProvider = ConstructorParameters<
  typeof APControlAccountReconciliationService
>[0];

export type APSubledgerExposureProvider = ConstructorParameters<
  typeof APControlAccountReconciliationService
>[1];

export type ARSubledgerExposureProvider = ConstructorParameters<
  typeof ARControlAccountReconciliationService
>[1];

export type ReconciliationProvidersFactory = {
  /**
   * Return providers:
   * - If snapshotId is provided, providers MUST be snapshot-backed
   * - Otherwise providers MUST be live-backed
   */
  create(input: { snapshotId?: string | null }): {
    ledger: LedgerControlAccountProvider;
    ap: APSubledgerExposureProvider;
    ar: ARSubledgerExposureProvider;
  };
};

export function createReconciliationRoutes(factory: ReconciliationProvidersFactory): Router {
  const router = Router();

  router.get('/reconciliation/ap-control', async (req: Request, res: Response) => {
    try {
      const q = parseQuery(req);
      const providers = factory.create({ snapshotId: q.snapshotId });

      const svc = new APControlAccountReconciliationService(
        providers.ledger,
        providers.ap
      );

      const report = await svc.reconcile({
        controlAccountCode: q.controlAccountCode,
        periodFrom: q.periodFrom,
        periodTo: q.periodTo,
        asOf: q.asOf,
        snapshotId: q.snapshotId ?? null,
      });

      res.status(200).json(report);
    } catch (err: any) {
      res.status(400).json({
        error: 'RECONCILIATION_REQUEST_INVALID',
        message: err?.message ?? String(err),
      });
    }
  });

  router.get('/reconciliation/ar-control', async (req: Request, res: Response) => {
    try {
      const q = parseQuery(req);
      const providers = factory.create({ snapshotId: q.snapshotId });

      const svc = new ARControlAccountReconciliationService(
        providers.ledger,
        providers.ar
      );

      const report = await svc.reconcile({
        controlAccountCode: q.controlAccountCode,
        periodFrom: q.periodFrom,
        periodTo: q.periodTo,
        asOf: q.asOf,
        snapshotId: q.snapshotId ?? null,
      });

      res.status(200).json(report);
    } catch (err: any) {
      res.status(400).json({
        error: 'RECONCILIATION_REQUEST_INVALID',
        message: err?.message ?? String(err),
      });
    }
  });

  return router;
}

function parseQuery(req: Request): {
  periodFrom: string;
  periodTo: string;
  asOf: string;
  snapshotId?: string | null;
  controlAccountCode: string;
} {
  const periodFrom = String(req.query.periodFrom ?? '').trim();
  const periodTo = String(req.query.periodTo ?? '').trim();
  const asOf = String(req.query.asOf ?? '').trim();
  const snapshotIdRaw = String(req.query.snapshotId ?? '').trim();
  const controlAccountCode = String(req.query.controlAccountCode ?? '').trim();

  if (!isYYYYMMDD(periodFrom)) throw new Error('periodFrom is required (YYYY-MM-DD)');
  if (!isYYYYMMDD(periodTo)) throw new Error('periodTo is required (YYYY-MM-DD)');
  if (!isYYYYMMDD(asOf)) throw new Error('asOf is required (YYYY-MM-DD)');
  if (!controlAccountCode) throw new Error('controlAccountCode is required');

  const snapshotId = snapshotIdRaw.length > 0 ? snapshotIdRaw : null;

  return { periodFrom, periodTo, asOf, snapshotId, controlAccountCode };
}

function isYYYYMMDD(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
