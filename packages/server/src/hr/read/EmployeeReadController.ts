// packages/server/src/hr/read/EmployeeReadController.ts

import { Request, Response } from 'express';
import { EmployeeReadService } from './EmployeeReadService';
import { EmployeeStateProjector } from './EmployeeStateProjector';

/**
 * HR Phase 2 — Read-only controller.
 *
 * Governance rules:
 * - Actor context is mandatory
 * - Read-only
 * - Fail-closed
 */
export class EmployeeReadController {
  constructor(
    private readonly employeeReadService: EmployeeReadService
  ) {}

  /**
   * GET /api/hr/audit/employees
   */
  listEmployees = async (req: Request, res: Response) => {
    const actor = (req as any).actor;
    if (!actor || !actor.actorId) {
      return res.status(403).json({ error: 'Actor context required' });
    }

    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);

    try {
      const employees = await this.employeeReadService.listEmployees({
        limit,
        offset,
      });

      return res.status(200).json({ employees });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  };

  /**
   * GET /api/hr/audit/employees/:employeeId
   */
  getEmployeeMaster = async (req: Request, res: Response) => {
    const actor = (req as any).actor;
    if (!actor || !actor.actorId) {
      return res.status(403).json({ error: 'Actor context required' });
    }

    try {
      const master =
        await this.employeeReadService.getEmployeeMaster(
          req.params.employeeId
        );

      return res.status(200).json({ master });
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  };

  /**
   * GET /api/hr/audit/employees/:employeeId/events
   */
  listEmployeeEvents = async (req: Request, res: Response) => {
    const actor = (req as any).actor;
    if (!actor || !actor.actorId) {
      return res.status(403).json({ error: 'Actor context required' });
    }

    try {
      const events =
        await this.employeeReadService.listEmployeeEvents(
          req.params.employeeId
        );

      return res.status(200).json({ events });
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  };

  /**
   * GET /api/hr/audit/employees/:employeeId/details
   */
  getEmployeeDetails = async (req: Request, res: Response) => {
    const actor = (req as any).actor;
    if (!actor || !actor.actorId) {
      return res.status(403).json({ error: 'Actor context required' });
    }

    try {
      const details =
        await this.employeeReadService.getEmployeeDetails(
          req.params.employeeId
        );

      return res.status(200).json(details);
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  };

  /**
   * GET /api/hr/audit/employees/:employeeId/state
   *
   * Deterministic derived state from immutable event stream.
   */
  getEmployeeCurrentState = async (req: Request, res: Response) => {
    const actor = (req as any).actor;
    if (!actor || !actor.actorId) {
      return res.status(403).json({ error: 'Actor context required' });
    }

    try {
      // Ensure employee exists (master is authoritative)
      await this.employeeReadService.getEmployeeMaster(
        req.params.employeeId
      );

      const events =
        await this.employeeReadService.listEmployeeEvents(
          req.params.employeeId
        );

      const state = EmployeeStateProjector.project({
        employeeId: req.params.employeeId,
        events,
      });

      return res.status(200).json({ state });
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  };
}
