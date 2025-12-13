import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  Avatar,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  AccountBalance as BalanceIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  AttachMoney as MoneyIcon,
  CreditCard as CreditCardIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  CalendarMonth as CalendarIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { Customer, CustomerBalance, CreditLimit } from '@bms/core';

interface CustomerBalanceDashboardProps {
  customers: Array<Customer & { 
    balance: CustomerBalance; 
    creditLimit?: CreditLimit;
    lastTransactionDate?: Date;
  }>;
  loading?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  onViewCustomer?: (customerId: string) => void;
  onViewTransactions?: (customerId: string) => void;
  onSetCreditLimit?: (customerId: string) => void;
  onFilterChange?: (filters: DashboardFilters) => void;
}

interface DashboardFilters {
  balanceRange?: 'all' | 'positive' | 'negative' | 'over_limit' | 'near_limit';
  creditStatus?: 'good' | 'warning' | 'over_limit' | 'no_limit';
  minBalance?: number;
  maxBalance?: number;
  searchTerm?: string;
}

const CustomerBalanceDashboard: React.FC<CustomerBalanceDashboardProps> = ({
  customers = [],
  loading = false,
  onRefresh,
  onExport,
  onViewCustomer,
  onViewTransactions,
  onSetCreditLimit,
  onFilterChange,
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [sortBy, setSortBy] = useState<'balance' | 'name' | 'creditUtilization'>('balance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Calculate dashboard statistics
  const calculateStats = () => {
    const totalCustomers = customers.length;
    const totalBalance = customers.reduce((sum, customer) => sum + customer.balance.currentBalance, 0);
    const totalCreditLimit = customers.reduce((sum, customer) => sum + (customer.creditLimit?.creditLimit || 0), 0);
    
    const positiveBalanceCustomers = customers.filter(c => c.balance.currentBalance >= 0).length;
    const negativeBalanceCustomers = customers.filter(c => c.balance.currentBalance < 0).length;
    
    const overLimitCustomers = customers.filter(c => {
      if (!c.creditLimit) return false;
      return c.balance.currentBalance > c.creditLimit.creditLimit;
    }).length;
    
    const nearLimitCustomers = customers.filter(c => {
      if (!c.creditLimit) return false;
      const utilization = (c.balance.currentBalance / c.creditLimit.creditLimit) * 100;
      return utilization >= 80 && utilization <= 100;
    }).length;
    
    const averageBalance = totalCustomers > 0 ? totalBalance / totalCustomers : 0;
    const creditUtilization = totalCreditLimit > 0 ? (totalBalance / totalCreditLimit) * 100 : 0;

    return {
      totalCustomers,
      totalBalance,
      totalCreditLimit,
      positiveBalanceCustomers,
      negativeBalanceCustomers,
      overLimitCustomers,
      nearLimitCustomers,
      averageBalance,
      creditUtilization,
    };
  };

  const stats = calculateStats();

  // Apply filters and sorting
  const filteredCustomers = customers.filter((customer) => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        customer.name.toLowerCase().includes(searchLower) ||
        customer.phone.toLowerCase().includes(searchLower) ||
        customer.email?.toLowerCase().includes(searchLower) ||
        customer.company?.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;
    }

    // Balance range filter
    if (filters.balanceRange) {
      switch (filters.balanceRange) {
        case 'positive':
          if (customer.balance.currentBalance < 0) return false;
          break;
        case 'negative':
          if (customer.balance.currentBalance >= 0) return false;
          break;
        case 'over_limit':
          if (!customer.creditLimit || customer.balance.currentBalance <= customer.creditLimit.creditLimit) return false;
          break;
        case 'near_limit':
          if (!customer.creditLimit) return false;
          const utilization = (customer.balance.currentBalance / customer.creditLimit.creditLimit) * 100;
          if (utilization < 80 || utilization > 100) return false;
          break;
      }
    }

    // Balance amount filters
    if (filters.minBalance !== undefined && customer.balance.currentBalance < filters.minBalance) return false;
    if (filters.maxBalance !== undefined && customer.balance.currentBalance > filters.maxBalance) return false;

    return true;
  });

  // Sort customers
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    let aValue = 0;
    let bValue = 0;

    switch (sortBy) {
      case 'balance':
        aValue = a.balance.currentBalance;
        bValue = b.balance.currentBalance;
        break;
      case 'name':
        aValue = a.name.localeCompare(b.name);
        bValue = b.name.localeCompare(a.name);
        break;
      case 'creditUtilization':
        const aUtilization = a.creditLimit ? (a.balance.currentBalance / a.creditLimit.creditLimit) * 100 : 0;
        const bUtilization = b.creditLimit ? (b.balance.currentBalance / b.creditLimit.creditLimit) * 100 : 0;
        aValue = aUtilization;
        bValue = bUtilization;
        break;
    }

    if (sortBy === 'name') {
      return sortOrder === 'asc' ? aValue : -aValue;
    }

    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
  });

  // Pagination
  const paginatedCustomers = sortedCustomers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Handle pagination
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Get customer status
  const getCustomerStatus = (customer: typeof customers[0]) => {
    if (!customer.creditLimit) {
      return { color: 'info' as const, text: 'No Limit', icon: <CreditCardIcon fontSize="small" /> };
    }
    
    const utilization = (customer.balance.currentBalance / customer.creditLimit.creditLimit) * 100;
    
    if (customer.balance.currentBalance > customer.creditLimit.creditLimit) {
      return { color: 'error' as const, text: 'Over Limit', icon: <WarningIcon fontSize="small" /> };
    } else if (utilization >= 80) {
      return { color: 'warning' as const, text: 'Near Limit', icon: <WarningIcon fontSize="small" /> };
    } else {
      return { color: 'success' as const, text: 'Within Limit', icon: <CheckCircleIcon fontSize="small" /> };
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return `${amount >= 0 ? '+' : ''}${amount.toFixed(2)} MAD`;
  };

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<DashboardFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilterChange?.(updatedFilters);
  };

  // Calculate available credit
  const getAvailableCredit = (customer: typeof customers[0]) => {
    if (!customer.creditLimit) return null;
    return customer.creditLimit.creditLimit - customer.balance.currentBalance;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" component="h1" gutterBottom>
            Customer Balance Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Overview of customer balances and credit utilization
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newMode) => newMode && setViewMode(newMode)}
            size="small"
          >
            <ToggleButton value="cards">
              Cards
            </ToggleButton>
            <ToggleButton value="table">
              Table
            </ToggleButton>
          </ToggleButtonGroup>
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

      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary" fontWeight="bold">
                {stats.totalCustomers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Customers
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color={stats.totalBalance >= 0 ? 'success.main' : 'error.main'} fontWeight="bold">
                {formatCurrency(stats.totalBalance)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Balance
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main" fontWeight="bold">
                {stats.overLimitCustomers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Over Limit
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main" fontWeight="bold">
                {stats.nearLimitCustomers}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Near Limit
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                <Typography variant="h4" color={stats.creditUtilization <= 50 ? 'success.main' : 'warning.main'} fontWeight="bold">
                  {stats.creditUtilization.toFixed(1)}%
                </Typography>
                {stats.creditUtilization <= 50 ? (
                  <ArrowDownwardIcon color="success" />
                ) : (
                  <ArrowUpwardIcon color="warning" />
                )}
              </Box>
              <Typography variant="body2" color="text.secondary">
                Credit Utilization
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Credit Utilization Overview */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Overall Credit Utilization
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ flexGrow: 1 }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(stats.creditUtilization, 100)}
                color={stats.creditUtilization >= 100 ? 'error' : stats.creditUtilization >= 80 ? 'warning' : 'success'}
                sx={{ height: 10, borderRadius: 5 }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  0%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  50%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  80% Warning
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  100%
                </Typography>
              </Box>
            </Box>
            <Box sx={{ textAlign: 'right', minWidth: 100 }}>
              <Typography variant="h6" color={stats.creditUtilization >= 100 ? 'error.main' : stats.creditUtilization >= 80 ? 'warning.main' : 'success.main'}>
                {stats.creditUtilization.toFixed(1)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                of {formatCurrency(stats.totalCreditLimit)}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            placeholder="Search customers..."
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
        <Grid item xs={12} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Balance Range</InputLabel>
            <Select
              value={filters.balanceRange || ''}
              label="Balance Range"
              onChange={(e) => handleFilterChange({ balanceRange: e.target.value as any || undefined })}
            >
              <MenuItem value="">All Balances</MenuItem>
              <MenuItem value="positive">Positive Balance</MenuItem>
              <MenuItem value="negative">Negative Balance</MenuItem>
              <MenuItem value="over_limit">Over Credit Limit</MenuItem>
              <MenuItem value="near_limit">Near Credit Limit</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              size="small"
              onClick={() => {
                // In real app, this would open advanced filters
                handleFilterChange({});
              }}
              sx={{ flexGrow: 1 }}
            >
              Filters
            </Button>
            <Tooltip title="Sort by">
              <IconButton
                size="small"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        </Grid>
      </Grid>

      {/* Cards View */}
      {viewMode === 'cards' && (
        <Grid container spacing={2}>
          {loading ? (
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            </Grid>
          ) : paginatedCustomers.length === 0 ? (
            <Grid item xs={12}>
              <Alert severity="info">
                No customers found matching the current filters.
              </Alert>
            </Grid>
          ) : (
            paginatedCustomers.map((customer) => {
              const status = getCustomerStatus(customer);
              const availableCredit = getAvailableCredit(customer);
              const utilization = customer.creditLimit 
                ? (customer.balance.currentBalance / customer.creditLimit.creditLimit) * 100 
                : 0;

              return (
                <Grid item xs={12} sm={6} md={4} key={customer.id}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      {/* Customer Header */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                            <PersonIcon fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2" fontWeight="medium">
                              {customer.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {customer.phone}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip
                          size="small"
                          label={status.text}
                          color={status.color}
                          icon={status.icon}
                        />
                      </Box>

                      {/* Balance Information */}
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="h5" fontWeight="bold" color={customer.balance.currentBalance >= 0 ? 'success.main' : 'error.main'}>
                          {formatCurrency(customer.balance.currentBalance)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Current Balance
                        </Typography>
                      </Box>

                      {/* Credit Limit Information */}
                      {customer.creditLimit && (
                        <Box sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              Credit Limit:
                            </Typography>
                            <Typography variant="caption" fontWeight="medium">
                              {customer.creditLimit.creditLimit.toFixed(2)} MAD
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              Available:
                            </Typography>
                            <Typography variant="caption" fontWeight="medium" color={availableCredit && availableCredit >= 0 ? 'success.main' : 'error.main'}>
                              {availableCredit?.toFixed(2)} MAD
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              Utilization:
                            </Typography>
                            <Typography variant="caption" fontWeight="medium" color={utilization >= 80 ? 'error.main' : 'success.main'}>
                              {utilization.toFixed(1)}%
                            </Typography>
                          </Box>
                        </Box>
                      )}

                      {/* Utilization Progress */}
                      {customer.creditLimit && (
                        <Box sx={{ mb: 2 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(utilization, 100)}
                            color={utilization >= 100 ? 'error' : utilization >= 80 ? 'warning' : 'success'}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </Box>
                      )}

                      {/* Action Buttons */}
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {onViewCustomer && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => onViewCustomer(customer.id)}
                            sx={{ flexGrow: 1 }}
                          >
                            View
                          </Button>
                        )}
                        {onViewTransactions && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => onViewTransactions(customer.id)}
                          >
                            <HistoryIcon fontSize="small" />
                          </Button>
                        )}
                        {onSetCreditLimit && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => onSetCreditLimit(customer.id)}
                          >
                            <CreditCardIcon fontSize="small" />
                          </Button>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })
          )}
        </Grid>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Customer</TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell align="right">Credit Limit</TableCell>
                  <TableCell align="right">Available</TableCell>
                  <TableCell align="center">Utilization</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={24} />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Loading customer data...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : paginatedCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        No customers found matching the current filters
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCustomers.map((customer) => {
                    const status = getCustomerStatus(customer);
                    const availableCredit = getAvailableCredit(customer);
                    const utilization = customer.creditLimit 
                      ? (customer.balance.currentBalance / customer.creditLimit.creditLimit) * 100 
                      : 0;

                    return (
                      <TableRow key={customer.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                              <PersonIcon fontSize="small" />
                            </Avatar>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {customer.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {customer.phone}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold" color={customer.balance.currentBalance >= 0 ? 'success.main' : 'error.main'}>
                            {formatCurrency(customer.balance.currentBalance)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {customer.creditLimit ? customer.creditLimit.creditLimit.toFixed(2) + ' MAD' : 'No limit'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color={availableCredit && availableCredit >= 0 ? 'success.main' : 'error.main'}>
                            {availableCredit ? availableCredit.toFixed(2) + ' MAD' : 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ flexGrow: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(utilization, 100)}
                                color={utilization >= 100 ? 'error' : utilization >= 80 ? 'warning' : 'success'}
                                sx={{ height: 6, borderRadius: 3 }}
                              />
                            </Box>
                            <Typography variant="caption" sx={{ minWidth: 40 }}>
                              {utilization.toFixed(1)}%
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={status.text}
                            color={status.color}
                            icon={status.icon}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                            {onViewCustomer && (
                              <Tooltip title="View Customer">
                                <IconButton
                                  size="small"
                                  onClick={() => onViewCustomer(customer.id)}
                                >
                                  <PersonIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {onViewTransactions && (
                              <Tooltip title="View Transactions">
                                <IconButton
                                  size="small"
                                  onClick={() => onViewTransactions(customer.id)}
                                >
                                  <HistoryIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={sortedCustomers.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </>
      )}

      {/* Alerts */}
      {stats.overLimitCustomers > 0 && (
        <Alert severity="error" sx={{ mt: 3 }}>
          <strong>Alert:</strong> {stats.overLimitCustomers} customer(s) have exceeded their credit limits.
          Consider reviewing their credit limits or contacting them for payment.
        </Alert>
      )}

      {stats.nearLimitCustomers > 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <strong>Note:</strong> {stats.nearLimitCustomers} customer(s) are near their credit limits (≥80% utilization).
        </Alert>
      )}
    </Box>
  );
};

export default CustomerBalanceDashboard; 
