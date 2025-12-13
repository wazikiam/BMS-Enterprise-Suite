// apps/admin-web/src/features/customers/CustomerList.tsx
import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Button,
  Box,
  Typography,
  Tooltip,
  Menu,
  MenuItem,
  Alert,
  CircularProgress,
  Grid,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { Customer, CustomerType, CustomerStatus } from '../../../../packages/core/src/domain/Customer';
import { useCustomers } from '../hooks/useCustomers';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { hasPermission } from '../../../utils/hasPermission';

interface CustomerListProps {
  onCustomerSelect?: (customer: Customer) => void;
  showActions?: boolean;
  compact?: boolean;
}

const CustomerList: React.FC<CustomerListProps> = ({
  onCustomerSelect,
  showActions = true,
  compact = false
}) => {
  const navigate = useNavigate();
  const {
    customers,
    loading,
    error,
    total,
    page,
    pageSize,
    filters,
    sortBy,
    sortOrder,
    fetchCustomers,
    updateFilters,
    updateSort,
    updatePagination,
    deleteCustomer
  } = useCustomers();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Columns configuration
  const columns = [
    { id: 'code', label: 'Code', sortable: true, width: 120 },
    { id: 'name', label: 'Name', sortable: true },
    { id: 'phone', label: 'Phone', sortable: false, width: 150 },
    { id: 'type', label: 'Type', sortable: true, width: 120 },
    { id: 'status', label: 'Status', sortable: true, width: 120 },
    { id: 'balance', label: 'Balance', sortable: true, width: 150 },
    { id: 'creditLimit', label: 'Credit Limit', sortable: true, width: 150 },
    { id: 'lastPurchase', label: 'Last Purchase', sortable: true, width: 150 },
    { id: 'createdAt', label: 'Created', sortable: true, width: 150 }
  ];

  // Initialize data
  useEffect(() => {
    fetchCustomers();
  }, [filters, sortBy, sortOrder, page, pageSize]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      updateFilters({ search: searchTerm });
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleSort = (columnId: string) => {
    const isAsc = sortBy === columnId && sortOrder === 'asc';
    updateSort(columnId, isAsc ? 'desc' : 'asc');
  };

  const handlePageChange = (event: unknown, newPage: number) => {
    updatePagination(newPage, pageSize);
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updatePagination(0, parseInt(event.target.value, 10));
  };

  const handleCustomerClick = (customer: Customer) => {
    if (onCustomerSelect) {
      onCustomerSelect(customer);
    } else {
      navigate(`/customers/${customer.id}`);
    }
  };

  const handleEdit = (customer: Customer, event: React.MouseEvent) => {
    event.stopPropagation();
    navigate(`/customers/${customer.id}/edit`);
  };

  const handleView = (customer: Customer, event: React.MouseEvent) => {
    event.stopPropagation();
    navigate(`/customers/${customer.id}`);
  };

  const handleActionMenuOpen = (customer: Customer, event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setSelectedCustomer(customer);
    setActionMenuAnchor(event.currentTarget);
  };

  const handleActionMenuClose = () => {
    setActionMenuAnchor(null);
    setSelectedCustomer(null);
  };

  const handleDelete = () => {
    if (selectedCustomer) {
      deleteCustomer(selectedCustomer.id);
      setDeleteConfirmOpen(false);
      handleActionMenuClose();
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      // Export logic here
      console.log('Exporting customers...');
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setExportLoading(false);
    }
  };

  const handleFilterChange = (filterType: string, value: any) => {
    updateFilters({ [filterType]: value });
  };

  const getStatusColor = (status: CustomerStatus) => {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'INACTIVE': return 'default';
      case 'BLOCKED': return 'error';
      default: return 'default';
    }
  };

  const getTypeIcon = (type: CustomerType) => {
    switch (type) {
      case 'COMPANY': return <BusinessIcon fontSize="small" />;
      case 'INDIVIDUAL': return <PersonIcon fontSize="small" />;
      case 'TEMPORARY': return <PersonIcon fontSize="small" />;
      default: return <PersonIcon fontSize="small" />;
    }
  };

  const canCreate = hasPermission('customers', 'create');
  const canEdit = hasPermission('customers', 'update');
  const canDelete = hasPermission('customers', 'delete');

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Error loading customers: {error.message}
        <Button onClick={() => fetchCustomers()} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Paper elevation={2} sx={{ width: '100%', overflow: 'hidden' }}>
      {/* Header with search and actions */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search customers by name, phone, or email..."
              value={searchTerm}
              onChange={handleSearch}
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
          
          <Grid item xs={12} md={6}>
            <Box display="flex" justifyContent="flex-end" gap={1}>
              {/* Filters */}
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={filters.type || ''}
                  label="Type"
                  onChange={(e: SelectChangeEvent) => handleFilterChange('type', e.target.value || undefined)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="INDIVIDUAL">Individual</MenuItem>
                  <MenuItem value="COMPANY">Company</MenuItem>
                  <MenuItem value="TEMPORARY">Temporary</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status || ''}
                  label="Status"
                  onChange={(e: SelectChangeEvent) => handleFilterChange('status', e.target.value || undefined)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="INACTIVE">Inactive</MenuItem>
                  <MenuItem value="BLOCKED">Blocked</MenuItem>
                </Select>
              </FormControl>

              <Tooltip title="Refresh">
                <IconButton onClick={() => fetchCustomers()}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>

              {canCreate && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/customers/new')}
                >
                  New Customer
                </Button>
              )}

              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExport}
                disabled={exportLoading}
              >
                {exportLoading ? <CircularProgress size={24} /> : 'Export'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Loading state */}
      {loading && customers.length === 0 ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Customer table */}
          <TableContainer sx={{ maxHeight: compact ? 400 : 600 }}>
            <Table stickyHeader size={compact ? 'small' : 'medium'}>
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      style={{ width: column.width }}
                      sortDirection={sortBy === column.id ? sortOrder : false}
                    >
                      {column.sortable ? (
                        <TableSortLabel
                          active={sortBy === column.id}
                          direction={sortBy === column.id ? sortOrder : 'asc'}
                          onClick={() => handleSort(column.id)}
                        >
                          {column.label}
                        </TableSortLabel>
                      ) : (
                        column.label
                      )}
                    </TableCell>
                  ))}
                  {showActions && <TableCell width={100}>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + (showActions ? 1 : 0)} align="center">
                      <Typography color="textSecondary" sx={{ py: 4 }}>
                        No customers found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      hover
                      onClick={() => handleCustomerClick(customer)}
                      sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {customer.code}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getTypeIcon(customer.type)}
                          <Typography variant="body2">
                            {customer.name}
                          </Typography>
                          {customer.companyName && (
                            <Tooltip title={customer.companyName}>
                              <BusinessIcon fontSize="small" color="action" />
                            </Tooltip>
                          )}
                        </Box>
                        {customer.email && (
                          <Box display="flex" alignItems="center" gap={0.5} color="text.secondary">
                            <EmailIcon fontSize="small" />
                            <Typography variant="caption">{customer.email}</Typography>
                          </Box>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <PhoneIcon fontSize="small" />
                          <Typography variant="body2">{customer.phone}</Typography>
                        </Box>
                      </TableCell>
                      
                      <TableCell>
                        <Chip
                          label={customer.type}
                          size="small"
                          variant="outlined"
                          icon={getTypeIcon(customer.type)}
                        />
                      </TableCell>
                      
                      <TableCell>
                        <Chip
                          label={customer.status}
                          size="small"
                          color={getStatusColor(customer.status) as any}
                        />
                      </TableCell>
                      
                      <TableCell>
                        <Typography
                          variant="body2"
                          color={customer.currentBalance > 0 ? 'error' : 'success'}
                          fontWeight="medium"
                        >
                          {formatCurrency(customer.currentBalance, 'MAD')}
                        </Typography>
                        {customer.currentBalance > 0 && customer.creditLimit && (
                          <Typography variant="caption" color="text.secondary">
                            {((customer.currentBalance / customer.creditLimit) * 100).toFixed(1)}% of limit
                          </Typography>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {customer.creditLimit ? formatCurrency(customer.creditLimit, 'MAD') : 'No limit'}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        {customer.lastPurchaseDate ? (
                          <Typography variant="body2">
                            {formatDate(customer.lastPurchaseDate)}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Never
                          </Typography>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(customer.createdAt)}
                        </Typography>
                      </TableCell>
                      
                      {showActions && (
                        <TableCell>
                          <Box display="flex" gap={0.5}>
                            <Tooltip title="View">
                              <IconButton
                                size="small"
                                onClick={(e) => handleView(customer, e)}
                              >
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            
                            {canEdit && (
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={(e) => handleEdit(customer, e)}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            
                            <IconButton
                              size="small"
                              onClick={(e) => handleActionMenuOpen(customer, e)}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={total}
            rowsPerPage={pageSize}
            page={page}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        </>
      )}

      {/* Action menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleActionMenuClose}
      >
        <MenuItem onClick={() => {
          if (selectedCustomer) {
            navigate(`/sales/new?customerId=${selectedCustomer.id}`);
          }
          handleActionMenuClose();
        }}>
          Create Sale
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedCustomer) {
            navigate(`/customers/${selectedCustomer.id}/balance`);
          }
          handleActionMenuClose();
        }}>
          View Balance
        </MenuItem>
        <MenuItem onClick={() => {
          if (selectedCustomer) {
            navigate(`/customers/${selectedCustomer.id}/transactions`);
          }
          handleActionMenuClose();
        }}>
          Transaction History
        </MenuItem>
        {canDelete && (
          <MenuItem
            onClick={() => {
              setDeleteConfirmOpen(true);
              handleActionMenuClose();
            }}
            sx={{ color: 'error.main' }}
          >
            Delete
          </MenuItem>
        )}
      </Menu>

      {/* Delete confirmation dialog */}
      {/* This would typically be a proper dialog component */}
      {deleteConfirmOpen && (
        <Box sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
          <Typography>
            Are you sure you want to delete customer {selectedCustomer?.name}?
          </Typography>
          <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              color="error"
              size="small"
              onClick={handleDelete}
            >
              Delete
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setDeleteConfirmOpen(false)}
              sx={{ color: 'error.contrastText', borderColor: 'error.contrastText' }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      )}

      {/* Summary stats */}
      {!compact && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">
                Total Customers
              </Typography>
              <Typography variant="h6">{total}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">
                Active
              </Typography>
              <Typography variant="h6" color="success.main">
                {customers.filter(c => c.status === 'ACTIVE').length}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">
                Total Balance
              </Typography>
              <Typography variant="h6">
                {formatCurrency(
                  customers.reduce((sum, c) => sum + c.currentBalance, 0),
                  'MAD'
                )}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary">
                Avg. Credit Limit
              </Typography>
              <Typography variant="h6">
                {formatCurrency(
                  customers.filter(c => c.creditLimit).reduce((sum, c) => sum + (c.creditLimit || 0), 0) /
                  Math.max(customers.filter(c => c.creditLimit).length, 1),
                  'MAD'
                )}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      )}
    </Paper>
  );
};

export default CustomerList;