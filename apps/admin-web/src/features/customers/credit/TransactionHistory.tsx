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
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Refresh as RefreshIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { Transaction } from '@bms/core';

interface TransactionHistoryProps {
  customerId: string;
  customerName: string;
  transactions: Transaction[];
  loading?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  onViewDetails?: (transactionId: string) => void;
  onFilterChange?: (filters: TransactionFilters) => void;
}

interface TransactionFilters {
  type?: 'payment' | 'invoice' | 'adjustment' | 'refund';
  status?: 'completed' | 'pending' | 'failed' | 'cancelled';
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  customerId,
  customerName,
  transactions = [],
  loading = false,
  onRefresh,
  onExport,
  onViewDetails,
  onFilterChange,
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<TransactionFilters>({});

  // Handle pagination
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Apply filters and search
  const filteredTransactions = transactions.filter((transaction) => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        transaction.id.toLowerCase().includes(searchLower) ||
        transaction.reference?.toLowerCase().includes(searchLower) ||
        transaction.description?.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;
    }

    // Type filter
    if (filters.type && transaction.type !== filters.type) return false;

    // Status filter
    if (filters.status && transaction.status !== filters.status) return false;

    // Amount filters
    if (filters.minAmount && Math.abs(transaction.amount) < filters.minAmount) return false;
    if (filters.maxAmount && Math.abs(transaction.amount) > filters.maxAmount) return false;

    // Date filters
    if (filters.startDate && new Date(transaction.date) < filters.startDate) return false;
    if (filters.endDate && new Date(transaction.date) > filters.endDate) return false;

    return true;
  });

  // Paginated data
  const paginatedTransactions = filteredTransactions.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Get transaction type chip
  const getTypeChip = (type: string) => {
    const typeConfig: Record<string, { color: 'success' | 'error' | 'warning' | 'info', label: string, icon: React.ReactNode }> = {
      payment: { color: 'success', label: 'Payment', icon: <PaymentIcon fontSize="small" /> },
      invoice: { color: 'error', label: 'Invoice', icon: <ReceiptIcon fontSize="small" /> },
      adjustment: { color: 'warning', label: 'Adjustment', icon: <ArrowUpwardIcon fontSize="small" /> },
      refund: { color: 'info', label: 'Refund', icon: <ArrowDownwardIcon fontSize="small" /> },
    };

    const config = typeConfig[type] || { color: 'default' as const, label: type, icon: null };
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

  // Get status chip
  const getStatusChip = (status: string) => {
    const statusConfig: Record<string, { color: 'success' | 'warning' | 'error' | 'default', label: string }> = {
      completed: { color: 'success', label: 'Completed' },
      pending: { color: 'warning', label: 'Pending' },
      failed: { color: 'error', label: 'Failed' },
      cancelled: { color: 'default', label: 'Cancelled' },
    };

    const config = statusConfig[status] || { color: 'default' as const, label: status };
    return (
      <Chip
        size="small"
        label={config.label}
        color={config.color}
      />
    );
  };

  // Format amount with sign
  const formatAmount = (amount: number) => {
    const sign = amount >= 0 ? '+' : '';
    return `${sign}${Math.abs(amount).toFixed(2)} MAD`;
  };

  // Get amount color
  const getAmountColor = (amount: number) => {
    return amount >= 0 ? 'success.main' : 'error.main';
  };

  const handleFilterChange = (newFilters: Partial<TransactionFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilterChange?.(updatedFilters);
  };

  // Calculate totals
  const totalAmount = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalPayments = filteredTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalInvoices = filteredTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <Card sx={{ width: '100%' }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h6" component="div" gutterBottom>
              Transaction History
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
                <IconButton onClick={onExport}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Summary Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={4}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Net Change
              </Typography>
              <Typography variant="h6" color={getAmountColor(totalAmount)} fontWeight="bold">
                {formatAmount(totalAmount)}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} md={4}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Total Payments
              </Typography>
              <Typography variant="h6" color="success.main" fontWeight="bold">
                +{totalPayments.toFixed(2)} MAD
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6} md={4}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Total Invoices
              </Typography>
              <Typography variant="h6" color="error.main" fontWeight="bold">
                -{totalInvoices.toFixed(2)} MAD
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* Search and Filters */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search transactions..."
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
              <InputLabel>Type</InputLabel>
              <Select
                value={filters.type || ''}
                label="Type"
                onChange={(e) => handleFilterChange({ type: e.target.value as any || undefined })}
              >
                <MenuItem value="">All Types</MenuItem>
                <MenuItem value="payment">Payment</MenuItem>
                <MenuItem value="invoice">Invoice</MenuItem>
                <MenuItem value="adjustment">Adjustment</MenuItem>
                <MenuItem value="refund">Refund</MenuItem>
              </Select>
            </FormControl>
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
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Transaction Table */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredTransactions.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No transactions found for this customer.
          </Alert>
        ) : (
          <>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Balance After</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedTransactions.map((transaction) => (
                    <TableRow
                      key={transaction.id}
                      hover
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell>
                        {new Date(transaction.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {getTypeChip(transaction.type)}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {transaction.reference || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {transaction.description || 'No description'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          color={getAmountColor(transaction.amount)}
                        >
                          {formatAmount(transaction.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {getStatusChip(transaction.status)}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {transaction.balanceAfter.toFixed(2)} MAD
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {onViewDetails && (
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => onViewDetails(transaction.id)}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
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
              count={filteredTransactions.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </>
        )}

        {/* Empty State */}
        {!loading && transactions.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <ReceiptIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Transactions Yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This customer hasn't made any transactions yet.
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionHistory; 
