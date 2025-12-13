import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Grid,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  Avatar,
} from '@mui/material';
import {
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  Receipt as ReceiptIcon,
  AccessTime as AccessTimeIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { Customer } from '@bms/core';

interface TemporaryCustomer extends Customer {
  isTemporary: true;
  createdAt: Date;
  lastActivity?: Date;
  saleCount: number;
  totalSpent: number;
  canConvert: boolean;
}

interface TemporaryCustomerProps {
  customers: TemporaryCustomer[];
  loading?: boolean;
  onConvertToPermanent: (customerId: string, customerData: Partial<Customer>) => Promise<void>;
  onDelete: (customerId: string) => Promise<void>;
  onEdit: (customerId: string, updates: Partial<Customer>) => Promise<void>;
  onViewSales: (customerId: string) => void;
  onCreateSale: (customerId: string) => void;
  onRefresh: () => void;
}

const TemporaryCustomer: React.FC<TemporaryCustomerProps> = ({
  customers = [],
  loading = false,
  onConvertToPermanent,
  onDelete,
  onEdit,
  onViewSales,
  onCreateSale,
  onRefresh,
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<TemporaryCustomer | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Handle pagination
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Filter customers by search term
  const filteredCustomers = customers.filter((customer) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      customer.name.toLowerCase().includes(searchLower) ||
      customer.phone.toLowerCase().includes(searchLower) ||
      customer.email?.toLowerCase().includes(searchLower) ||
      customer.company?.toLowerCase().includes(searchLower)
    );
  });

  // Paginated data
  const paginatedCustomers = filteredCustomers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Handle menu actions
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, customer: TemporaryCustomer) => {
    setAnchorEl(event.currentTarget);
    setSelectedCustomer(customer);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleConvertClick = () => {
    setConvertDialogOpen(true);
    handleMenuClose();
  };

  const handleEditClick = () => {
    setEditDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleConvert = async () => {
    if (!selectedCustomer) return;
    
    try {
      setActionLoading(true);
      await onConvertToPermanent(selectedCustomer.id, {
        name: selectedCustomer.name,
        phone: selectedCustomer.phone,
        email: selectedCustomer.email,
        address: selectedCustomer.address,
        company: selectedCustomer.company,
        taxId: selectedCustomer.taxId,
      });
      setConvertDialogOpen(false);
    } catch (error) {
      console.error('Failed to convert customer:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCustomer) return;
    
    try {
      setActionLoading(true);
      await onDelete(selectedCustomer.id);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error('Failed to delete customer:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Calculate customer age in hours
  const getCustomerAge = (createdAt: Date) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffHours = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      const days = Math.floor(diffHours / 24);
      return `${days}d ago`;
    }
  };

  // Get status chip based on activity
  const getStatusChip = (customer: TemporaryCustomer) => {
    const now = new Date();
    const lastActivity = customer.lastActivity ? new Date(customer.lastActivity) : null;
    const hoursSinceActivity = lastActivity 
      ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60))
      : null;

    if (customer.saleCount > 0) {
      return <Chip size="small" label="Active" color="success" variant="outlined" />;
    } else if (hoursSinceActivity !== null && hoursSinceActivity < 24) {
      return <Chip size="small" label="Recent" color="info" variant="outlined" />;
    } else {
      return <Chip size="small" label="Inactive" color="default" variant="outlined" />;
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" component="h1" gutterBottom>
            Temporary Customers
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Walk-in customers created for quick sales. Convert them to permanent customers to keep their history.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={onRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Stats Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary" fontWeight="bold">
                {customers.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Temporary
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main" fontWeight="bold">
                {customers.filter(c => c.saleCount > 0).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                With Sales
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main" fontWeight="bold">
                {customers.filter(c => c.canConvert).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Ready to Convert
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="error.main" fontWeight="bold">
                {customers.filter(c => {
                  const created = new Date(c.createdAt);
                  const now = new Date();
                  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
                  return diffDays > 7;
                }).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Older than 7 days
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
        <TextField
          placeholder="Search temporary customers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />,
          }}
          size="small"
          sx={{ flexGrow: 1 }}
        />
        <Button
          variant="outlined"
          startIcon={<FilterListIcon />}
          size="small"
        >
          Filters
        </Button>
      </Box>

      {/* Alerts */}
      {customers.length === 0 && !loading && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No temporary customers found. Walk-in customers will appear here after quick registrations.
        </Alert>
      )}

      {customers.some(c => {
        const created = new Date(c.createdAt);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays > 30;
      }) && (
        <Alert severity="warning" sx={{ mb: 3 }} icon={<WarningIcon />}>
          Some temporary customers are older than 30 days. Consider cleaning up inactive records.
        </Alert>
      )}

      {/* Customers Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Customer</TableCell>
              <TableCell>Contact</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Sales</TableCell>
              <TableCell>Total Spent</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Loading temporary customers...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : paginatedCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <PersonIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    No temporary customers found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedCustomers.map((customer) => (
                <TableRow key={customer.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                        <PersonIcon fontSize="small" />
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {customer.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {customer.id}
                        </Typography>
                        {customer.company && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {customer.company}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PhoneIcon fontSize="small" sx={{ color: 'action.active' }} />
                        <Typography variant="body2">{customer.phone}</Typography>
                      </Box>
                      {customer.email && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <EmailIcon fontSize="small" sx={{ color: 'action.active' }} />
                          <Typography variant="body2">{customer.email}</Typography>
                        </Box>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AccessTimeIcon fontSize="small" sx={{ color: 'action.active' }} />
                      <Typography variant="body2">
                        {getCustomerAge(customer.createdAt)}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={customer.saleCount}
                      color={customer.saleCount > 0 ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {customer.totalSpent.toFixed(2)} MAD
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {getStatusChip(customer)}
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      <Tooltip title="Create Sale">
                        <IconButton
                          size="small"
                          onClick={() => onCreateSale(customer.id)}
                          color="primary"
                        >
                          <ReceiptIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="View Sales">
                        <IconButton
                          size="small"
                          onClick={() => onViewSales(customer.id)}
                          color="info"
                        >
                          <PersonIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, customer)}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={filteredCustomers.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {selectedCustomer?.canConvert && (
          <MenuItem onClick={handleConvertClick}>
            <ListItemIcon>
              <PersonAddIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Convert to Permanent</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={handleEditClick}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => onViewSales(selectedCustomer?.id || '')}>
          <ListItemIcon>
            <ReceiptIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Sales History</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
          <ListItemIcon sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete Customer</ListItemText>
        </MenuItem>
      </Menu>

      {/* Convert to Permanent Dialog */}
      <Dialog open={convertDialogOpen} onClose={() => setConvertDialogOpen(false)}>
        <DialogTitle>Convert to Permanent Customer</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            This will convert "{selectedCustomer?.name}" to a permanent customer.
            All sales history will be preserved.
          </Alert>
          <Typography variant="body2" paragraph>
            Permanent customers will:
          </Typography>
          <ul>
            <li>Appear in the main customer database</li>
            <li>Be eligible for credit limits</li>
            <li>Receive purchase history tracking</li>
            <li>Be available for future sales</li>
          </ul>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConvertDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConvert}
            variant="contained"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <CheckCircleIcon />}
          >
            {actionLoading ? 'Converting...' : 'Convert to Permanent'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Temporary Customer</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>Warning:</strong> This action cannot be undone.
          </Alert>
          <Typography variant="body2">
            Are you sure you want to delete "{selectedCustomer?.name}"?
            {selectedCustomer?.saleCount > 0 && (
              <Typography variant="body2" color="error" fontWeight="medium">
                This customer has {selectedCustomer.saleCount} sale(s) that will also be deleted!
              </Typography>
            )}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {actionLoading ? 'Deleting...' : 'Delete Customer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TemporaryCustomer; 
