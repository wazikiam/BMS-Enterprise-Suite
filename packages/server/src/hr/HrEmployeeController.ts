// packages/server/src/hr/HrEmployeeController.ts

import { Request, Response } from 'express';
import { HrEmployeeService } from './HrEmployeeService';
import { HrEmployeeRepository, HrActor } from './HrEmployeeRepository';
import { assertHrReadAllowed, maskEmployeeForActor } from './hrReadPolicy';

export class HrEmployeeController {
  constructor(
    private readonly service: HrEmployeeService,
    private readonly repo: HrEmployeeRepository
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    const actor = (req as any).actor as HrActor;

    if (!actor?.id || !Array.isArray(actor.roles)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    try {
      const result = await this.service.createEmployee(req.body, actor);
      res.status(201).json({ status: 'CREATED', employeeId: result.employeeId });
    } catch (err: any) {
      const message = err?.message ?? 'Forbidden';
      const code = message.startsWith('Forbidden') ? 403 : 400;
      res.status(code).json({ error: message });
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    const actor = (req as any).actor as HrActor;

    try {
      assertHrReadAllowed(actor, 'LIST');
      const rows = await this.repo.listEmployees();
      res.status(200).json(rows);
    } catch (err: any) {
      res.status(403).json({ error: err?.message ?? 'Forbidden' });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    const actor = (req as any).actor as HrActor;
    const { employeeId } = req.params;

    try {
      assertHrReadAllowed(actor, 'DETAIL');

      const employee = await this.repo.getEmployeeById(employeeId);

      if (!employee) {
        res.status(404).json({ error: 'Employee not found' });
        return;
      }

      const masked = maskEmployeeForActor(employee, actor);
      res.status(200).json(masked);
    } catch (err: any) {
      res.status(403).json({ error: err?.message ?? 'Forbidden' });
    }
  }
}
