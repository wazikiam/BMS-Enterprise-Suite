import { SaleOrderStatus, PaymentType, DocumentType } from '../../core/domain/SaleOrder';
import { PaymentMethod, PaymentStatus } from '../../core/domain/Payment';

// ============================================
// API Request/Response Types
// ============================================

// Sale Order Types
export interface CreateSaleOrderRequest {
  customerId: string;
  orderDate: string | Date;
  deliveryDate?: string | Date;
  paymentType: PaymentType;
  notes?: string;
  paymentTerms?: string;
  shippingAddress?: string;
  billingAddress?: string;
  documentType: DocumentType;
  lines: SaleOrderLineRequest[];
}

export interface SaleOrderLineRequest {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercentage?: number;
  taxPercentage?: number;
  notes?: string;
}

export interface UpdateSaleOrderRequest {
  deliveryDate?: string | Date;
  notes?: string;
  paymentTerms?: string;
  shippingAddress?: string;
  billingAddress?: string;
}

export interface SaleOrderResponse {
  id: string;
  orderNumber: string;
  customerId: string;
  customer?: CustomerBasicResponse;
  orderDate: string;
  deliveryDate?: string;
  status: SaleOrderStatus;
  paymentType: PaymentType;
  paymentStatus: 'pending' | 'partial' | 'paid' | 'overdue';
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  notes?: string;
  createdById: string;
  createdBy?: UserBasicResponse;
  validatedById?: string;
  validatedBy?: UserBasicResponse;
  paymentTerms?: string;
  shippingAddress?: string;
  billingAddress?: string;
  documentType: DocumentType;
  lines: SaleOrderLineResponse[];
  payments: PaymentResponse[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SaleOrderLineResponse {
  id: string;
  saleOrderId: string;
  productId: string;
  product?: ProductBasicResponse;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  taxPercentage: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  notes?: string;
  reservedStock?: number;
  deliveredQuantity?: number;
  createdAt?: string;
  updatedAt?: string;
  isFullyDelivered: boolean;
  remainingToDeliver: number;
  hasStockIssue: boolean;
}

// Payment Types
export interface CreatePaymentRequest {
  amount: number;
  method: PaymentMethod;
  paymentDate: string | Date;
  reference?: string;
  notes?: string;
  bankName?: string;
  checkNumber?: string;
  transactionId?: string;
}

export interface ProcessPaymentRequest {
  paidAmount: number;
  validatedById?: string;
}

export interface PaymentResponse {
  id: string;
  paymentNumber: string;
  saleOrderId: string;
  saleOrder?: SaleOrderBasicResponse;
  customerId: string;
  customer?: CustomerBasicResponse;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  paymentDate: string;
  dueDate?: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string;
  notes?: string;
  isPartial: boolean;
  collectedById: string;
  validatedById?: string;
  receiptNumber?: string;
  bankName?: string;
  checkNumber?: string;
  transactionId?: string;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  isOverdue: boolean;
  daysOverdue: number;
}

// Stock Validation Types
export interface StockValidationRequest {
  lines: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface StockValidationResponse {
  isValid: boolean;
  issues: StockIssue[];
}

export interface StockIssue {
  productId: string;
  productName: string;
  requested: number;
  available: number;
  shortage: number;
}

// Credit Validation Types
export interface CreditValidationRequest {
  lines: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface CreditValidationResponse {
  isValid: boolean;
  currentBalance: number;
  creditLimit: number;
  availableCredit: number;
  orderTotal: number;
  willExceedLimit: boolean;
  exceedsLimit: boolean;
}

// Sales Report Types
export interface SalesReportRequest {
  startDate: string | Date;
  endDate: string | Date;
}

export interface SalesReportResponse {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<SaleOrderStatus, number>;
  revenueByPaymentType: Record<PaymentType, number>;
}

// Pagination Types
export interface PaginatedResponse<T> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: T[];
}

export interface ListSaleOrdersRequest {
  page?: number;
  limit?: number;
  status?: SaleOrderStatus;
  customerId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
}

// ============================================
// Basic Response Types (for nested objects)
// ============================================

export interface CustomerBasicResponse {
  id: string;
  name: string;
  email?: string;
  phone: string;
  company?: string;
  taxId?: string;
  creditLimit?: number;
  currentBalance?: number;
}

export interface ProductBasicResponse {
  id: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
  unitPrice: number;
  availableStock: number;
  minStockLevel: number;
}

export interface UserBasicResponse {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface SaleOrderBasicResponse {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  status: SaleOrderStatus;
  paymentStatus: string;
}

// ============================================
// UI Component Props Types
// ============================================

export interface SaleOrderFormProps {
  initialData?: Partial<CreateSaleOrderRequest>;
  onSubmit: (data: CreateSaleOrderRequest) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export interface PaymentFormProps {
  saleOrderId: string;
  orderTotal: number;
  dueAmount: number;
  onSubmit: (data: CreatePaymentRequest) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export interface ProductPickerProps {
  selectedProducts: SaleOrderLineRequest[];
  onProductsChange: (products: SaleOrderLineRequest[]) => void;
  onStockValidation?: (validation: StockValidationResponse) => void;
  disabled?: boolean;
}

export interface StockValidatorProps {
  productId: string;
  quantity: number;
  onValidationChange?: (isValid: boolean, issue?: StockIssue) => void;
}

export interface CreditLimitValidatorProps {
  customerId: string;
  orderTotal: number;
  onValidationChange?: (isValid: boolean, validation?: CreditValidationResponse) => void;
  showOverrideOption?: boolean;
  onOverrideRequest?: () => void;
}

export interface SalesWorkflowProps {
  saleOrderId: string;
  currentStatus: SaleOrderStatus;
  userRole: string;
  onStatusChange: (newStatus: SaleOrderStatus) => Promise<void>;
  onPaymentAdded?: () => void;
}

// ============================================
// State Management Types
// ============================================

export interface SalesState {
  orders: SaleOrderResponse[];
  currentOrder: SaleOrderResponse | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    status?: SaleOrderStatus;
    customerId?: string;
    startDate?: string;
    endDate?: string;
  };
}

export interface CartState {
  items: CartItem[];
  customerId?: string;
  notes?: string;
  paymentType?: PaymentType;
  documentType?: DocumentType;
}

export interface CartItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  discountPercentage: number;
  taxPercentage: number;
  notes?: string;
  stockInfo?: {
    available: number;
    hasEnoughStock: boolean;
  };
}

// ============================================
// Event Types
// ============================================

export interface SaleOrderCreatedEvent {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  createdById: string;
  createdAt: string;
}

export interface SaleOrderStatusChangedEvent {
  orderId: string;
  oldStatus: SaleOrderStatus;
  newStatus: SaleOrderStatus;
  changedById: string;
  changedAt: string;
  reason?: string;
}

export interface PaymentReceivedEvent {
  paymentId: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  customerId: string;
  collectedById: string;
  receivedAt: string;
}

export interface StockReservedEvent {
  orderId: string;
  productId: string;
  quantity: number;
  reservedAt: string;
}

export interface CreditLimitExceededEvent {
  orderId: string;
  customerId: string;
  customerName: string;
  currentBalance: number;
  creditLimit: number;
  orderAmount: number;
  exceededBy: number;
  occurredAt: string;
}

// ============================================
// Utility Types
// ============================================

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
  message?: string;
};

export type ValidationResult = {
  isValid: boolean;
  errors: Record<string, string>;
};

// ============================================
// Constants
// ============================================

export const SALE_ORDER_STATUS_OPTIONS = [
  { value: SaleOrderStatus.DRAFT, label: 'Draft', color: '#6c757d' },
  { value: SaleOrderStatus.CONFIRMED, label: 'Confirmed', color: '#17a2b8' },
  { value: SaleOrderStatus.VALIDATED, label: 'Validated', color: '#28a745' },
  { value: SaleOrderStatus.PARTIALLY_PAID, label: 'Partially Paid', color: '#ffc107' },
  { value: SaleOrderStatus.FULLY_PAID, label: 'Fully Paid', color: '#20c997' },
  { value: SaleOrderStatus.COMPLETED, label: 'Completed', color: '#007bff' },
  { value: SaleOrderStatus.CANCELLED, label: 'Cancelled', color: '#dc3545' },
  { value: SaleOrderStatus.CREDIT_HOLD, label: 'Credit Hold', color: '#fd7e14' },
] as const;

export const PAYMENT_TYPE_OPTIONS = [
  { value: PaymentType.CASH, label: 'Cash', icon: '💰' },
  { value: PaymentType.CARD, label: 'Card', icon: '💳' },
  { value: PaymentType.CHECK, label: 'Check', icon: '📄' },
  { value: PaymentType.TRANSFER, label: 'Transfer', icon: '🔄' },
  { value: PaymentType.CREDIT, label: 'Credit', icon: '📝' },
] as const;

export const PAYMENT_METHOD_OPTIONS = [
  { value: PaymentMethod.CASH, label: 'Cash' },
  { value: PaymentMethod.CREDIT_CARD, label: 'Credit Card' },
  { value: PaymentMethod.DEBIT_CARD, label: 'Debit Card' },
  { value: PaymentMethod.BANK_TRANSFER, label: 'Bank Transfer' },
  { value: PaymentMethod.CHECK, label: 'Check' },
  { value: PaymentMethod.MOBILE_MONEY, label: 'Mobile Money' },
  { value: PaymentMethod.CREDIT, label: 'Credit' },
  { value: PaymentMethod.OTHER, label: 'Other' },
] as const;

export const DOCUMENT_TYPE_OPTIONS = [
  { value: DocumentType.INVOICE, label: 'Invoice', printTemplates: ['invoice', 'receipt'] },
  { value: DocumentType.DELIVERY_NOTE, label: 'Delivery Note', printTemplates: ['delivery_note'] },
  { value: DocumentType.RECEIPT, label: 'Receipt', printTemplates: ['receipt'] },
  { value: DocumentType.QUOTATION, label: 'Quotation', printTemplates: ['invoice'] },
] as const;

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: '#6c757d' },
  { value: 'partial', label: 'Partial', color: '#ffc107' },
  { value: 'paid', label: 'Paid', color: '#28a745' },
  { value: 'overdue', label: 'Overdue', color: '#dc3545' },
] as const;

// ============================================
// Type Guards
// ============================================

export function isSaleOrderStatus(status: string): status is SaleOrderStatus {
  return Object.values(SaleOrderStatus).includes(status as SaleOrderStatus);
}

export function isPaymentType(type: string): type is PaymentType {
  return Object.values(PaymentType).includes(type as PaymentType);
}

export function isPaymentMethod(method: string): method is PaymentMethod {
  return Object.values(PaymentMethod).includes(method as PaymentMethod);
}

export function isDocumentType(type: string): type is DocumentType {
  return Object.values(DocumentType).includes(type as DocumentType);
}

// ============================================
// Helper Functions Type Signatures
// ============================================

export type CalculateLineTotals = (
  quantity: number,
  unitPrice: number,
  discountPercentage: number,
  taxPercentage: number
) => {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
};

export type GenerateOrderNumber = () => string;
export type GeneratePaymentNumber = () => string;

export type FormatCurrency = (
  amount: number,
  currency?: string,
  locale?: string
) => string;

export type GetStatusColor = (status: SaleOrderStatus) => string;
export type GetPaymentStatusColor = (status: string) => string; 
