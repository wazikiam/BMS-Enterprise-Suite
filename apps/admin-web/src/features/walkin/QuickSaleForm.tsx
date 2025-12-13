import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  MobileStepper,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Receipt as ReceiptIcon,
  Person as PersonIcon,
  ShoppingCart as CartIcon,
  Payment as PaymentIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  AttachMoney as MoneyIcon,
  LocalOffer as DiscountIcon,
  Percent as PercentIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { Product, Customer } from '@bms/core';

interface CartItem {
  productId: string;
  productName: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  stock: number;
}

interface QuickSaleFormProps {
  customer?: Customer & { isTemporary?: boolean };
  products: Product[];
  loading?: boolean;
  onSearchProducts: (searchTerm: string) => Promise<Product[]>;
  onAddToCart: (product: Product) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveFromCart: (productId: string) => void;
  onApplyDiscount: (productId: string, discount: number) => void;
  onCreateSale: (saleData: SaleData) => Promise<string>;
  onCancel: () => void;
  onCustomerChange?: (customerId: string) => void;
}

interface SaleData {
  customerId: string;
  items: CartItem[];
  paymentMethod: 'cash' | 'card' | 'check' | 'transfer';
  paymentAmount: number;
  notes?: string;
  discount?: number;
}

const QuickSaleForm: React.FC<QuickSaleFormProps> = ({
  customer,
  products = [],
  loading = false,
  onSearchProducts,
  onAddToCart,
  onUpdateQuantity,
  onRemoveFromCart,
  onApplyDiscount,
  onCreateSale,
  onCancel,
  onCustomerChange,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'check' | 'transfer'>('cash');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState<string | null>(null);
  const [showProductSearch, setShowProductSearch] = useState(true);

  // Steps for the quick sale process
  const steps = [
    { label: 'Customer Selection', description: 'Select or create customer' },
    { label: 'Add Products', description: 'Scan or search products' },
    { label: 'Review & Payment', description: 'Review items and process payment' },
    { label: 'Complete Sale', description: 'Print documents and finish' },
  ];

  // Calculate cart totals
  const calculateTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    cart.forEach(item => {
      const itemTotal = item.quantity * item.unitPrice;
      const itemDiscount = itemTotal * (item.discount / 100);
      const itemTax = (itemTotal - itemDiscount) * (item.tax / 100);
      
      subtotal += itemTotal;
      totalDiscount += itemDiscount;
      totalTax += itemTax;
    });

    // Apply global discount
    const globalDiscountAmount = subtotal * (globalDiscount / 100);
    totalDiscount += globalDiscountAmount;
    
    const total = subtotal - totalDiscount + totalTax;

    return {
      subtotal,
      totalDiscount,
      totalTax,
      total,
      globalDiscountAmount,
    };
  };

  const totals = calculateTotals();

  // Handle product search
  const handleSearch = async () => {
    if (searchTerm.trim()) {
      const results = await onSearchProducts(searchTerm);
      setSearchResults(results);
    }
  };

  // Handle adding product to cart
  const handleAddToCart = (product: Product) => {
    const existingItem = cart.find(item => item.productId === product.id);
    
    if (existingItem) {
      onUpdateQuantity(product.id, existingItem.quantity + 1);
    } else {
      const newItem: CartItem = {
        productId: product.id,
        productName: product.name,
        barcode: product.barcode,
        quantity: 1,
        unitPrice: product.sellingPrice,
        discount: 0,
        tax: 20, // Default tax rate
        stock: product.stockLevel?.quantity || 0,
      };
      onAddToCart(newItem);
    }
    
    setSearchTerm('');
    setSearchResults([]);
  };

  // Handle quantity changes
  const handleQuantityChange = (productId: string, change: number) => {
    const item = cart.find(item => item.productId === productId);
    if (item) {
      const newQuantity = item.quantity + change;
      if (newQuantity > 0) {
        onUpdateQuantity(productId, newQuantity);
      } else {
        onRemoveFromCart(productId);
      }
    }
  };

  // Handle creating sale
  const handleCreateSale = async () => {
    if (!customer || cart.length === 0) return;

    try {
      setIsSubmitting(true);
      const saleData: SaleData = {
        customerId: customer.id,
        items: cart,
        paymentMethod,
        paymentAmount: totals.total,
        notes,
        discount: globalDiscount,
      };

      const saleId = await onCreateSale(saleData);
      setSaleSuccess(saleId);
      setActiveStep(3);
    } catch (error) {
      console.error('Failed to create sale:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle step navigation
  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  // Initialize payment amount
  useEffect(() => {
    setPaymentAmount(totals.total);
  }, [totals.total]);

  // Reset form
  const handleReset = () => {
    setCart([]);
    setSearchTerm('');
    setSearchResults([]);
    setPaymentMethod('cash');
    setPaymentAmount(0);
    setNotes('');
    setGlobalDiscount(0);
    setSaleSuccess(null);
    setActiveStep(0);
  };

  // Steps content
  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            {customer ? (
              <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight="medium">
                        {customer.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {customer.phone}
                      </Typography>
                      {customer.isTemporary && (
                        <Chip size="small" label="Temporary" color="warning" sx={{ mt: 1 }} />
                      )}
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => onCustomerChange?.('')}
                    >
                      Change Customer
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ) : (
              <Alert severity="info">
                No customer selected. Please select a customer to continue.
              </Alert>
            )}
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!customer}
              fullWidth
              size="large"
              startIcon={<ArrowForwardIcon />}
            >
              Continue to Add Products
            </Button>
          </Box>
        );

      case 1:
        return (
          <Box>
            {/* Product Search */}
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                placeholder="Scan barcode or search product by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button onClick={handleSearch} size="small">
                        Search
                      </Button>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              
              {/* Search Results */}
              {searchResults.length > 0 && (
                <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {searchResults.map((product) => (
                    <Box
                      key={product.id}
                      sx={{
                        p: 2,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                      onClick={() => handleAddToCart(product)}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {product.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {product.barcode} • Stock: {product.stockLevel?.quantity || 0}
                          </Typography>
                        </Box>
                        <Typography variant="body2" fontWeight="bold">
                          {product.sellingPrice.toFixed(2)} MAD
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Paper>
              )}
            </Box>

            {/* Cart Items */}
            {cart.length === 0 ? (
              <Alert severity="info" sx={{ mb: 3 }}>
                No products added yet. Scan or search for products to add to the sale.
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="center">Quantity</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cart.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {item.productName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.barcode}
                          </Typography>
                          {item.stock < item.quantity && (
                            <Alert severity="warning" sx={{ mt: 0.5, py: 0 }} icon={<></>}>
                              <Typography variant="caption">
                                Low stock: {item.stock} available
                              </Typography>
                            </Alert>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {item.unitPrice.toFixed(2)} MAD
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconButton
                              size="small"
                              onClick={() => handleQuantityChange(item.productId, -1)}
                              disabled={item.quantity <= 1}
                            >
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                            <Typography sx={{ mx: 1, minWidth: 30, textAlign: 'center' }}>
                              {item.quantity}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => handleQuantityChange(item.productId, 1)}
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="medium">
                            {(item.quantity * item.unitPrice).toFixed(2)} MAD
                          </Typography>
                          {item.discount > 0 && (
                            <Typography variant="caption" color="success.main">
                              -{item.discount}%
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Remove">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => onRemoveFromCart(item.productId)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={handleBack}
                startIcon={<ArrowBackIcon />}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={cart.length === 0}
                startIcon={<ArrowForwardIcon />}
                sx={{ flexGrow: 1 }}
              >
                Continue to Payment
              </Button>
            </Box>
          </Box>
        );

      case 2:
        return (
          <Box>
            {/* Order Summary */}
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
                  Order Summary
                </Typography>
                
                <Grid container spacing={1} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Subtotal:
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" textAlign="right">
                      {totals.subtotal.toFixed(2)} MAD
                    </Typography>
                  </Grid>
                  
                  {globalDiscount > 0 && (
                    <>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          Global Discount ({globalDiscount}%):
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="success.main" textAlign="right">
                          -{totals.globalDiscountAmount.toFixed(2)} MAD
                        </Typography>
                      </Grid>
                    </>
                  )}
                  
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Total Discount:
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="success.main" textAlign="right">
                      -{totals.totalDiscount.toFixed(2)} MAD
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Tax (20%):
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" textAlign="right">
                      {totals.totalTax.toFixed(2)} MAD
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Divider sx={{ my: 1 }} />
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography variant="body1" fontWeight="bold">
                      Total:
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h6" fontWeight="bold" textAlign="right" color="primary">
                      {totals.total.toFixed(2)} MAD
                    </Typography>
                  </Grid>
                </Grid>

                {/* Global Discount */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Apply Global Discount
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {[0, 5, 10, 15, 20].map((discount) => (
                      <Chip
                        key={discount}
                        label={`${discount}%`}
                        onClick={() => setGlobalDiscount(discount)}
                        color={globalDiscount === discount ? 'primary' : 'default'}
                        variant={globalDiscount === discount ? 'filled' : 'outlined'}
                      />
                    ))}
                  </Box>
                </Box>

                {/* Payment Method */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Payment Method
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {(['cash', 'card', 'check', 'transfer'] as const).map((method) => (
                      <Chip
                        key={method}
                        label={method.charAt(0).toUpperCase() + method.slice(1)}
                        onClick={() => setPaymentMethod(method)}
                        color={paymentMethod === method ? 'primary' : 'default'}
                        variant={paymentMethod === method ? 'filled' : 'outlined'}
                        icon={<MoneyIcon />}
                      />
                    ))}
                  </Box>
                </Box>

                {/* Payment Amount */}
                <TextField
                  fullWidth
                  label="Payment Amount"
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">MAD</InputAdornment>,
                  }}
                  sx={{ mb: 2 }}
                />

                {/* Notes */}
                <TextField
                  fullWidth
                  label="Notes (Optional)"
                  multiline
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this sale..."
                />
              </CardContent>
            </Card>

            {/* Change Calculation */}
            {paymentAmount > totals.total && (
              <Alert severity="info" sx={{ mb: 3 }}>
                Change due: {(paymentAmount - totals.total).toFixed(2)} MAD
              </Alert>
            )}

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={handleBack}
                startIcon={<ArrowBackIcon />}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleCreateSale}
                disabled={isSubmitting || paymentAmount < totals.total}
                startIcon={isSubmitting ? <CircularProgress size={20} /> : <CheckCircleIcon />}
                sx={{ flexGrow: 1 }}
              >
                {isSubmitting ? 'Processing...' : 'Complete Sale'}
              </Button>
            </Box>
          </Box>
        );

      case 3:
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom color="success.main">
              Sale Completed Successfully!
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Sale ID: <strong>{saleSuccess}</strong>
            </Typography>
            
            <Alert severity="success" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body2">
                The sale has been recorded and inventory has been updated.
                {customer?.isTemporary && ' The temporary customer record has been updated.'}
              </Typography>
            </Alert>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 300, mx: 'auto' }}>
              <Button
                variant="contained"
                startIcon={<ReceiptIcon />}
              >
                Print Receipt
              </Button>
              <Button
                variant="outlined"
                onClick={handleReset}
              >
                Create New Sale
              </Button>
              <Button
                variant="text"
                onClick={onCancel}
              >
                Close
              </Button>
            </Box>
          </Box>
        );

      default:
        return 'Unknown step';
    }
  };

  return (
    <Card sx={{ width: '100%', maxWidth: 800, mx: 'auto' }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReceiptIcon color="primary" />
            <Typography variant="h6">
              Quick Sale
            </Typography>
            {customer && (
              <Chip
                size="small"
                label={customer.name}
                icon={<PersonIcon />}
                color="primary"
                variant="outlined"
              />
            )}
          </Box>
          <IconButton onClick={onCancel} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Stepper */}
        <Box sx={{ mb: 4 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>{step.label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {/* Step Content */}
        {getStepContent(activeStep)}

        {/* Mobile Stepper */}
        <MobileStepper
          variant="dots"
          steps={4}
          position="static"
          activeStep={activeStep}
          sx={{ mt: 3, justifyContent: 'center' }}
          nextButton={
            <Button
              size="small"
              onClick={handleNext}
              disabled={activeStep === 3}
            >
              Next
              <KeyboardArrowRight />
            </Button>
          }
          backButton={
            <Button
              size="small"
              onClick={handleBack}
              disabled={activeStep === 0}
            >
              <KeyboardArrowLeft />
              Back
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
};

export default QuickSaleForm; 
