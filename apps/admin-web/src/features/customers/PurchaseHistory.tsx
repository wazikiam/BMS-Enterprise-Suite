import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Grid,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Avatar,
  LinearProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Receipt as ReceiptIcon,
  Visibility as VisibilityIcon,
  Print as PrintIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Refresh as RefreshIcon,
  CalendarMonth as CalendarIcon,
  LocalOffer as DiscountIcon,
  Inventory as InventoryIcon,
  Paid as PaidIcon,
  Pending as PendingIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { SaleOrder, Product } from '@bms/core';

interface PurchaseHistoryProps {
  customerId: string;
  customerName: string;
  sales: SaleOrder[];
  loading?: boolean;
  onRefresh?: () => void;
  onExport?: (format: 'pdf' | 'excel' | 'csv') => void;
  onViewOrder?: (orderId: string) => void;
  onPrintDocument?: (orderId: string, documentType: 'invoice' | 'receipt' | 'delivery') => void;
  onFilterChange?: (filters: PurchaseFilters) => void;
}

interface PurchaseFilters {
  status?: 'draft' | 'confirmed' | 'invoiced' | 'paid' | 'cancelled';
  paymentStatus?: 'pending' | 'partial' | 'paid' | 'overdue';
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  productId?: string;
}

const PurchaseHistory: React.FC<PurchaseHistoryProps> = ({
  customerId,
  customerName,
  sales = [],
  loading = false,
  onRefresh,
  onExport,
  onViewOrder,
  onPrintDocument,
  onFilterChange,
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<PurchaseFilters>({});
  const [selectedOrder, setSelectedOrder] = useState<SaleOrder | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Handle pagination
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Apply filters and search
  const filteredSales = sales.filter((sale) => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        sale.orderNumber.toLowerCase().includes(searchLower) ||
        sale.reference?.toLowerCase().includes(searchLower) ||
        sale.notes?.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;
    }

    // Status filter
    if (filters.status && sale.status !== filters.status) return false;

    // Payment status filter
    if (filters.paymentStatus && sale.paymentStatus !== filters.paymentStatus) return false;

    // Amount filters
    if (filters.minAmount && sale.totalAmount < filters.minAmount) return false;
    if (filters.maxAmount && sale.totalAmount > filters.maxAmount) return false;

    // Date filters
    if (filters.startDate && new Date(sale.orderDate) < filters.startDate) return false;
    if (filters.endDate && new Date(sale.orderDate) > filters.endDate) return false;

    // Product filter
    if (filters.productId && !sale.items.some(item => item.productId === filters.productId)) {
      return false;
    }

    return true;
  });

  // Paginated data
  const paginatedSales = filteredSales.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Calculate statistics
  const calculateStats = () => {
    const totalSales = filteredSales.length;
    const totalAmount = filteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const paidAmount = filteredSales
      .filter(sale => sale.paymentStatus === 'paid')
      .reduce((sum, sale) => sum + sale.totalAmount, 0);
    const pendingAmount = filteredSales
      .filter(sale => sale.paymentStatus === 'pending' || sale.paymentStatus === 'partial')
      .reduce((sum, sale) => sum + sale.totalAmount, 0);
    
    const averageOrderValue = totalSales > 0 ? totalAmount / totalSales : 0;
    
    return {
      totalSales,
      totalAmount,
      paidAmount,
      pendingAmount,
      averageOrderValue,
      paymentRate: totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0,
    };
  };

  const stats = calculateStats();

  // Get status chip
  const getStatusChip = (status: string) => {
    const statusConfig: Record<string, { color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning', label: string, icon: React.ReactNode }> = {
      draft: { color: 'default', label: 'Draft', icon: null },
      confirmed: { color: 'info', label: 'Confirmed', icon: <CheckCircleIcon fontSize="small" /> },
      invoiced: { color: 'primary', label: 'Invoiced', icon: <ReceiptIcon fontSize="small" /> },
      paid: { color: 'success', label: 'Paid', icon: <PaidIcon fontSize="small" /> },
      cancelled: { color: 'error', label: 'Cancelled', icon: <CancelIcon fontSize="small" /> },
    };

    const config = statusConfig[status] || { color: 'default' as const, label: status, icon: null };
    return (
      <Chip
        size="small"
        label={config.label}
        color={config.color}
        icon={config.icon}
        variant="outlined"
      />
    );
  };

  // Get payment status chip
  const getPaymentStatusChip = (status: string) => {
    const paymentConfig: Record<string, { color: 'default' | 'warning' | 'success' | 'error', label: string, icon: React.ReactNode }> = {
      pending: { color: 'warning', label: 'Pending', icon: <PendingIcon fontSize="small" /> },
      partial: { color: 'info', label: 'Partial', icon: <PaidIcon fontSize="small" /> },
      paid: { color: 'success', label: 'Paid', icon: <CheckCircleIcon fontSize="small" /> },
      overdue: { color: 'error', label: 'Overdue', icon: <CancelIcon fontSize="small" /> },
    };

    const config = paymentConfig[status] || { color: 'default' as const, label: status, icon: null };
    return (
      <Chip
        size="small"
        label={config.label}
        color={config.color}
        icon={config.icon}
      />
    );
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `${amount.toFixed(2)} MAD`;
  };

  // Handle view order details
  const handleViewOrder = (order: SaleOrder) => {
    setSelectedOrder(order);
    setDetailDialogOpen(true);
  };

  // Handle export
  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    onExport?.(format);
    setExportDialogOpen(false);
  };

  const handleFilterChange = (newFilters: Partial<PurchaseFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilterChange?.(updatedFilters);
  };

  // Get payment method icon
  const getPaymentMethodIcon = (method?: string) => {
    switch (method) {
      case 'cash': return <PaidIcon fontSize="small" />;
      case 'card': return <CreditCardIcon fontSize="small" />;
      case 'check': return <ReceiptIcon fontSize="small" />;
      case 'transfer': return <ArrowUpwardIcon fontSize="small" />;
      default: return null;
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" component="h1" gutterBottom>
            Purchase History
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {customerName} • ID: {customerId}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {onRefresh && (
            <Tooltip title="Refresh">
              <IconButton onClick={onRefresh} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
          {onExport && (
            <Tooltip title="Export">
              <IconButton onClick={() => setExportDialogOpen(true)}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary" fontWeight="bold">
                {stats.totalSales}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Orders
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main" fontWeight="bold">
                {formatCurrency(stats.totalAmount)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Value
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main" fontWeight="bold">
                {formatCurrency(stats.averageOrderValue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avg. Order Value
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main" fontWeight="bold">
                {formatCurrency(stats.pendingAmount)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pending Payment
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <Typography variant="h4" color={stats.paymentRate >= 80 ? 'success.main' : 'warning.main'} fontWeight="bold">
                  {stats.paymentRate.toFixed(1)}%
                </Typography>
                {stats.paymentRate >= 80 ? (
                  <ArrowUpwardIcon color="success" />
                ) : (
                  <ArrowDownwardIcon color="warning" />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                Payment Rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Payment Progress */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Payment Collection Progress
          </Typography>
          <Typography variant="body2" fontWeight="medium">
            {stats.paymentRate.toFixed(1)}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={stats.paymentRate}
          color={stats.paymentRate >= 80 ? 'success' : stats.paymentRate >= 50 ? 'warning' : 'error'}
          sx={{ height: 8, borderRadius: 4 }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Paid: {formatCurrency(stats.paidAmount)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Pending: {formatCurrency(stats.pendingAmount)}
          </Typography>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            size="small"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.status || ''}
              label="Status"
              onChange={(e) => handleFilterChange({ status: e.target.value as any || undefined })}
            >
              <MenuItem value="">All Status</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="confirmed">Confirmed</MenuItem>
              <MenuItem value="invoiced">Invoiced</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Payment</InputLabel>
            <Select
              value={filters.paymentStatus || ''}
              label="Payment"
              onChange={(e) => handleFilterChange({ paymentStatus: e.target.value as any || undefined })}
            >
              <MenuItem value="">All Payment</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="partial">Partial</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="overdue">Overdue</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {/* Orders Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : filteredSales.length === 0 ? (
        <Alert severity="info">
          No purchase history found for this customer.
        </Alert>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Order Date</TableCell>
                  <TableCell>Order #</TableCell>
                  <TableCell>Items</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Payment</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedSales.map((sale) => (
                  <TableRow
                    key={sale.id}
                    hover
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                  >
                    <TableCell>
                      {new Date(sale.orderDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium" fontFamily="monospace">
                        {sale.orderNumber}
                      </Typography>
                      {sale.reference && (
                        <Typography variant="caption" color="text.secondary">
                          Ref: {sale.reference}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <InventoryIcon fontSize="small" sx={{ color: 'action.active' }} />
                        <Typography variant="body2">
                          {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
                      {sale.items[0] && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          {sale.items[0].productName}
                          {sale.items.length > 1 && ` +${sale.items.length - 1} more`}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="bold">
                        {formatCurrency(sale.totalAmount)}
                      </Typography>
                      {sale.discount > 0 && (
                        <Typography variant="caption" color="success.main">
                          -{sale.discount}% discount
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusChip(sale.status)}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {getPaymentStatusChip(sale.paymentStatus)}
                        {sale.paymentMethod && (
                          <Tooltip title={sale.paymentMethod}>
                            <span>
                              {getPaymentMethodIcon(sale.paymentMethod)}
                            </span>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleViewOrder(sale)}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {onPrintDocument && (
                          <Tooltip title="Print Documents">
                            <IconButton
                              size="small"
                              onClick={() => {
                                // In real app, this would open a menu with document options
                                onPrintDocument(sale.id, 'invoice');
                              }}
                            >
                              <PrintIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={filteredSales.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </>
      )}

      {/* Empty State */}
      {!loading && sales.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <ReceiptIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Purchase History
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This customer hasn't made any purchases yet.
          </Typography>
        </Box>
      )}

      {/* Order Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedOrder && (
          <>
            <DialogTitle>
              Order Details: {selectedOrder.orderNumber}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Order Information
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Date:</Typography>
                      <Typography variant="body2">
                        {new Date(selectedOrder.orderDate).toLocaleDateString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Status:</Typography>
                      <Typography variant="body2">
                        {getStatusChip(selectedOrder.status)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Payment:</Typography>
                      <Typography variant="body2">
                        {getPaymentStatusChip(selectedOrder.paymentStatus)}
                      </Typography>
                    </Box>
                    {selectedOrder.reference && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Reference:</Typography>
                        <Typography variant="body2">
                          {selectedOrder.reference}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Payment Information
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Total Amount:</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {formatCurrency(selectedOrder.totalAmount)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Payment Method:</Typography>
                      <Typography variant="body2">
                        {selectedOrder.paymentMethod || 'Not specified'}
                      </Typography>
                    </Box>
                    {selectedOrder.discount > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" color="text.secondary">Discount:</Typography>
                        <Typography variant="body2" color="success.main">
                          {selectedOrder.discount}%
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    Order Items
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Product</TableCell>
                          <TableCell align="right">Price</TableCell>
                          <TableCell align="center">Quantity</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedOrder.items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Typography variant="body2">
                                {item.productName}
                              </Typography>
                              {item.productCode && (
                                <Typography variant="caption" color="text.secondary">
                                  Code: {item.productCode}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(item.unitPrice)}
                            </TableCell>
                            <TableCell align="center">
                              {item.quantity}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight="medium">
                                {formatCurrency(item.quantity * item.unitPrice)}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
                {selectedOrder.notes && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Notes
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="body2">
                        {selectedOrder.notes}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDetailDialogOpen(false)}>
                Close
              </Button>
              {onViewOrder && (
                <Button
                  variant="contained"
                  onClick={() => {
                    setDetailDialogOpen(false);
                    onViewOrder(selectedOrder.id);
                  }}
                >
                  View Full Order
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>Export Purchase History</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            Select format to export purchase history for {customerName}:
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ReceiptIcon />}
                onClick={() => handleExport('pdf')}
                sx={{ justifyContent: 'flex-start' }}
              >
                Export as PDF
              </Button>
            </Grid>
            <Grid item xs={12}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => handleExport('excel')}
                sx={{ justifyContent: 'flex-start' }}
              >
                Export as Excel
              </Button>
            </Grid>
            <Grid item xs={12}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => handleExport('csv')}
                sx={{ justifyContent: 'flex-start' }}
              >
                Export as CSV
              </Button>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Import missing components
import { CreditCard as CreditCardIcon } from '@mui/icons-material';

export default PurchaseHistory; 
