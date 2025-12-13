/**
 * Stock Movement List Component
 * Displays audit trail of all stock movements
 * 
 * BUSINESS RULES:
 * - Complete audit trail of all stock changes
 * - Filter by movement type, date range, product
 * - Export movement history for reporting
 * - Link movements to related documents
 * 
 * DESIGN RULES:
 * - Material-UI components
 * - Advanced filtering system
 * - Export functionality
 * - Odoo-inspired table design
 * - TypeScript strict mode
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  InputAdornment,
  Divider,
  Alert,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Inventory as InventoryIcon,
  Receipt as ReceiptIcon,
  ShoppingCart as CartIcon,
  SwapHoriz as TransferIcon,
  Block as BlockIcon,
  DateRange as DateIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';

// Mock data for development
const mockMovements = [
  { id: '1', date: '2024-01-15', productName: 'Laptop Dell XPS 15', sku: 'PROD-001', type: 'PURCHASE_RECEIPT', quantity: 10, reference: 'PO-2024-001', user: 'Admin User', location: 'Main Warehouse', cost: 15000, total: 150000 },
  { id: '2', date: '2024-01-14', productName: 'iPhone 15 Pro', sku: 'PROD-002', type: 'SALE_DELIVERY', quantity: -2, reference: 'SO-2024-015', user: 'Sales User', location: 'Main Warehouse', cost: 12000, total: 24000 },
  { id: '3', date: '2024-01-13', productName: 'Office Chair', sku: 'PROD-003', type: 'STOCK_ADJUSTMENT', quantity: 5, reference: 'ADJ-2024-003', user: 'Admin User', location: 'Main Warehouse', cost: 2500, total: 12500 },
  { id: '4', date: '2024-01-12', productName: 'Wireless Mouse', sku: 'PROD-004', type: 'SALE_DELIVERY', quantity: -5, reference: 'SO-2024-012', user: 'Sales User', location: 'Main Warehouse', cost: 500, total: 2500 },
  { id: '5', date: '2024-01-11', productName: 'Monitor 27" 4K', sku: 'PROD-005', type: 'PURCHASE_RECEIPT', quantity: 3, reference: 'PO-2024-002', user: 'Admin User', location: 'Main Warehouse', cost: 8000, total: 24000 },
  { id: '6', date: '2024-01-10', productName: 'Laptop Dell XPS 15', sku: 'PROD-001', type: 'STOCK_TRANSFER', quantity: -2, reference: 'TRF-2024-001', user: 'Warehouse User', location: 'Main → Branch', cost: 15000, total: 30000 },
  { id: '7', date: '2024-01-09', productName: 'iPhone 15 Pro', sku: 'PROD-002', type: 'RETURN_CUSTOMER', quantity: 1, reference: 'RTN-2024-001', user: 'Sales User', location: 'Main Warehouse', cost: 12000, total: 12000 },
  { id: '8', date: '2024-01-08', productName: 'Office Chair', sku: 'PROD-003', type: 'DAMAGE_WRITE_OFF', quantity: -1, reference: 'DAM-2024-001', user: 'Admin User', location: 'Main Warehouse', cost: 2500, total: 2500 },
];

const movementTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'PURCHASE_RECEIPT', label: 'Purchase Receipt', icon: <ReceiptIcon />, color: 'success' },
  { value: 'SALE_DELIVERY', label: 'Sale Delivery', icon: <CartIcon />, color: 'error' },
  { value: 'STOCK_ADJUSTMENT', label: 'Stock Adjustment', icon: <InventoryIcon />, color: 'warning' },
  { value: 'STOCK_TRANSFER', label: 'Stock Transfer', icon: <TransferIcon />, color: 'info' },
  { value: 'RETURN_CUSTOMER', label: 'Customer Return', icon: <ArrowUpIcon />, color: 'success' },
  { value: 'RETURN_SUPPLIER', label: 'Supplier Return', icon: <ArrowDownIcon />, color: 'warning' },
  { value: 'DAMAGE_WRITE_OFF', label: 'Damage Write-off', icon: <BlockIcon />, color: 'error' },
];

const StockMovementList: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  
  const [movements, setMovements] = useState(mockMovements);
  const [filteredMovements, setFilteredMovements] = useState(mockMovements);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [quantityFilter, setQuantityFilter] = useState<'all' | 'in' | 'out'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportDateRange, setExportDateRange] = useState<'all' | 'filtered' | 'custom'>('filtered');

  // Unique products for filter
  const products = Array.from(new Set(movements.map(m => m.productName)));

  // Handle pagination
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Apply filters
  useEffect(() => {
    let filtered = movements;

    // Search term filter
    if (searchTerm) {
      filtered = filtered.filter(movement =>
        movement.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.user.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Movement type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(movement => movement.type === selectedType);
    }

    // Product filter
    if (selectedProduct) {
      filtered = filtered.filter(movement => movement.productName === selectedProduct);
    }

    // Date range filter
    if (dateRange[0]) {
      filtered = filtered.filter(movement => new Date(movement.date) >= dateRange[0]!);
    }
    if (dateRange[1]) {
      const endDate = new Date(dateRange[1]);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(movement => new Date(movement.date) <= endDate);
    }

    // Quantity filter
    if (quantityFilter === 'in') {
      filtered = filtered.filter(movement => movement.quantity > 0);
    } else if (quantityFilter === 'out') {
      filtered = filtered.filter(movement => movement.quantity < 0);
    }

    setFilteredMovements(filtered);
    setPage(0); // Reset to first page when filters change
  }, [movements, searchTerm, selectedType, selectedProduct, dateRange, quantityFilter]);

  // Get movement type info
  const getMovementTypeInfo = (type: string) => {
    const info = movementTypes.find(t => t.value === type);
    return info || { label: type, icon: <InventoryIcon />, color: 'default' };
  };

  // Format quantity display
  const formatQuantity = (quantity: number) => {
    const isPositive = quantity > 0;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {isPositive ? (
          <ArrowUpIcon color="success" fontSize="small" sx={{ mr: 0.5 }} />
        ) : (
          <ArrowDownIcon color="error" fontSize="small" sx={{ mr: 0.5 }} />
        )}
        <Typography
          sx={{
            color: isPositive ? 'success.main' : 'error.main',
            fontWeight: 'medium'
          }}
        >
          {isPositive ? `+${quantity}` : quantity}
        </Typography>
      </Box>
    );
  };

  // Handle export
  const handleExport = () => {
    // In real app, this would generate and download file
    alert(`Exporting ${filteredMovements.length} movements as ${exportFormat.toUpperCase()}`);
    setExportDialogOpen(false);
  };

  // Calculate summary statistics
  const totalIn = filteredMovements
    .filter(m => m.quantity > 0)
    .reduce((sum, m) => sum + m.quantity, 0);
  
  const totalOut = filteredMovements
    .filter(m => m.quantity < 0)
    .reduce((sum, m) => sum + Math.abs(m.quantity), 0);
  
  const totalValue = filteredMovements
    .reduce((sum, m) => sum + Math.abs(m.total), 0);

  // Paginate movements
  const paginatedMovements = filteredMovements.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Stock Movement History
        </Typography>
        <Typography color="textSecondary">
          Complete audit trail of all stock movements and adjustments
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ p: 2 }}>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              Total Movements
            </Typography>
            <Typography variant="h3">
              {filteredMovements.length}
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ p: 2 }}>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              Stock In
            </Typography>
            <Typography variant="h3" color="success.main">
              +{totalIn}
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ p: 2 }}>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              Stock Out
            </Typography>
            <Typography variant="h3" color="error.main">
              -{totalOut}
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ p: 2 }}>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              Total Value
            </Typography>
            <Typography variant="h3">
              {totalValue.toLocaleString()} MAD
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Action Bar */}
      <Card sx={{ mb: 3, p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search movements..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
              size="small"
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Movement Type</InputLabel>
              <Select
                value={selectedType}
                label="Movement Type"
                onChange={(e) => setSelectedType(e.target.value)}
              >
                {movementTypes.map(type => (
                  <MenuItem key={type.value} value={type.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box sx={{ mr: 1 }}>{type.icon}</Box>
                      {type.label}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <Autocomplete
              size="small"
              options={products}
              value={selectedProduct}
              onChange={(event, newValue) => setSelectedProduct(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Product"
                  placeholder="Select product"
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={4} sx={{ textAlign: 'right' }}>
            <Button
              size="small"
              startIcon={<FilterIcon />}
              onClick={() => setShowFilters(!showFilters)}
              sx={{ mr: 1 }}
            >
              {showFilters ? 'Hide Filters' : 'More Filters'}
            </Button>
            
            <Button
              size="small"
              startIcon={<DownloadIcon />}
              onClick={() => setExportDialogOpen(true)}
              sx={{ mr: 1 }}
            >
              Export
            </Button>
            
            <Button
              size="small"
              startIcon={<RefreshIcon />}
            >
              Refresh
            </Button>
          </Grid>
        </Grid>

        {/* Advanced Filters */}
        {showFilters && (
          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="From Date"
                    value={dateRange[0]}
                    onChange={(newValue) => setDateRange([newValue, dateRange[1]])}
                    slots={{
                      textField: (params) => (
                        <TextField
                          {...params}
                          fullWidth
                          size="small"
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <InputAdornment position="start">
                                <DateIcon />
                              </InputAdornment>
                            )
                          }}
                        />
                      )
                    }}
                  />
                </LocalizationProvider>
              </Grid>

              <Grid item xs={12} md={4}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="To Date"
                    value={dateRange[1]}
                    onChange={(newValue) => setDateRange([dateRange[0], newValue])}
                    slots={{
                      textField: (params) => (
                        <TextField
                          {...params}
                          fullWidth
                          size="small"
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <InputAdornment position="start">
                                <DateIcon />
                              </InputAdornment>
                            )
                          }}
                        />
                      )
                    }}
                  />
                </LocalizationProvider>
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Quantity Type</InputLabel>
                  <Select
                    value={quantityFilter}
                    label="Quantity Type"
                    onChange={(e) => setQuantityFilter(e.target.value as any)}
                  >
                    <MenuItem value="all">All Movements</MenuItem>
                    <MenuItem value="in">Stock In Only</MenuItem>
                    <MenuItem value="out">Stock Out Only</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                size="small"
                onClick={() => {
                  setSelectedType('all');
                  setSelectedProduct(null);
                  setDateRange([null, null]);
                  setQuantityFilter('all');
                  setSearchTerm('');
                }}
              >
                Clear All Filters
              </Button>
            </Box>
          </Box>
        )}
      </Card>

      {/* Quick Type Filters */}
      <Box sx={{ mb: 2 }}>
        <ToggleButtonGroup
          value={selectedType}
          exclusive
          onChange={(e, newType) => newType && setSelectedType(newType)}
          aria-label="movement type"
          size="small"
        >
          <ToggleButton value="all" aria-label="all">
            All Types
          </ToggleButton>
          {movementTypes
            .filter(type => type.value !== 'all')
            .map(type => (
              <ToggleButton key={type.value} value={type.value} aria-label={type.label.toLowerCase()}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ mr: 0.5, display: 'flex' }}>{type.icon}</Box>
                  {type.label}
                </Box>
              </ToggleButton>
            ))}
        </ToggleButtonGroup>
      </Box>

      {/* Movements Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="center">Quantity</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Location</TableCell>
                <TableCell align="right">Total Value</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedMovements.map((movement) => {
                const typeInfo = getMovementTypeInfo(movement.type);
                
                return (
                  <TableRow 
                    key={movement.id}
                    hover
                    sx={{ '&:hover': { backgroundColor: 'action.hover' } }}
                  >
                    <TableCell>
                      <Typography variant="body2">
                        {movement.date}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {movement.productName}
                        </Typography>
                        <Typography variant="caption" color="textSecondary" fontFamily="monospace">
                          {movement.sku}
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Chip
                        icon={typeInfo.icon}
                        label={typeInfo.label}
                        color={typeInfo.color as any}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    
                    <TableCell align="center">
                      {formatQuantity(movement.quantity)}
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {movement.reference}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">
                        {movement.user}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">
                        {movement.location}
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="right">
                      <Typography variant="body1" fontWeight="medium">
                        {movement.total.toLocaleString()} MAD
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {movement.cost.toLocaleString()} MAD/unit
                      </Typography>
                    </TableCell>
                    
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <IconButton size="small">
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      
                      {hasPermission(['admin', 'manager']) && (
                        <Tooltip title="Reverse Movement">
                          <IconButton size="small" color="warning">
                            <SwapHoriz fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={filteredMovements.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Card>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Export Stock Movements</DialogTitle>
        
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Export Format</InputLabel>
              <Select
                value={exportFormat}
                label="Export Format"
                onChange={(e) => setExportFormat(e.target.value)}
              >
                <MenuItem value="csv">CSV (Excel compatible)</MenuItem>
                <MenuItem value="excel">Excel (.xlsx)</MenuItem>
                <MenuItem value="pdf">PDF Report</MenuItem>
                <MenuItem value="json">JSON (API format)</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Date Range</InputLabel>
              <Select
                value={exportDateRange}
                label="Date Range"
                onChange={(e) => setExportDateRange(e.target.value)}
              >
                <MenuItem value="filtered">Current Filter Results ({filteredMovements.length} movements)</MenuItem>
                <MenuItem value="all">All Time ({movements.length} movements)</MenuItem>
                <MenuItem value="custom">Custom Date Range</MenuItem>
              </Select>
            </FormControl>
            
            <Alert severity="info">
              <Typography variant="body2">
                This will export <strong>{filteredMovements.length}</strong> movements
                {dateRange[0] && dateRange[1] && (
                  <> from <strong>{format(dateRange[0], 'dd/MM/yyyy')}</strong> to <strong>{format(dateRange[1], 'dd/MM/yyyy')}</strong></>
                )}
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleExport}
            startIcon={<DownloadIcon />}
          >
            Export
          </Button>
        </DialogActions>
      </Dialog>

      {/* No Results Message */}
      {filteredMovements.length === 0 && (
        <Card sx={{ p: 4, textAlign: 'center', mt: 2 }}>
          <InventoryIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Stock Movements Found
          </Typography>
          <Typography color="textSecondary" paragraph>
            Try adjusting your filters or search terms
          </Typography>
          <Button
            variant="outlined"
            onClick={() => {
              setSelectedType('all');
              setSelectedProduct(null);
              setDateRange([null, null]);
              setQuantityFilter('all');
              setSearchTerm('');
            }}
          >
            Clear All Filters
          </Button>
        </Card>
      )}
    </Box>
  );
};

export default StockMovementList; 
