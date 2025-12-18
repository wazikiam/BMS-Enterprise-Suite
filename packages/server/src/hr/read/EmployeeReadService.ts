// packages/server/src/hr/read/EmployeeReadService.ts

import { Pool } from 'pg';

export interface HrEmployeeSummary {
  employeeId: string;
}

export interface HrEmployeeDetails {
  employeeId: string;
  master: Record<string, unknown>;
  events: HrEmployeeEvent[];
}

export interface HrEmployeeEvent {
  eventId: string;
  employeeId: string;
  eventType: string;
  actorId: string;
  actorRoles: string[];
  reason: string;
  eventTime: Date;
}

/**
 * HR Phase 2 Read Service (audit-grade).
 *
 * Rules:
 * - Read-only
 * - No synthetic fields
 * - DB schema is source of truth
 * - Deterministic ordering
 */
export class EmployeeReadService {
  constructor(private readonly db: Pool) {}

  /**
   * List employees (minimal, schema-safe).
   */
  async listEmployees(params: {
    limit: number;
    offset: number;
  }): Promise<HrEmployeeSummary[]> {
    const safeLimit = Math.min(Math.max(params.limit, 1), 100);
    const safeOffset = Math.max(params.offset, 0);

    const result = await this.db.query(
      `
      SELECT employee_id
      FROM hr_employees
      ORDER BY employee_id ASC
      LIMIT $1 OFFSET $2
      `,
      [safeLimit, safeOffset]
    );

    return result.rows.map((r) => ({
      employeeId: r.employee_id,
    }));
  }

  /**
   * Return the authoritative HR master record.
   */
  async getEmployeeMaster(employeeId: string): Promise<Record<string, unknown>> {
    if (!employeeId) throw new Error('employeeId is required');

    const result = await this.db.query(
      `
      SELECT *
      FROM hr_employees
      WHERE employee_id = $1
      `,
      [employeeId]
    );

    if (result.rowCount === 0) {
      throw new Error(`Employee not found: ${employeeId}`);
    }

    return result.rows[0];
  }

  /**
   * Return immutable employee event stream.
   */
  async listEmployeeEvents(employeeId: string): Promise<HrEmployeeEvent[]> {
    if (!employeeId) throw new Error('employeeId is required');

    const result = await this.db.query(
      `
      SELECT
        event_id,
        employee_id,
        event_type,
        actor_id,
        actor_roles,
        reason,
        event_time
      FROM hr_employee_events
      WHERE employee_id = $1
      ORDER BY event_time ASC, event_id ASC
      `,
      [employeeId]
    );

    return result.rows.map((r) => ({
      eventId: r.event_id,
      employeeId: r.employee_id,
      eventType: r.event_type,
      actorId: r.actor_id,
      actorRoles: Array.isArray(r.actor_roles) ? r.actor_roles : [],
      reason: r.reason,
      eventTime: r.event_time,
    }));
  }

  /**
   * Full audit-grade employee view.
   */
  async getEmployeeDetails(employeeId: string): Promise<HrEmployeeDetails> {
    const [master, events] = await Promise.all([
      this.getEmployeeMaster(employeeId),
      this.listEmployeeEvents(employeeId),
    ]);

    return {
      employeeId,
      master,
      events,
    };
  }
}
