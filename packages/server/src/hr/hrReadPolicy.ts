// packages/server/src/hr/hrReadPolicy.ts

import { HrActor, HrEmployeeRow } from './HrEmployeeRepository';

export type HrReadScope = 'LIST' | 'DETAIL';

export function assertHrReadAllowed(actor: HrActor, scope: HrReadScope): void {
  if (!actor?.id || !Array.isArray(actor.roles)) {
    throw new Error('Forbidden');
  }

  const roles = actor.roles;

  const allowed =
    roles.includes('HR_ADMIN') ||
    roles.includes('HR_VIEWER') ||
    roles.includes('HR_AUDITOR');

  if (!allowed) {
    throw new Error('Forbidden');
  }

  // LIST scope is allowed for these roles; DETAIL also allowed,
  // but detail fields will be masked based on role.
  if (scope !== 'LIST' && scope !== 'DETAIL') {
    throw new Error('Forbidden');
  }
}

export function maskEmployeeForActor(
  employee: HrEmployeeRow,
  actor: HrActor
): Partial<HrEmployeeRow> {
  const roles = actor.roles;

  // HR_ADMIN can see all HR fields (Phase 1 excludes payroll)
  if (roles.includes('HR_ADMIN')) {
    return employee;
  }

  // HR_AUDITOR and HR_VIEWER get restricted view
  const masked: Partial<HrEmployeeRow> = {
    employee_id: employee.employee_id,
    employee_code: employee.employee_code,
    first_name: employee.first_name,
    last_name: employee.last_name,

    status: employee.status,
    hire_date: employee.hire_date,
    termination_date: employee.termination_date,

    contract_type: employee.contract_type,
    department_id: employee.department_id,
    manager_employee_id: employee.manager_employee_id,

    business_roles: employee.business_roles,
    created_at: employee.created_at,
    updated_at: employee.updated_at,

    // HIGH / RESTRICTED fields intentionally removed for non-admin
    work_email: null,
    work_phone: null,
    address_line: null,
    national_id: null,
    tax_identifier: null,
    social_security_number: null,
  };

  return masked;
}
