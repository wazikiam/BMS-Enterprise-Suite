// packages/core/src/repositories/CustomerRepository.ts

import {
  Customer,
  CustomerCreateInput,
  CustomerUpdateInput,
  CustomerFilters,
} from '../domain/Customer';

/**
 * CustomerRepository
 * ------------------
 * Persistence boundary for Customers domain.
 * No credit, no sales, no infrastructure concerns.
 */
export interface CustomerRepository {
  findById(id: string): Promise<Customer | null>;

  findByCode(code: string): Promise<Customer | null>;

  search(filters: CustomerFilters): Promise<Customer[]>;

  create(
    input: CustomerCreateInput & {
      id: string;
      code: string;
      createdBy: string;
      createdAt: Date;
      updatedAt: Date;
    }
  ): Promise<Customer>;

  update(
    id: string,
    input: CustomerUpdateInput & {
      updatedAt: Date;
    }
  ): Promise<Customer>;

  deactivate(id: string, updatedAt: Date): Promise<void>;
}
