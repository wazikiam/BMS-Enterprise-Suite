// packages/server/src/hr/HrEmployeeRepository.ts

import { Pool } from 'pg';
import { v4 as uuid } from 'uuid';

export interface HrActor {
  id: string;
  roles: string[];
}

export interface CreateEmployeeInput {
  employeeCode: string;
  firstName: string;
  lastName: string;
  hireDate: string; // ISO date string
  contractType: 'PERMANENT' | 'FIXED' | 'CONSULTANT';
}

export interface HrEmployeeRow {
  employee_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;

  status: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  hire_date: string;
  termination_date: string | null;

  contract_type: 'PERMANENT' | 'FIXED' | 'CONSULTANT';
  department_id: string | null;
  manager_employee_id: string | null;

  work_email: string | null;
  work_phone: string | null;
  address_line: string | null;

  national_id: string | null;
  tax_identifier: string | null;
  social_security_number: string | null;

  business_roles: string[];
  created_at: string;
  updated_at: string;
}

export class HrEmployeeRepository {
  constructor(private readonly pool: Pool) {}

  async createEmployee(
    input: CreateEmployeeInput,
    actor: HrActor
  ): Promise<{ employeeId: string }> {
    if (!actor?.id || !Array.isArray(actor.roles)) {
      throw new Error('Actor identity is required');
    }

    const employeeId = uuid();
    const eventId = uuid();

    await this.pool.query('BEGIN');

    try {
      await this.pool.query(
        `
        INSERT INTO hr_employees (
          employee_id,
          employee_code,
          first_name,
          last_name,
          status,
          hire_date,
          contract_type
        ) VALUES ($1,$2,$3,$4,'ACTIVE',$5,$6)
        `,
        [
          employeeId,
          input.employeeCode,
          input.firstName,
          input.lastName,
          input.hireDate,
          input.contractType,
        ]
      );

      await this.pool.query(
        `
        INSERT INTO hr_employee_events (
          event_id,
          employee_id,
          event_type,
          actor_id,
          actor_roles,
          reason,
          payload
        ) VALUES ($1,$2,'EMPLOYEE_CREATED',$3,$4,$5,$6)
        `,
        [
          eventId,
          employeeId,
          actor.id,
          actor.roles,
          'Employee created',
          JSON.stringify({
            employeeCode: input.employeeCode,
            firstName: input.firstName,
            lastName: input.lastName,
            hireDate: input.hireDate,
            contractType: input.contractType,
          }),
        ]
      );

      await this.pool.query('COMMIT');
      return { employeeId };
    } catch (err) {
      await this.pool.query('ROLLBACK');
      throw err;
    }
  }

  async listEmployees(): Promise<Pick<
    HrEmployeeRow,
    | 'employee_id'
    | 'employee_code'
    | 'first_name'
    | 'last_name'
    | 'status'
    | 'hire_date'
    | 'contract_type'
    | 'department_id'
    | 'manager_employee_id'
  >[]> {
    const result = await this.pool.query(
      `
      SELECT
        employee_id,
        employee_code,
        first_name,
        last_name,
        status,
        hire_date,
        contract_type,
        department_id,
        manager_employee_id
      FROM hr_employees
      ORDER BY last_name, first_name
      `
    );

    return result.rows;
  }

  async getEmployeeById(employeeId: string): Promise<HrEmployeeRow | null> {
    const result = await this.pool.query(
      `
      SELECT
        employee_id,
        employee_code,
        first_name,
        last_name,
        status,
        hire_date,
        termination_date,
        contract_type,
        department_id,
        manager_employee_id,
        work_email,
        work_phone,
        address_line,
        national_id,
        tax_identifier,
        social_security_number,
        business_roles,
        created_at,
        updated_at
      FROM hr_employees
      WHERE employee_id = $1
      `,
      [employeeId]
    );

    if (result.rowCount === 0) return null;
    return result.rows[0];
  }
}
