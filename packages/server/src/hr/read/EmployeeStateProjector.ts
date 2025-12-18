// packages/server/src/hr/read/EmployeeStateProjector.ts

import { HrEmployeeEvent } from './EmployeeReadService';
import {
  isKnownHrEventType,
  HR_EVENT_SEMANTICS,
} from './HrEventTypeRegistry';

export interface HrEmployeeCurrentState {
  employeeId: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED' | 'UNKNOWN';
  effectiveFrom: Date | null;
  lastEventId: string | null;
  derivedAt: Date;
}

/**
 * Deterministic projector for HR employee current state.
 *
 * Governance rules:
 * - Pure function
 * - No I/O
 * - No mutation
 * - Explicit event semantics
 * - Unknown events are tolerated but do not affect state
 */
export class EmployeeStateProjector {
  static project(params: {
    employeeId: string;
    events: HrEmployeeEvent[];
  }): HrEmployeeCurrentState {
    const { employeeId, events } = params;

    let status: HrEmployeeCurrentState['status'] = 'UNKNOWN';
    let effectiveFrom: Date | null = null;
    let lastEventId: string | null = null;

    for (const event of events) {
      lastEventId = event.eventId;

      if (!isKnownHrEventType(event.eventType)) {
        // Unknown event types are explicitly ignored for state derivation
        continue;
      }

      const semantics = HR_EVENT_SEMANTICS[event.eventType];

      if (semantics.affectsEmploymentStatus) {
        status = semantics.resultingStatus ?? status;
        effectiveFrom = event.eventTime;
      }
    }

    return {
      employeeId,
      status,
      effectiveFrom,
      lastEventId,
      derivedAt: new Date(),
    };
  }
}
