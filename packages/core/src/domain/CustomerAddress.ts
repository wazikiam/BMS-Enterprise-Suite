// packages/core/src/domain/CustomerAddress.ts
export enum AddressType {
  BILLING = 'BILLING',
  SHIPPING = 'SHIPPING',
  BOTH = 'BOTH'
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  type: AddressType;
  
  // Address fields
  street: string;
  street2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  
  // Contact information
  contactName?: string;
  contactPhone?: string;
  
  // Default flags
  isDefaultBilling: boolean;
  isDefaultShipping: boolean;
  
  // Coordinates (for mapping/delivery optimization)
  latitude?: number;
  longitude?: number;
  
  // Metadata
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Address creation input
export interface CustomerAddressCreateInput {
  customerId: string;
  type: AddressType;
  street: string;
  street2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  contactName?: string;
  contactPhone?: string;
  isDefaultBilling?: boolean;
  isDefaultShipping?: boolean;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

// Address update input
export interface CustomerAddressUpdateInput {
  type?: AddressType;
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  contactName?: string;
  contactPhone?: string;
  isDefaultBilling?: boolean;
  isDefaultShipping?: boolean;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

// Address validation result
export interface AddressValidationResult {
  isValid: boolean;
  errors: string[];
  normalizedAddress?: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
} 
