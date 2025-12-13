// packages/core/src/domain/Customer.ts
export enum CustomerType {
  INDIVIDUAL = 'INDIVIDUAL',
  COMPANY = 'COMPANY',
}

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
  SUSPENDED = 'SUSPENDED'  // ADDED THIS LINE
}

export interface Customer {
  id: string;
  code: string;
  type: CustomerType;
  status: CustomerStatus;
  
  // Required fields (name + phone only for quick creation)
  name: string;
  phone: string;
  
  // Optional fields
  email?: string;
  taxId?: string;
  companyName?: string;
  notes?: string;
  
  // Address fields (ADDED THESE)
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  
  // Metadata
  tags: string[];
  segmentId?: string;
  assignedSellerId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Version for optimistic concurrency (ADDED THIS)
  version: number;
  
  // Credit information
  creditLimit?: number;
  currentBalance: number;
  creditRating?: 'A' | 'B' | 'C' | 'D';
  
  // Statistics
  totalPurchases: number;
  lastPurchaseDate?: Date;
  averageTransactionValue: number;
  
  // Additional fields for services (ADDED THESE)
  creditLimitId?: string;
  balanceId?: string;
  updatedBy?: string;
  deletedBy?: string;
  deletedAt?: Date;
}

// Validation interface for customer data
export interface CustomerCreateInput {
  name: string;
  phone: string;
  email?: string;
  taxId?: string;
  companyName?: string;
  type?: CustomerType;
  tags?: string[];
  segmentId?: string;
  creditLimit?: number;
  address?: string;       // ADDED
  city?: string;         // ADDED
  country?: string;      // ADDED
  postalCode?: string;   // ADDED
}

// Update interface (partial updates)
export interface CustomerUpdateInput {
  name?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  companyName?: string;
  status?: CustomerStatus;
  tags?: string[];
  segmentId?: string;
  creditLimit?: number;
  assignedSellerId?: string;
  notes?: string;
  address?: string;      // ADDED
  city?: string;        // ADDED
  country?: string;     // ADDED
  postalCode?: string;  // ADDED
}

// Search filters for customer queries
export interface CustomerFilters {
  name?: string;
  phone?: string;
  email?: string;
  type?: CustomerType;
  status?: CustomerStatus;
  tags?: string[];
  segmentId?: string;
  assignedSellerId?: string;
  hasCreditLimit?: boolean;
  minBalance?: number;
  maxBalance?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  location?: string;    // ADDED for city/country search
}

// Customer statistics for reporting
export interface CustomerStats {
  totalCustomers: number;
  activeCustomers: number;
  totalBalance: number;
  averageCreditLimit: number;
  customersByType: Record<CustomerType, number>;
  customersByStatus: Record<CustomerStatus, number>;
}