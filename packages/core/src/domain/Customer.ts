// packages/core/src/domain/Customer.ts

/**
 * ============================
 * Customers Domain (Week 3)
 * ============================
 * This file defines CUSTOMER DOMAIN SHAPES ONLY.
 * No database, no HTTP, no services, no cross-domain logic.
 */

/* ----------------------------
 * Enums
 * ---------------------------- */

export enum CustomerType {
  INDIVIDUAL = 'INDIVIDUAL',
  COMPANY = 'COMPANY',
}

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
  SUSPENDED = 'SUSPENDED',
}

/* ----------------------------
 * Core Customer Domain
 * ---------------------------- */

/**
 * Pure customer identity & profile.
 * This is the ONLY interface the Customers domain truly owns.
 */
export interface Customer {
  id: string;
  code: string;

  type: CustomerType;
  status: CustomerStatus;

  // Required identity fields
  name: string;
  phone: string;

  // Optional profile fields
  email?: string;
  taxId?: string;
  companyName?: string;
  notes?: string;

  // Address
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;

  // Segmentation & assignment
  tags: string[];
  segmentId?: string;
  assignedSellerId?: string;

  // Audit metadata (still domain-safe)
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/* ----------------------------
 * Financial Snapshot (READ-ONLY)
 * ---------------------------- */

/**
 * Temporary projection from Credit domain.
 * Customers domain does NOT calculate or mutate these.
 */
export interface CustomerFinancialSnapshot {
  creditLimit?: number;
  currentBalance: number;
  creditRating?: 'A' | 'B' | 'C' | 'D';

  creditLimitId?: string;
  balanceId?: string;
}

/* ----------------------------
 * Sales Statistics Snapshot (READ-ONLY)
 * ---------------------------- */

/**
 * Derived from Sales domain.
 * Customers domain never updates these values.
 */
export interface CustomerStatsSnapshot {
  totalPurchases: number;
  lastPurchaseDate?: Date;
  averageTransactionValue: number;
}

/* ----------------------------
 * Optimistic Concurrency (Infrastructure)
 * ---------------------------- */

/**
 * Used by repositories only.
 * Has no business meaning.
 */
export interface CustomerVersioned {
  version: number;
}

/* ----------------------------
 * Creation Input
 * ---------------------------- */

export interface CustomerCreateInput {
  name: string;
  phone: string;

  email?: string;
  taxId?: string;
  companyName?: string;

  type?: CustomerType;
  tags?: string[];
  segmentId?: string;

  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
}

/* ----------------------------
 * Update Input
 * ---------------------------- */

export interface CustomerUpdateInput {
  name?: string;
  phone?: string;

  email?: string;
  taxId?: string;
  companyName?: string;
  notes?: string;

  status?: CustomerStatus;
  tags?: string[];
  segmentId?: string;
  assignedSellerId?: string;

  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
}

/* ----------------------------
 * Search Filters
 * ---------------------------- */

export interface CustomerFilters {
  name?: string;
  phone?: string;
  email?: string;

  type?: CustomerType;
  status?: CustomerStatus;

  tags?: string[];
  segmentId?: string;
  assignedSellerId?: string;

  createdAfter?: Date;
  createdBefore?: Date;

  location?: string; // city or country
}

/* ----------------------------
 * Reporting View (READ-ONLY)
 * ---------------------------- */

export interface CustomerStats {
  totalCustomers: number;
  activeCustomers: number;

  customersByType: Record<CustomerType, number>;
  customersByStatus: Record<CustomerStatus, number>;
}
