// packages/core/src/services/SegmentService.ts

import {
  CustomerSegment,
  CustomerSegmentCreateInput,
  CustomerSegmentUpdateInput,
  SegmentStats,
  SegmentEvaluationResult,
  SegmentRule,
  SegmentCriteria,
  SystemSegments
} from '../domain/CustomerSegment';

import { Customer } from '../domain/Customer';
import { ValidationError, BusinessRuleError, NotFoundError } from '../errors/ApplicationError';

/**
 * SegmentService — TEMPORARILY DISABLED (STUB)
 * -------------------------------------------
 * Reason:
 * - Segment repositories are not implemented yet
 * - Customer + Balance + Transaction joins are incomplete
 *
 * This service is intentionally minimal to:
 * - Allow the system to compile
 * - Preserve API contracts
 * - Prevent accidental usage
 *
 * Full implementation WILL be added later.
 */
export class SegmentService {
  /* =====================================================
     CRUD (STUB)
     ===================================================== */

  async createSegment(
    _input: CustomerSegmentCreateInput,
    _createdBy: string
  ): Promise<CustomerSegment> {
    throw new BusinessRuleError('SegmentService is not enabled yet');
  }

  async getSegmentById(id: string): Promise<CustomerSegment> {
    throw NotFoundError.factory('CustomerSegment', id);
  }

  async updateSegment(
    _id: string,
    _input: CustomerSegmentUpdateInput,
    _updatedBy: string
  ): Promise<CustomerSegment> {
    throw new BusinessRuleError('SegmentService is not enabled yet');
  }

  async deleteSegment(
    _id: string,
    _deletedBy: string
  ): Promise<void> {
    throw new BusinessRuleError('SegmentService is not enabled yet');
  }

  async listSegments(): Promise<CustomerSegment[]> {
    return [];
  }

  /* =====================================================
     ASSIGNMENT / EVALUATION (STUB)
     ===================================================== */

  async evaluateCustomerForSegment(
    _customerId: string,
    _segmentId: string
  ): Promise<SegmentEvaluationResult> {
    return {
      customerId: _customerId,
      segmentId: _segmentId,
      matches: false,
      matchedRules: [],
      score: 0,
      evaluatedAt: new Date()
    };
  }

  async assignCustomerToSegment(
    _customerId: string,
    _segmentId: string,
    _assignedBy: string
  ): Promise<void> {
    throw new BusinessRuleError('Segment assignment is not enabled yet');
  }

  async removeCustomerFromSegment(
    _customerId: string,
    _segmentId: string,
    _removedBy: string
  ): Promise<void> {
    throw new BusinessRuleError('Segment removal is not enabled yet');
  }

  async autoAssignSegments(_customerId: string): Promise<string[]> {
    return [];
  }

  /* =====================================================
     SYSTEM SEGMENTS (STUB)
     ===================================================== */

  async getSystemSegment(_segment: SystemSegments): Promise<CustomerSegment> {
    throw new BusinessRuleError('System segments are not initialized yet');
  }

  async initializeSystemSegments(_createdBy: string): Promise<void> {
    // intentionally empty
  }

  /* =====================================================
     REPORTING (STUB)
     ===================================================== */

  async getSegmentStats(_segmentId: string): Promise<SegmentStats> {
    return {
      segmentId: _segmentId,
      name: '',
      customerCount: 0,
      totalBalance: 0,
      averageBalance: 0,
      minBalance: 0,
      maxBalance: 0,
      averageTransactionValue: 0,
      growthRate: 0,
      lastUpdated: new Date()
    };
  }

  async getSegmentCustomers(
    _segmentId: string,
    _page = 1,
    _pageSize = 50
  ): Promise<{ customers: Customer[]; total: number }> {
    return { customers: [], total: 0 };
  }

  /* =====================================================
     VALIDATION (STUB)
     ===================================================== */

  async testSegmentRule(
    _rule: SegmentRule,
    _customer: Customer
  ): Promise<boolean> {
    return false;
  }

  async validateSegmentCriteria(
    _criteria: SegmentCriteria
  ): Promise<ValidationError[]> {
    return [];
  }
}
