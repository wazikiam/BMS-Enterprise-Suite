// packages/server/src/hr/HrEmployeeService.ts

import { HrEmployeeRepository, CreateEmployeeInput, HrActor } from './HrEmployeeRepository';

export class HrEmployeeService {
  constructor(private readonly repo: HrEmployeeRepository) {}

  async createEmployee(
    input: CreateEmployeeInput,
    actor: HrActor
  ): Promise<{ employeeId: string }> {
    if (!actor?.id || !Array.isArray(actor.roles)) {
      throw new Error('Forbidden');
    }

    if (!actor.roles.includes('HR_ADMIN')) {
      throw new Error('Forbidden: HR_ADMIN role required');
    }

    // Minimal validation (no silent coercion)
    if (!input?.employeeCode || typeof input.employeeCode !== 'string') {
      throw new Error('Invalid: employeeCode is required');
    }
    if (!input?.firstName || typeof input.firstName !== 'string') {
      throw new Error('Invalid: firstName is required');
    }
    if (!input?.lastName || typeof input.lastName !== 'string') {
      throw new Error('Invalid: lastName is required');
    }
    if (!input?.hireDate || typeof input.hireDate !== 'string') {
      throw new Error('Invalid: hireDate is required');
    }
    if (!input?.contractType || typeof input.contractType !== 'string') {
      throw new Error('Invalid: contractType is required');
    }

    return this.repo.createEmployee(input, actor);
  }
}
