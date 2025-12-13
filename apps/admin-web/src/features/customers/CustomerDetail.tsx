// apps/admin-web/src/features/customers/CustomerDetail.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Grid,
  Typography,
  Button,
  Chip,
  Card,
  CardContent,
  Divider,
  IconButton,
  Tab,
  Tabs,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Avatar,
  Badge,
  Breadcrumbs,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  AttachMoney as MoneyIcon,
  History as HistoryIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Receipt as ReceiptIcon,
  CreditCard as CreditCardIcon,
  AccountBalance as BalanceIcon,
  ShoppingCart as CartIcon,
  CalendarToday as CalendarIcon,
  ArrowBack as BackIcon,
  MoreVert as MoreVertIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon
} from '@mui/icons-material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { Customer, CustomerType, CustomerStatus } from '../../../../packages/core/src/domain/Customer';
import { useCustomers } from '../hooks/useCustomers';
import { formatCurrency, formatDate, formatPhoneNumber } from '../../../utils/formatters';
import { hasPermission } from '../../../utils/hasPermission';
import BalanceView from './credit/BalanceView';
import TransactionHistory from './credit/TransactionHistory';
import PurchaseHistory from './PurchaseHistory';
import CreditLimitAlerts from './credit/CreditLimitAlerts';
import CustomerBalanceDashboard from './CustomerBalanceDashboard';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`customer-tabpanel-${index}`}
      aria-labelledby={`customer-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
};

const CustomerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCustomer, deleteCustomer, loading, error } = useCustomers();
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Fetch customer data
  useEffect(() => {
    if (id) {
      loadCustomer();
    }
  }, [id]);

  const loadCustomer = async () => {
    try {
      const data = await getCustomer(id!);
      setCustomer(data);
    } catch (error) {
      console.error('Error loading customer:', error);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEdit = () => {
    navigate(`/customers/${id}/edit`);
  };

  const handleDelete = async () => {
    if (customer) {
      await deleteCustomer(customer.id);
      navigate('/customers');
    }
  };

  const handleCreateSale = () => {
    navigate(`/sales/new?customerId=${id}`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // Implement export functionality
    console.log('Export customer data');
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    // In a real app, this would update the customer record
  };

  if (loading && !customer) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Error loading customer: {error.message}
        <Button onClick={loadCustomer} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  if (!customer) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        Customer not found
      </Alert>
    );
  }

  // Helper functions
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
      case 'COMPANY': return <BusinessIcon />;
      case 'INDIVIDUAL': return <PersonIcon />;
      case 'TEMPORARY': return <PersonIcon />;
      default: return <PersonIcon />;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
      '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
      '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800'
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const isOverdue = customer.currentBalance > 0; // Simplified - would check actual overdue status
  const utilization = customer.creditLimit 
    ? (customer.currentBalance / customer.creditLimit) * 100 
    : 0;

  const canEdit = hasPermission('customers', 'update');
  const canDelete = hasPermission('customers', 'delete');
  const canCreateSales = hasPermission('sales', 'create');

  return (
    <Box sx={{ width: '100%' }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 3 }}>
        <Link component={RouterLink} to="/customers" color="inherit">
          Customers
        </Link>
        <Typography color="text.primary">{customer.name}</Typography>
      </Breadcrumbs>

      {/* Header section */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          {/* Customer avatar and basic info */}
          <Grid item xs={12} md={8}>
            <Box display="flex" alignItems="center" gap={3}>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  <IconButton
                    size="small"
                    onClick={toggleFavorite}
                    sx={{ bgcolor: 'background.paper' }}
                  >
                    {isFavorite ? (
                      <StarIcon sx={{ color: 'warning.main' }} />
                    ) : (
                      <StarBorderIcon />
                    )}
                  </IconButton>
                }
              >
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: getAvatarColor(customer.name),
                    fontSize: '1.5rem'
                  }}
                >
                  {getInitials(customer.name)}
                </Avatar>
              </Badge>

              <Box>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Typography variant="h4">
                    {customer.name}
                  </Typography>
                  {getTypeIcon(customer.type)}
                  <Chip
                    label={customer.type}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={customer.status}
                    size="small"
                    color={getStatusColor(customer.status) as any}
                  />
                  {isOverdue && (
                    <Chip
                      label="Overdue"
                      size="small"
                      color="error"
                      icon={<WarningIcon />}
                    />
                  )}
                </Box>

                <Box display="flex" alignItems="center" gap={3} flexWrap="wrap">
                  <Box display="flex" alignItems="center" gap={0.5}>
                    <PhoneIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      {formatPhoneNumber(customer.phone)}
                    </Typography>
                  </Box>

                  {customer.email && (
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <EmailIcon fontSize="small" color="action" />
                      <Typography variant="body2">
                        {customer.email}
                      </Typography>
                    </Box>
                  )}

                  {customer.companyName && (
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <BusinessIcon fontSize="small" color="action" />
                      <Typography variant="body2">
                        {customer.companyName}
                      </Typography>
                    </Box>
                  )}

                  <Box display="flex" alignItems="center" gap={0.5}>
                    <CalendarIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      Customer since {formatDate(customer.createdAt)}
                    </Typography>
                  </Box>
                </Box>

                {/* Tags */}
                {customer.tags && customer.tags.length > 0 && (
                  <Box display="flex" gap={0.5} mt={1} flexWrap="wrap">
                    {customer.tags.map(tag => (
                      <Chip key={tag} label={tag} size="small" />
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          </Grid>

          {/* Action buttons */}
          <Grid item xs={12} md={4}>
            <Box display="flex" justifyContent="flex-end" gap={1} flexWrap="wrap">
              <Button
                variant="outlined"
                startIcon={<BackIcon />}
                onClick={() => navigate('/customers')}
              >
                Back
              </Button>

              {canCreateSales && (
                <Button
                  variant="contained"
                  startIcon={<CartIcon />}
                  onClick={handleCreateSale}
                >
                  New Sale
                </Button>
              )}

              {canEdit && (
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={handleEdit}
                >
                  Edit
                </Button>
              )}

              <IconButton onClick={handlePrint}>
                <PrintIcon />
              </IconButton>

              <IconButton onClick={handleExport}>
                <DownloadIcon />
              </IconButton>

              <IconButton>
                <ShareIcon />
              </IconButton>

              <IconButton>
                <MoreVertIcon />
              </IconButton>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Quick stats cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Balance card */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Current Balance
                  </Typography>
                  <Typography
                    variant="h4"
                    color={customer.currentBalance > 0 ? 'error' : 'success'}
                  >
                    {formatCurrency(customer.currentBalance, 'MAD')}
                  </Typography>
                </Box>
                <BalanceIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {customer.currentBalance > 0 ? 'Amount due' : 'No outstanding balance'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Credit limit card */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Credit Limit
                  </Typography>
                  <Typography variant="h4">
                    {customer.creditLimit 
                      ? formatCurrency(customer.creditLimit, 'MAD')
                      : 'No limit'
                    }
                  </Typography>
                </Box>
                <CreditCardIcon color="action" sx={{ fontSize: 40 }} />
              </Box>
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Utilization
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(utilization, 100)}
                  color={utilization > 90 ? 'error' : utilization > 70 ? 'warning' : 'success'}
                  sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {utilization.toFixed(1)}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Purchase history card */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Purchases
                  </Typography>
                  <Typography variant="h4">
                    {customer.totalPurchases}
                  </Typography>
                </Box>
                <ReceiptIcon color="info" sx={{ fontSize: 40 }} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {customer.lastPurchaseDate 
                  ? `Last purchase: ${formatDate(customer.lastPurchaseDate)}`
                  : 'No purchases yet'
                }
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Average transaction card */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Avg. Transaction
                  </Typography>
                  <Typography variant="h4">
                    {formatCurrency(customer.averageTransactionValue, 'MAD')}
                  </Typography>
                </Box>
                <MoneyIcon color="success" sx={{ fontSize: 40 }} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                Based on {customer.totalPurchases} transactions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs for detailed information */}
      <Paper elevation={2}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="customer tabs">
            <Tab label="Overview" icon={<InfoIcon />} iconPosition="start" />
            <Tab label="Balance & Credit" icon={<BalanceIcon />} iconPosition="start" />
            <Tab label="Transactions" icon={<HistoryIcon />} iconPosition="start" />
            <Tab label="Purchase History" icon={<ReceiptIcon />} iconPosition="start" />
            <Tab label="Alerts" icon={<WarningIcon />} iconPosition="start" />
            <Tab label="Documents" icon={<ReceiptIcon />} iconPosition="start" />
          </Tabs>
        </Box>

        {/* Tab 1: Overview */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {/* Left column - Customer details */}
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Customer Details
                </Typography>
                
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <PersonIcon color="action" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Customer Code"
                      secondary={customer.code}
                    />
                  </ListItem>

                  <Divider component="li" />

                  {customer.taxId && (
                    <>
                      <ListItem>
                        <ListItemIcon>
                          <BusinessIcon color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Tax ID / ICE"
                          secondary={customer.taxId}
                        />
                      </ListItem>
                      <Divider component="li" />
                    </>
                  )}

                  <ListItem>
                    <ListItemIcon>
                      <CalendarIcon color="action" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Created"
                      secondary={formatDate(customer.createdAt)}
                    />
                  </ListItem>

                  <Divider component="li" />

                  <ListItem>
                    <ListItemIcon>
                      <CalendarIcon color="action" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Last Updated"
                      secondary={formatDate(customer.updatedAt)}
                    />
                  </ListItem>
                </List>

                {/* Notes section */}
                {customer.notes && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" gutterBottom>
                      Notes
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {customer.notes}
                    </Typography>
                  </>
                )}
              </Paper>
            </Grid>

            {/* Right column - Quick actions and alerts */}
            <Grid item xs={12} md={6}>
              {/* Quick actions card */}
              <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Quick Actions
                </Typography>
                <Grid container spacing={2}>
                  {canCreateSales && (
                    <Grid item xs={12} sm={6}>
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<CartIcon />}
                        onClick={handleCreateSale}
                      >
                        New Sale
                      </Button>
                    </Grid>
                  )}
                  
                  <Grid item xs={12} sm={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<MoneyIcon />}
                      onClick={() => navigate(`/customers/${id}/payments`)}
                    >
                      Record Payment
                    </Button>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<EditIcon />}
                      onClick={() => navigate(`/customers/${id}/credit-limit`)}
                    >
                      Update Credit Limit
                    </Button>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<LocationIcon />}
                      onClick={() => navigate(`/customers/${id}/addresses`)}
                    >
                      Manage Addresses
                    </Button>
                  </Grid>
                </Grid>
              </Paper>

              {/* Recent alerts card */}
              <Paper variant="outlined" sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Recent Alerts
                </Typography>
                <CreditLimitAlerts customerId={customer.id} compact />
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 2: Balance & Credit */}
        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <BalanceView customerId={customer.id} />
            </Grid>
            <Grid item xs={12} md={4}>
              <CustomerBalanceDashboard customerId={customer.id} />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Tab 3: Transactions */}
        <TabPanel value={tabValue} index={2}>
          <TransactionHistory customerId={customer.id} />
        </TabPanel>

        {/* Tab 4: Purchase History */}
        <TabPanel value={tabValue} index={3}>
          <PurchaseHistory customerId={customer.id} />
        </TabPanel>

        {/* Tab 5: Alerts */}
        <TabPanel value={tabValue} index={4}>
          <CreditLimitAlerts customerId={customer.id} />
        </TabPanel>

        {/* Tab 6: Documents */}
        <TabPanel value={tabValue} index={5}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Customer Documents
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Document</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="textSecondary" sx={{ py: 4 }}>
                        No documents found
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            <Button startIcon={<DownloadIcon />} sx={{ mt: 2 }}>
              Download All Documents
            </Button>
          </Paper>
        </TabPanel>
      </Paper>

      {/* Danger zone (delete customer) */}
      {canDelete && (
        <Paper elevation={2} sx={{ mt: 3, p: 3, bgcolor: 'error.light', color: 'error.contrastText' }}>
          <Typography variant="h6" gutterBottom>
            Danger Zone
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Deleting a customer is permanent and cannot be undone. 
            This will remove all customer data including transaction history.
          </Typography>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteConfirmOpen(true)}
          >
            Delete Customer
          </Button>
        </Paper>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirmOpen && (
        <Alert 
          severity="error" 
          sx={{ mt: 2 }}
          action={
            <>
              <Button color="inherit" size="small" onClick={handleDelete}>
                Confirm
              </Button>
              <Button color="inherit" size="small" onClick={() => setDeleteConfirmOpen(false)}>
                Cancel
              </Button>
            </>
          }
        >
          Are you sure you want to delete {customer.name}? This action cannot be undone.
        </Alert>
      )}
    </Box>
  );
};

export default CustomerDetail; 
