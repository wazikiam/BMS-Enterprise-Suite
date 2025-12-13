// packages/server/src/api/customers/customers.validator.ts
import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CustomerType, CustomerStatus } from '../../../core/src/domain/Customer';
import { AddressType } from '../../../core/src/domain/CustomerAddress';
import { ContactRole } from '../../../core/src/domain/CustomerContact';

export class CustomerValidators {
  // ========== CUSTOMER CRUD VALIDATORS ==========

  static validateCreateCustomer = [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
      .matches(/^[a-zA-Z0-9\s\-\.',&]+$/).withMessage('Name contains invalid characters'),
    
    body('phone')
      .trim()
      .notEmpty().withMessage('Phone is required')
      .matches(/^(?:\+212|0)([5-7]\d{8})$/).withMessage('Invalid Moroccan phone number format (ex: +212612345678 or 0612345678)'),
    
    body('email')
      .optional()
      .trim()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    
    body('taxId')
      .optional()
      .trim()
      .matches(/^[A-Z0-9\-]+$/).withMessage('Invalid tax ID format'),
    
    body('companyName')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('Company name must not exceed 200 characters'),
    
    body('type')
      .optional()
      .isIn(Object.values(CustomerType)).withMessage(`Type must be one of: ${Object.values(CustomerType).join(', ')}`),
    
    body('tags')
      .optional()
      .isArray().withMessage('Tags must be an array')
      .custom((tags: string[]) => {
        if (tags.length > 10) {
          throw new Error('Maximum 10 tags allowed');
        }
        return tags.every(tag => typeof tag === 'string' && tag.length <= 50);
      }).withMessage('Each tag must be a string up to 50 characters'),
    
    body('creditLimit')
      .optional()
      .isFloat({ min: 0, max: 1000000 }).withMessage('Credit limit must be between 0 and 1,000,000')
      .toFloat(),
    
    body('segmentId')
      .optional()
      .isUUID().withMessage('Segment ID must be a valid UUID'),
    
    body('assignedSellerId')
      .optional()
      .isUUID().withMessage('Assigned seller ID must be a valid UUID')
  ];

  static validateUpdateCustomer = [
    param('id')
      .isUUID().withMessage('Invalid customer ID format'),
    
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
      .matches(/^[a-zA-Z0-9\s\-\.',&]+$/).withMessage('Name contains invalid characters'),
    
    body('phone')
      .optional()
      .trim()
      .matches(/^(?:\+212|0)([5-7]\d{8})$/).withMessage('Invalid Moroccan phone number format (ex: +212612345678 or 0612345678)'),
    
    body('email')
      .optional()
      .trim()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    
    body('status')
      .optional()
      .isIn(Object.values(CustomerStatus)).withMessage(`Status must be one of: ${Object.values(CustomerStatus).join(', ')}`),
    
    body('creditLimit')
      .optional()
      .isFloat({ min: 0, max: 1000000 }).withMessage('Credit limit must be between 0 and 1,000,000')
      .toFloat(),
    
    body('tags')
      .optional()
      .isArray().withMessage('Tags must be an array')
      .custom((tags: string[]) => {
        if (tags.length > 10) {
          throw new Error('Maximum 10 tags allowed');
        }
        return tags.every(tag => typeof tag === 'string' && tag.length <= 50);
      }).withMessage('Each tag must be a string up to 50 characters')
  ];

  static validateCustomerId = [
    param('id')
      .isUUID().withMessage('Invalid customer ID format')
  ];

  static validateCustomerCode = [
    param('code')
      .matches(/^[A-Z][0-9]{8}$/).withMessage('Invalid customer code format (ex: I24010001)')
  ];

  // ========== CUSTOMER LISTING VALIDATORS ==========

  static validateListCustomers = [
    query('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Name search must be between 2 and 100 characters'),
    
    query('phone')
      .optional()
      .trim()
      .matches(/^(?:\+212|0)?([5-7]\d{0,8})$/).withMessage('Invalid phone search format'),
    
    query('email')
      .optional()
      .trim()
      .isEmail().withMessage('Invalid email format'),
    
    query('type')
      .optional()
      .isIn(Object.values(CustomerType)).withMessage(`Type must be one of: ${Object.values(CustomerType).join(', ')}`),
    
    query('status')
      .optional()
      .isIn(Object.values(CustomerStatus)).withMessage(`Status must be one of: ${Object.values(CustomerStatus).join(', ')}`),
    
    query('tags')
      .optional()
      .custom((tags: string) => {
        if (tags) {
          const tagArray = tags.split(',');
          return tagArray.every(tag => typeof tag === 'string' && tag.length <= 50);
        }
        return true;
      }).withMessage('Invalid tags format'),
    
    query('segmentId')
      .optional()
      .isUUID().withMessage('Invalid segment ID format'),
    
    query('assignedSellerId')
      .optional()
      .isUUID().withMessage('Invalid assigned seller ID format'),
    
    query('hasCreditLimit')
      .optional()
      .isBoolean().withMessage('hasCreditLimit must be true or false')
      .toBoolean(),
    
    query('minBalance')
      .optional()
      .isFloat({ min: 0 }).withMessage('Minimum balance must be a positive number')
      .toFloat(),
    
    query('maxBalance')
      .optional()
      .isFloat({ min: 0 }).withMessage('Maximum balance must be a positive number')
      .toFloat(),
    
    query('createdAfter')
      .optional()
      .isISO8601().withMessage('Invalid date format for createdAfter (use ISO 8601)')
      .toDate(),
    
    query('createdBefore')
      .optional()
      .isISO8601().withMessage('Invalid date format for createdBefore (use ISO 8601)')
      .toDate(),
    
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer')
      .toInt(),
    
    query('pageSize')
      .optional()
      .isInt({ min: 1, max: 1000 }).withMessage('Page size must be between 1 and 1000')
      .toInt()
  ];

  static validateSearchCustomers = [
    query('query')
      .trim()
      .notEmpty().withMessage('Search query is required')
      .isLength({ min: 2, max: 100 }).withMessage('Search query must be between 2 and 100 characters'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
      .toInt()
  ];

  // ========== CUSTOMER ADDRESS VALIDATORS ==========

  static validateCreateAddress = [
    param('customerId')
      .isUUID().withMessage('Invalid customer ID format'),
    
    body('type')
      .isIn(Object.values(AddressType)).withMessage(`Address type must be one of: ${Object.values(AddressType).join(', ')}`),
    
    body('street')
      .trim()
      .notEmpty().withMessage('Street is required')
      .isLength({ max: 200 }).withMessage('Street must not exceed 200 characters'),
    
    body('street2')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('Street 2 must not exceed 200 characters'),
    
    body('city')
      .trim()
      .notEmpty().withMessage('City is required')
      .isLength({ max: 100 }).withMessage('City must not exceed 100 characters'),
    
    body('state')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('State must not exceed 100 characters'),
    
    body('postalCode')
      .trim()
      .notEmpty().withMessage('Postal code is required')
      .matches(/^[0-9]{5,10}$/).withMessage('Postal code must be 5-10 digits'),
    
    body('country')
      .trim()
      .notEmpty().withMessage('Country is required')
      .isLength({ max: 100 }).withMessage('Country must not exceed 100 characters'),
    
    body('contactName')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Contact name must not exceed 100 characters'),
    
    body('contactPhone')
      .optional()
      .trim()
      .matches(/^(?:\+212|0)([5-7]\d{8})$/).withMessage('Invalid Moroccan phone number format'),
    
    body('isDefaultBilling')
      .optional()
      .isBoolean().withMessage('isDefaultBilling must be true or false')
      .toBoolean(),
    
    body('isDefaultShipping')
      .optional()
      .isBoolean().withMessage('isDefaultShipping must be true or false')
      .toBoolean(),
    
    body('latitude')
      .optional()
      .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90')
      .toFloat(),
    
    body('longitude')
      .optional()
      .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180')
      .toFloat(),
    
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Notes must not exceed 500 characters')
  ];

  static validateUpdateAddress = [
    param('addressId')
      .isUUID().withMessage('Invalid address ID format'),
    
    body('type')
      .optional()
      .isIn(Object.values(AddressType)).withMessage(`Address type must be one of: ${Object.values(AddressType).join(', ')}`),
    
    body('street')
      .optional()
      .trim()
      .isLength({ max: 200 }).withMessage('Street must not exceed 200 characters'),
    
    body('city')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('City must not exceed 100 characters'),
    
    body('postalCode')
      .optional()
      .trim()
      .matches(/^[0-9]{5,10}$/).withMessage('Postal code must be 5-10 digits'),
    
    body('country')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Country must not exceed 100 characters'),
    
    body('contactPhone')
      .optional()
      .trim()
      .matches(/^(?:\+212|0)([5-7]\d{8})$/).withMessage('Invalid Moroccan phone number format')
  ];

  static validateAddressId = [
    param('addressId')
      .isUUID().withMessage('Invalid address ID format')
  ];

  static validateSetDefaultAddress = [
    param('customerId')
      .isUUID().withMessage('Invalid customer ID format'),
    
    param('addressId')
      .isUUID().withMessage('Invalid address ID format'),
    
    body('type')
      .isIn(['BILLING', 'SHIPPING']).withMessage('Type must be BILLING or SHIPPING')
  ];

  // ========== CUSTOMER CONTACT VALIDATORS ==========

  static validateCreateContact = [
    param('customerId')
      .isUUID().withMessage('Invalid customer ID format'),
    
    body('firstName')
      .trim()
      .notEmpty().withMessage('First name is required')
      .isLength({ max: 50 }).withMessage('First name must not exceed 50 characters')
      .matches(/^[a-zA-Z\s\-']+$/).withMessage('First name contains invalid characters'),
    
    body('lastName')
      .trim()
      .notEmpty().withMessage('Last name is required')
      .isLength({ max: 50 }).withMessage('Last name must not exceed 50 characters')
      .matches(/^[a-zA-Z\s\-']+$/).withMessage('Last name contains invalid characters'),
    
    body('email')
      .optional()
      .trim()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    
    body('phone')
      .optional()
      .trim()
      .matches(/^(?:\+212|0)([5-7]\d{8})$/).withMessage('Invalid Moroccan phone number format'),
    
    body('mobile')
      .optional()
      .trim()
      .matches(/^(?:\+212|0)([5-7]\d{8})$/).withMessage('Invalid Moroccan mobile number format'),
    
    body('jobTitle')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Job title must not exceed 100 characters'),
    
    body('department')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Department must not exceed 100 characters'),
    
    body('role')
      .optional()
      .isIn(Object.values(ContactRole)).withMessage(`Role must be one of: ${Object.values(ContactRole).join(', ')}`),
    
    body('isPrimaryContact')
      .optional()
      .isBoolean().withMessage('isPrimaryContact must be true or false')
      .toBoolean(),
    
    body('preferredContactMethod')
      .optional()
      .isIn(['EMAIL', 'PHONE', 'SMS']).withMessage('Preferred contact method must be EMAIL, PHONE, or SMS'),
    
    body('languagePreference')
      .optional()
      .isIn(['fr', 'en', 'ar']).withMessage('Language preference must be fr, en, or ar'),
    
    body('receiveMarketing')
      .optional()
      .isBoolean().withMessage('receiveMarketing must be true or false')
      .toBoolean(),
    
    body('receiveInvoices')
      .optional()
      .isBoolean().withMessage('receiveInvoices must be true or false')
      .toBoolean(),
    
    body('receiveStatements')
      .optional()
      .isBoolean().withMessage('receiveStatements must be true or false')
      .toBoolean(),
    
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Notes must not exceed 500 characters'),
    
    body('birthday')
      .optional()
      .isISO8601().withMessage('Invalid birthday format (use ISO 8601)')
      .toDate()
      .custom((date: Date) => {
        if (date > new Date()) {
          throw new Error('Birthday cannot be in the future');
        }
        return true;
      }),
    
    body('anniversary')
      .optional()
      .isISO8601().withMessage('Invalid anniversary format (use ISO 8601)')
      .toDate()
  ];

  static validateUpdateContact = [
    param('contactId')
      .isUUID().withMessage('Invalid contact ID format'),
    
    body('firstName')
      .optional()
      .trim()
      .isLength({ max: 50 }).withMessage('First name must not exceed 50 characters')
      .matches(/^[a-zA-Z\s\-']+$/).withMessage('First name contains invalid characters'),
    
    body('lastName')
      .optional()
      .trim()
      .isLength({ max: 50 }).withMessage('Last name must not exceed 50 characters')
      .matches(/^[a-zA-Z\s\-']+$/).withMessage('Last name contains invalid characters'),
    
    body('email')
      .optional()
      .trim()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    
    body('phone')
      .optional()
      .trim()
      .matches(/^(?:\+212|0)([5-7]\d{8})$/).withMessage('Invalid Moroccan phone number format'),
    
    body('role')
      .optional()
      .isIn(Object.values(ContactRole)).withMessage(`Role must be one of: ${Object.values(ContactRole).join(', ')}`)
  ];

  static validateContactId = [
    param('contactId')
      .isUUID().withMessage('Invalid contact ID format')
  ];

  static validateSetPrimaryContact = [
    param('customerId')
      .isUUID().withMessage('Invalid customer ID format'),
    
    param('contactId')
      .isUUID().withMessage('Invalid contact ID format')
  ];

  // ========== CREDIT MANAGEMENT VALIDATORS ==========

  static validateSetCreditLimit = [
    param('customerId')
      .isUUID().withMessage('Invalid customer ID format'),
    
    body('amount')
      .isFloat({ min: 0, max: 1000000 }).withMessage('Amount must be between 0 and 1,000,000')
      .toFloat(),
    
    body('currency')
      .optional()
      .isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters (ex: MAD)'),
    
    body('terms')
      .optional()
      .isInt({ min: 1, max: 365 }).withMessage('Payment terms must be between 1 and 365 days')
      .toInt()
  ];

  static validateUpdateCreditLimit = [
    param('customerId')
      .isUUID().withMessage('Invalid customer ID format'),
    
    body('newAmount')
      .isFloat({ min: 0, max: 1000000 }).withMessage('New amount must be between 0 and 1,000,000')
      .toFloat(),
    
    body('reason')
      .trim()
      .notEmpty().withMessage('Reason is required')
      .isLength({ min: 10, max: 500 }).withMessage('Reason must be between 10 and 500 characters')
  ];

  static validateSuspendCreditLimit = [
    param('customerId')
      .isUUID().withMessage('Invalid customer ID format'),
    
    body('reason')
      .trim()
      .notEmpty().withMessage('Reason is required')
      .isLength({ min: 10, max: 500 }).withMessage('Reason must be between 10 and 500 characters')
  ];

  static validateReinstateCreditLimit = [
    param('customerId')
      .isUUID().withMessage('Invalid customer ID format'),
    
    body('reason')
      .trim()
      .notEmpty().withMessage('Reason is required')
      .isLength({ min: 10, max: 500 }).withMessage('Reason must be between 10 and 500 characters')
  ];

  // ========== TRANSACTION VALIDATORS ==========

  static validateGetTransactions = [
    param('customerId')
      .isUUID().withMessage('Invalid customer ID format'),
    
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be a positive integer')
      .toInt(),
    
    query('pageSize')
      .optional()
      .isInt({ min: 1, max: 1000 }).withMessage('Page size must be between 1 and 1000')
      .toInt()
  ];

  // ========== BULK OPERATION VALIDATORS ==========

  static validateImportCustomers = [
    body('data')
      .isArray().withMessage('Data must be an array')
      .notEmpty().withMessage('Data array cannot be empty')
      .custom((data: any[]) => {
        if (data.length > 1000) {
          throw new Error('Maximum 1000 records per import');
        }
        return true;
      }),
    
    body('data.*.name')
      .notEmpty().withMessage('Name is required for each record')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    
    body('data.*.phone')
      .notEmpty().withMessage('Phone is required for each record')
      .matches(/^(?:\+212|0)([5-7]\d{8})$/).withMessage('Invalid Moroccan phone number format'),
    
    body('data.*.email')
      .optional()
      .isEmail().withMessage('Invalid email format'),
    
    body('data.*.creditLimit')
      .optional()
      .isFloat({ min: 0 }).withMessage('Credit limit must be a positive number')
      .toFloat()
  ];

  static validateExportCustomers = [
    query('name')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Name filter must not exceed 100 characters'),
    
    query('phone')
      .optional()
      .trim()
      .matches(/^(?:\+212|0)?([5-7]\d{0,8})$/).withMessage('Invalid phone filter format'),
    
    query('type')
      .optional()
      .isIn(Object.values(CustomerType)).withMessage(`Type must be one of: ${Object.values(CustomerType).join(', ')}`),
    
    query('status')
      .optional()
      .isIn(Object.values(CustomerStatus)).withMessage(`Status must be one of: ${Object.values(CustomerStatus).join(', ')}`)
  ];

  // ========== VALIDATION RESULT HANDLER ==========

  static handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => ({
        field: err.type === 'field' ? err.path : err.type,
        message: err.msg,
        value: err.value
      }));
      
      res.status(400).json({
        success: false,
        errors: errorMessages,
        message: 'Validation failed'
      });
      return;
    }
    
    next();
  }

  // ========== CUSTOM VALIDATORS ==========

  static validatePhoneFormat(phone: string): boolean {
    const moroccanRegex = /^(?:\+212|0)([5-7]\d{8})$/;
    return moroccanRegex.test(phone);
  }

  static validateEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateCustomerCodeFormat(code: string): boolean {
    const codeRegex = /^[A-Z][0-9]{8}$/;
    return codeRegex.test(code);
  }

  static validatePostalCodeFormat(postalCode: string): boolean {
    const postalRegex = /^[0-9]{5,10}$/;
    return postalRegex.test(postalCode);
  }

  static validateCreditLimitAmount(amount: number): { valid: boolean; message?: string } {
    if (amount < 0) {
      return { valid: false, message: 'Credit limit cannot be negative' };
    }
    if (amount > 1000000) {
      return { valid: false, message: 'Credit limit cannot exceed 1,000,000' };
    }
    return { valid: true };
  }

  static validateCustomerType(type: string): boolean {
    return Object.values(CustomerType).includes(type as CustomerType);
  }

  static validateCustomerStatus(status: string): boolean {
    return Object.values(CustomerStatus).includes(status as CustomerStatus);
  }

  static validateAddressType(type: string): boolean {
    return Object.values(AddressType).includes(type as AddressType);
  }

  static validateContactRole(role: string): boolean {
    return Object.values(ContactRole).includes(role as ContactRole);
  }

  // ========== SANITIZATION METHODS ==========

  static sanitizeCustomerInput(input: any): any {
    const sanitized = { ...input };
    
    // Trim string fields
    if (sanitized.name) sanitized.name = sanitized.name.trim();
    if (sanitized.phone) sanitized.phone = sanitized.phone.trim();
    if (sanitized.email) sanitized.email = sanitized.email.trim().toLowerCase();
    if (sanitized.taxId) sanitized.taxId = sanitized.taxId.trim().toUpperCase();
    if (sanitized.companyName) sanitized.companyName = sanitized.companyName.trim();
    if (sanitized.notes) sanitized.notes = sanitized.notes.trim();
    
    // Ensure tags is an array of strings
    if (sanitized.tags && Array.isArray(sanitized.tags)) {
      sanitized.tags = sanitized.tags.map((tag: string) => tag.trim());
    }
    
    return sanitized;
  }

  static sanitizeAddressInput(input: any): any {
    const sanitized = { ...input };
    
    // Trim string fields
    if (sanitized.street) sanitized.street = sanitized.street.trim();
    if (sanitized.street2) sanitized.street2 = sanitized.street2.trim();
    if (sanitized.city) sanitized.city = sanitized.city.trim();
    if (sanitized.state) sanitized.state = sanitized.state.trim();
    if (sanitized.postalCode) sanitized.postalCode = sanitized.postalCode.trim();
    if (sanitized.country) sanitized.country = sanitized.country.trim();
    if (sanitized.contactName) sanitized.contactName = sanitized.contactName.trim();
    if (sanitized.contactPhone) sanitized.contactPhone = sanitized.contactPhone.trim();
    if (sanitized.notes) sanitized.notes = sanitized.notes.trim();
    
    return sanitized;
  }

  static sanitizeContactInput(input: any): any {
    const sanitized = { ...input };
    
    // Trim string fields
    if (sanitized.firstName) sanitized.firstName = sanitized.firstName.trim();
    if (sanitized.lastName) sanitized.lastName = sanitized.lastName.trim();
    if (sanitized.email) sanitized.email = sanitized.email.trim().toLowerCase();
    if (sanitized.phone) sanitized.phone = sanitized.phone.trim();
    if (sanitized.mobile) sanitized.mobile = sanitized.mobile.trim();
    if (sanitized.jobTitle) sanitized.jobTitle = sanitized.jobTitle.trim();
    if (sanitized.department) sanitized.department = sanitized.department.trim();
    if (sanitized.notes) sanitized.notes = sanitized.notes.trim();
    
    // Generate full name if not provided
    if (sanitized.firstName && sanitized.lastName && !sanitized.fullName) {
      sanitized.fullName = `${sanitized.firstName} ${sanitized.lastName}`.trim();
    }
    
    return sanitized;
  }

  // ========== VALIDATION MIDDLEWARE ==========

  static validateRequest = (validators: any[]) => {
    return [
      ...validators,
      CustomerValidators.handleValidationErrors
    ];
  };

  // ========== QUERY PARAM VALIDATION ==========

  static validateDateRange = [
    query('startDate')
      .optional()
      .isISO8601().withMessage('Invalid start date format')
      .toDate(),
    
    query('endDate')
      .optional()
      .isISO8601().withMessage('Invalid end date format')
      .toDate()
      .custom((endDate: Date, { req }) => {
        const startDate = req.query.startDate;
        if (startDate && endDate < startDate) {
          throw new Error('End date must be after start date');
        }
        return true;
      })
  ];

  static validateAmountRange = [
    query('minAmount')
      .optional()
      .isFloat({ min: 0 }).withMessage('Minimum amount must be positive')
      .toFloat(),
    
    query('maxAmount')
      .optional()
      .isFloat({ min: 0 }).withMessage('Maximum amount must be positive')
      .toFloat()
      .custom((maxAmount: number, { req }) => {
        const minAmount = req.query.minAmount;
        if (minAmount && maxAmount < minAmount) {
          throw new Error('Maximum amount must be greater than minimum amount');
        }
        return true;
      })
  ];
} 
