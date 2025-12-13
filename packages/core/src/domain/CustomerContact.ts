// packages/core/src/domain/CustomerContact.ts
export enum ContactRole {
  PRIMARY = 'PRIMARY',
  FINANCE = 'FINANCE',
  TECHNICAL = 'TECHNICAL',
  LOGISTICS = 'LOGISTICS',
  DECISION_MAKER = 'DECISION_MAKER',
  OTHER = 'OTHER'
}

export interface CustomerContact {
  id: string;
  customerId: string;
  
  // Basic information
  firstName: string;
  lastName: string;
  fullName: string;
  
  // Contact details
  email?: string;
  phone?: string;
  mobile?: string;
  jobTitle?: string;
  department?: string;
  
  // Role and preferences
  role: ContactRole;
  isPrimaryContact: boolean;
  preferredContactMethod: 'EMAIL' | 'PHONE' | 'SMS';
  languagePreference: 'fr' | 'en' | 'ar';
  
  // Communication preferences
  receiveMarketing: boolean;
  receiveInvoices: boolean;
  receiveStatements: boolean;
  
  // Notes and metadata
  notes?: string;
  birthday?: Date;
  anniversary?: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  
  // Status
  isActive: boolean;
}

// Contact creation input
export interface CustomerContactCreateInput {
  customerId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  jobTitle?: string;
  department?: string;
  role?: ContactRole;
  isPrimaryContact?: boolean;
  preferredContactMethod?: 'EMAIL' | 'PHONE' | 'SMS';
  languagePreference?: 'fr' | 'en' | 'ar';
  receiveMarketing?: boolean;
  receiveInvoices?: boolean;
  receiveStatements?: boolean;
  notes?: string;
  birthday?: Date;
  anniversary?: Date;
}

// Contact update input
export interface CustomerContactUpdateInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  jobTitle?: string;
  department?: string;
  role?: ContactRole;
  isPrimaryContact?: boolean;
  preferredContactMethod?: 'EMAIL' | 'PHONE' | 'SMS';
  languagePreference?: 'fr' | 'en' | 'ar';
  receiveMarketing?: boolean;
  receiveInvoices?: boolean;
  receiveStatements?: boolean;
  notes?: string;
  birthday?: Date;
  anniversary?: Date;
  isActive?: boolean;
}

// Contact search filters
export interface ContactFilters {
  customerId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: ContactRole;
  isPrimaryContact?: boolean;
  isActive?: boolean;
}

// Contact statistics
export interface ContactStats {
  totalContacts: number;
  activeContacts: number;
  contactsByRole: Record<ContactRole, number>;
  primaryContacts: number;
} 
