// packages/server/src/hr/read/HrEventTypeRegistry.ts

/**
 * Authoritative HR event type registry.
 *
 * Governance rules:
 * - Explicit allow-list
 * - Centralized semantics
 * - Unknown events are tolerated but do not alter state
 * - No dynamic registration
 */

export type HrEventType =
  | 'EMPLOYEE_CREATED'
  | 'EMPLOYEE_HIRED'
  | 'EMPLOYEE_SUSPENDED'
  | 'EMPLOYEE_REINSTATED'
  | 'EMPLOYEE_TERMINATED';

export interface HrEventSemantics {
  affectsEmploymentStatus: boolean;
  resultingStatus:
    | 'ACTIVE'
    | 'SUSPENDED'
    | 'TERMINATED'
    | null;
}

/**
 * Immutable event semantics map.
 */
export const HR_EVENT_SEMANTICS: Record<HrEventType, HrEventSemantics> = {
  EMPLOYEE_CREATED: {
    affectsEmploymentStatus: true,
    resultingStatus: 'ACTIVE',
  },
  EMPLOYEE_HIRED: {
    affectsEmploymentStatus: true,
    resultingStatus: 'ACTIVE',
  },
  EMPLOYEE_SUSPENDED: {
    affectsEmploymentStatus: true,
    resultingStatus: 'SUSPENDED',
  },
  EMPLOYEE_REINSTATED: {
    affectsEmploymentStatus: true,
    resultingStatus: 'ACTIVE',
  },
  EMPLOYEE_TERMINATED: {
    affectsEmploymentStatus: true,
    resultingStatus: 'TERMINATED',
  },
};

/**
 * Type guard for known HR event types.
 */
export function isKnownHrEventType(
  eventType: string
): eventType is HrEventType {
  return Object.prototype.hasOwnProperty.call(
    HR_EVENT_SEMANTICS,
    eventType
  );
}
