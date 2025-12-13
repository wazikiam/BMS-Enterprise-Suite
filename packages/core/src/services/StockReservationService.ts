// packages/core/src/services/StockReservationService.ts

import { NotFoundError, BusinessRuleError } from '../errors/ApplicationError';

/**
 * StockReservationService (CORE STUB)
 * ----------------------------------
 * This service is intentionally minimal.
 *
 * Reason:
 * - Stock domain is not finalized
 * - StockRepository does not yet expose required query methods
 *
 * This file WILL be expanded later without breaking API contracts.
 */

export interface StockReservation {
  id: string;
  productId: string;
  quantity: number;
  status: 'active' | 'released';
  createdAt: Date;
}

export class StockReservationService {
  constructor() {}

  async reserveStock(
    orderId: string,
    productId: string,
    quantity: number
  ): Promise<StockReservation> {
    if (quantity <= 0) {
      throw new BusinessRuleError('Quantity must be greater than zero');
    }

    return {
      id: `${orderId}:${productId}`,
      productId,
      quantity,
      status: 'active',
      createdAt: new Date()
    };
  }

  async releaseStock(reservationId: string): Promise<void> {
    if (!reservationId) {
      throw new NotFoundError('StockReservation', 'UNKNOWN');
    }
  }

  async getActiveReservations(): Promise<StockReservation[]> {
    return [];
  }
}
