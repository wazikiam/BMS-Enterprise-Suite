/**
 * Low Stock Alerts Component
 * Manages and displays low stock alerts
 * 
 * BUSINESS RULES:
 * - Real-time low stock monitoring
 * - Alert severity classification
 * - Acknowledgment workflow
 * - Reorder suggestions
 * - Alert configuration
 * 
 * DESIGN RULES:
 * - Material-UI components
 * - Severity-based color coding
 * - Action-oriented interface
 * - Responsive design
 * - TypeScript strict mode
 */
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Alert,
  LinearProgress,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Tabs,
  Tab,
  Badge
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckIcon,
  Inventory as InventoryIcon,
  ShoppingCart as CartIcon,
  Refresh as RefreshIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  ArrowForward as ForwardIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Check as CheckIconSmall,
  Close as CloseIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';

// Mock data for development
const mockAlerts = [
  { id: '1', productName: 'iPhone 15 Pro', sku: 'PROD-002', currentStock: 5, minStockLevel: 15, reorderPoint: 8, category: 'Electronics > Phones', supplier: 'Apple Inc.', lastMovement: '2024-01-14', severity: 'critical', status: 'active', acknowledged: false, daysSinceAlert: 2, suggestedReorder: 20 },
  { id: '2', productName: 'Wireless Mouse', sku: 'PROD-004', currentStock: 0, minStockLevel: 30, reorderPoint: 15, category: 'Electronics > Accessories', supplier: 'Logitech', lastMovement: '2024-01-12', severity: 'critical', status: 'active', acknowledged: true, acknowledgedBy: 'Admin User', acknowledgedAt: '2024-01-13', daysSinceAlert: 3, suggestedReorder: 50 },
  { id: '3', productName: 'Monitor 27" 4K', sku: 'PROD-005', currentStock: 8, minStockLevel: 10, reorderPoint: 5, category: 'Electronics > Monitors', supplier: 'Dell', lastMovement: '2024-01-11', severity: 'warning', status: 'active', acknowledged: false, daysSinceAlert: 1, suggestedReorder: 15 },
  { id: '4', productName: 'Office Chair', sku: 'PROD-003', currentStock: 12, minStockLevel: 20, reorderPoint: 10, category: 'Furniture > Office', supplier: 'IKEA', lastMovement: '2024-01-10', severity: 'warning', status: 'active', acknowledged: false, daysSinceAlert: 1, suggestedReorder: 25 },
  { id: '5', productName: 'Laptop Dell XPS 15', sku: 'PROD-001', currentStock: 18, minStockLevel: 25, reorderPoint: 12, category: 'Electronics > Computers', supplier: 'Dell', lastMovement: '2024-01-09', severity: 'info', status: 'active', acknowledged: true, acknowledgedBy: 'Manager', acknowledgedAt: '2024-01-10', daysSinceAlert: 2, suggestedReorder: 30 },
  { id: '6', productName: 'Keyboard Mechanical', sku: 'PROD-006', currentStock: 3, minStockLevel: 10, reorderPoint: 5, category: 'Electronics > Accessories', supplier: 'Corsair', lastMovement: '2024-01-08', severity: 'critical', status: 'resolved', resolvedAt: '2024-01-09', daysSinceAlert: 0, suggestedReorder: 15 },
];

const severityOptions = [
  { value: 'all', label: 'All Severities', color: 'default' },
  { value: 'critical', label: 'Critical', color: 'error' },
  { value: 'warning', label: 'Warning', color: 'warning' },
  { value: 'info', label: 'Info', color: 'info' },
];

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'resolved', label: 'Resolved' },
];

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`alert-tabpanel-${index}`}
      aria-labelledby={`alert-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const LowStockAlerts: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  
  const [alerts, setAlerts] = useState(mockAlerts);
  const [filteredAlerts, setFilteredAlerts] = useState(mockAlerts);
  const [tabValue, setTabValue] = useState(0);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [acknowledgeDialogOpen, setAcknowledgeDialogOpen] = useState(false);
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [acknowledgeNotes, setAcknowledgeNotes] = useState('');
  const [reorderQuantity, setReorderQuantity] = useState('');
  const [alertSettings, setAlertSettings] = useState({
    autoAcknowledge: false,
    notifyOnCritical: true,
    notifyEmail: '',
    lowStockThreshold: 0.5, // 50% of min stock
    criticalThreshold: 0.2, // 20% of min stock
    checkFrequency: 'daily'
  });

  // Categories for filter
  const categories = ['all', 'Electronics', 'Furniture', 'Accessories'];

  // Apply filters
  useEffect(() => {
    let filtered = alerts;

    // Tab filter
    if (tabValue === 0) {
      filtered = filtered.filter(alert => alert.status === 'active');
    } else if (tabValue === 1) {
      filtered = filtered.filter(alert => alert.acknowledged);
    } else if (tabValue === 2) {
      filtered = filtered.filter(alert => alert.status === 'resolved');
    }

    // Severity filter
    if (severityFilter !== 'all') {
      filtered = filtered.filter(alert => alert.severity === severityFilter);
    }

    // Status filter (for all tab)
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        filtered = filtered.filter(alert => alert.status === 'active');
      } else if (statusFilter === 'acknowledged') {
        filtered = filtered.filter(alert => alert.acknowledged);
      } else if (statusFilter === 'resolved') {
        filtered = filtered.filter(alert => alert.status === 'resolved');
      }
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(alert => alert.category.includes(categoryFilter));
    }

    setFilteredAlerts(filtered);
  }, [alerts, tabValue, severityFilter, statusFilter, categoryFilter]);

  // Calculate statistics
  const activeAlerts = alerts.filter(a => a.status === 'active');
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
  const warningAlerts = activeAlerts.filter(a => a.severity === 'warning');
  const infoAlerts = activeAlerts.filter(a => a.severity === 'info');
  
  const totalStockValueAtRisk = activeAlerts.reduce((sum, alert) => {
    return sum + (alert.currentStock * 1000); // Placeholder cost calculation
  }, 0);

  // Get severity chip
  const getSeverityChip = (severity: string) => {
    const option = severityOptions.find(s => s.value === severity);
    return (
      <Chip
        icon={severity === 'critical' ? <ErrorIcon /> : <WarningIcon />}
        label={option?.label || severity}
        color={option?.color as any}
        size="small"
        variant="filled"
      />
    );
  };

  // Get stock percentage
  const getStockPercentage = (current: number, min: number) => {
    if (min === 0) return 0;
    return (current / min) * 100;
  };

  // Get stock progress color
  const getProgressColor = (percentage: number, severity: string) => {
    if (severity === 'critical') return 'error';
    if (severity === 'warning') return 'warning';
    return 'info';
  };

  // Handle alert acknowledgment
  const handleAcknowledge = (alert: any) => {
    setSelectedAlert(alert);
    setAcknowledgeNotes('');
    setAcknowledgeDialogOpen(true);
  };

  const handleConfirmAcknowledge = () => {
    if (selectedAlert) {
      setAlerts(alerts.map(a => 
        a.id === selectedAlert.id 
          ? { ...a, acknowledged: true, acknowledgedBy: user?.name || 'System', acknowledgedAt: new Date().toISOString().split('T')[0] }
          : a
      ));
      setAcknowledgeDialogOpen(false);
    }
  };

  // Handle create reorder
  const handleCreateReorder = (alert: any) => {
    setSelectedAlert(alert);
    setReorderQuantity(alert.suggestedReorder.toString());
    setReorderDialogOpen(true);
  };

  const handleConfirmReorder = () => {
    if (selectedAlert && reorderQuantity) {
      // In real app, this would create a purchase order
      alert(`Creating purchase order for ${reorderQuantity} units of ${selectedAlert.productName}`);
      setReorderDialogOpen(false);
      
      // Mark alert as resolved
      setAlerts(alerts.map(a => 
        a.id === selectedAlert.id 
          ? { ...a, status: 'resolved', resolvedAt: new Date().toISOString().split('T')[0] }
          : a
      ));
    }
  };

  // Handle alert resolution
  const handleResolveAlert = (alertId: string) => {
    setAlerts(alerts.map(a => 
      a.id === alertId 
        ? { ...a, status: 'resolved', resolvedAt: new Date().toISOString().split('T')[0] }
        : a
    ));
  };

  // Handle bulk acknowledgment
  const handleBulkAcknowledge = () => {
    const unacknowledged = filteredAlerts.filter(a => !a.acknowledged && a.status === 'active');
    if (unacknowledged.length === 0) return;
    
    if (window.confirm(`Acknowledge ${unacknowledged.length} alerts?`)) {
      setAlerts(alerts.map(a => 
        unacknowledged.some(ua => ua.id === a.id)
          ? { ...a, acknowledged: true, acknowledgedBy: user?.name || 'System', acknowledgedAt: new Date().toISOString().split('T')[0] }
          : a
      ));
    }
  };

  // Handle settings save
  const handleSaveSettings = () => {
    alert('Alert settings saved');
    setSettingsDialogOpen(false);
  };

  // Check permissions
  if (!hasPermission(['admin', 'manager'])) {
    return (
      <Card sx={{ p: 4, textAlign: 'center' }}>
        <ErrorIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          Access Denied
        </Typography>
        <Typography color="textSecondary">
          You need admin or manager permissions to view stock alerts.
        </Typography>
      </Card>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" gutterBottom>
              Low Stock Alerts
            </Typography>
            <Typography color="textSecondary">
              Monitor and manage low stock situations
            </Typography>
          </Box>
          
          <Box>
            <Button
              startIcon={<SettingsIcon />}
              onClick={() => setSettingsDialogOpen(true)}
              sx={{ mr: 1 }}
            >
              Settings
            </Button>
            <Button
              variant="contained"
              startIcon={<CartIcon />}
              onClick={() => navigate('/purchases/new')}
            >
              Create Purchase Order
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ p: 2, borderLeft: 4, borderColor: 'error.main' }}>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              Critical Alerts
            </Typography>
            <Typography variant="h3" color="error.main">
              {criticalAlerts.length}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Needs immediate attention
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ p: 2, borderLeft: 4, borderColor: 'warning.main' }}>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              Warning Alerts
            </Typography>
            <Typography variant="h3" color="warning.main">
              {warningAlerts.length}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Monitor closely
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ p: 2, borderLeft: 4, borderColor: 'info.main' }}>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              Info Alerts
            </Typography>
            <Typography variant="h3" color="info.main">
              {infoAlerts.length}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              For awareness
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ p: 2, borderLeft: 4, borderColor: 'primary.main' }}>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              Value at Risk
            </Typography>
            <Typography variant="h3">
              {totalStockValueAtRisk.toLocaleString()} MAD
            </Typography>
            <Typography variant="caption" color="textSecondary">
              Potential stockout cost
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs and Filters */}
      <Card sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={(e, newValue) => setTabValue(newValue)}
            aria-label="alert tabs"
          >
            <Tab 
              label={
                <Badge badgeContent={activeAlerts.length} color="error">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <WarningIcon sx={{ mr: 1 }} />
                    Active Alerts
                  </Box>
                </Badge>
              } 
            />
            <Tab 
              label={
                <Badge badgeContent={alerts.filter(a => a.acknowledged).length} color="primary">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckIcon sx={{ mr: 1 }} />
                    Acknowledged
                  </Box>
                </Badge>
              } 
            />
            <Tab 
              label={
                <Badge badgeContent={alerts.filter(a => a.status === 'resolved').length} color="success">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle sx={{ mr: 1 }} />
                    Resolved
                  </Box>
                </Badge>
              } 
            />
          </Tabs>
        </Box>

        {/* Filters */}
        <Box sx={{ p: 2, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Severity</InputLabel>
                <Select
                  value={severityFilter}
                  label="Severity"
                  onChange={(e) => setSeverityFilter(e.target.value)}
                >
                  {severityOptions.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      <Chip
                        label={option.label}
                        color={option.color as any}
                        size="small"
                        sx={{ mr: 1 }}
                      />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                  disabled={tabValue !== 0}
                >
                  {statusOptions.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  value={categoryFilter}
                  label="Category"
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  {categories.map(category => (
                    <MenuItem key={category} value={category}>
                      {category === 'all' ? 'All Categories' : category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={3} sx={{ textAlign: 'right' }}>
              <Button
                startIcon={<FilterIcon />}
                onClick={() => {
                  setSeverityFilter('all');
                  setStatusFilter('all');
                  setCategoryFilter('all');
                }}
                sx={{ mr: 1 }}
              >
                Clear Filters
              </Button>
              
              <Button
                startIcon={<DownloadIcon />}
              >
                Export
              </Button>
            </Grid>
          </Grid>
        </Box>

        {/* Tab Panels */}
        <TabPanel value={tabValue} index={0}>
          {/* Active Alerts Table */}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell align="center">Stock Level</TableCell>
                  <TableCell align="center">Severity</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Supplier</TableCell>
                  <TableCell align="center">Days Alert</TableCell>
                  <TableCell align="right">Reorder Qty</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAlerts.map((alert) => {
                  const stockPercentage = getStockPercentage(alert.currentStock, alert.minStockLevel);
                  const progressColor = getProgressColor(stockPercentage, alert.severity);
                  
                  return (
                    <TableRow 
                      key={alert.id}
                      hover
                      sx={{ 
                        '&:hover': { backgroundColor: 'action.hover' },
                        backgroundColor: alert.severity === 'critical' ? 'error.light' :
                                       alert.severity === 'warning' ? 'warning.light' : 'inherit'
                      }}
                    >
                      <TableCell>
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {alert.productName}
                          </Typography>
                          <Typography variant="caption" color="textSecondary" fontFamily="monospace">
                            {alert.sku}
                          </Typography>
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" color="textSecondary">
                              Min: {alert.minStockLevel} | Reorder: {alert.reorderPoint}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      
                      <TableCell align="center">
                        <Box sx={{ width: '100%' }}>
                          <Typography variant="h6" color={alert.severity === 'critical' ? 'error.main' : 'inherit'}>
                            {alert.currentStock}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(stockPercentage, 100)}
                            color={progressColor as any}
                            sx={{ height: 6, borderRadius: 3, mt: 1 }}
                          />
                          <Typography variant="caption" color="textSecondary">
                            {stockPercentage.toFixed(0)}% of minimum
                          </Typography>
                        </Box>
                      </TableCell>
                      
                      <TableCell align="center">
                        {getSeverityChip(alert.severity)}
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {alert.category}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {alert.supplier}
                        </Typography>
                      </TableCell>
                      
                      <TableCell align="center">
                        <Chip
                          label={`${alert.daysSinceAlert}d`}
                          color={alert.daysSinceAlert > 3 ? 'error' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      
                      <TableCell align="right">
                        <Typography variant="body1" fontWeight="medium">
                          {alert.suggestedReorder}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Suggested
                        </Typography>
                      </TableCell>
                      
                      <TableCell align="center">
                        {!alert.acknowledged ? (
                          <Tooltip title="Acknowledge Alert">
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={() => handleAcknowledge(alert)}
                            >
                              <CheckIconSmall />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Chip
                            label="Acknowledged"
                            color="success"
                            size="small"
                            variant="outlined"
                          />
                        )}
                        
                        <Tooltip title="Create Reorder">
                          <IconButton 
                            size="small" 
                            color="warning"
                            onClick={() => handleCreateReorder(alert)}
                            sx={{ ml: 1 }}
                          >
                            <CartIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="View Product">
                          <IconButton 
                            size="small"
                            onClick={() => navigate(`/inventory/products/${alert.sku}`)}
                            sx={{ ml: 1 }}
                          >
                            <InventoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Bulk Actions */}
          {filteredAlerts.length > 0 && (
            <Paper sx={{ p: 2, mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="textSecondary">
                {filteredAlerts.length} alerts found
              </Typography>
              
              <Box>
                <Button
                  size="small"
                  onClick={handleBulkAcknowledge}
                  disabled={filteredAlerts.every(a => a.acknowledged)}
                  sx={{ mr: 1 }}
                >
                  Acknowledge All
                </Button>
                
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => navigate('/purchases/new')}
                  startIcon={<CartIcon />}
                >
                  Bulk Reorder
                </Button>
              </Box>
            </Paper>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {/* Acknowledged Alerts */}
          {filteredAlerts.length === 0 ? (
            <Alert severity="info">
              No acknowledged alerts found
            </Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Acknowledged By</TableCell>
                    <TableCell>Acknowledged At</TableCell>
                    <TableCell>Days Since</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAlerts.map((alert) => (
                    <TableRow key={alert.id} hover>
                      <TableCell>{alert.productName}</TableCell>
                      <TableCell>{getSeverityChip(alert.severity)}</TableCell>
                      <TableCell>{alert.acknowledgedBy}</TableCell>
                      <TableCell>{alert.acknowledgedAt}</TableCell>
                      <TableCell>{alert.daysSinceAlert} days</TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          onClick={() => handleCreateReorder(alert)}
                        >
                          Reorder
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          {/* Resolved Alerts */}
          {filteredAlerts.length === 0 ? (
            <Alert severity="success">
              No resolved alerts. Great job keeping stock levels healthy!
            </Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Resolved At</TableCell>
                    <TableCell>Resolution</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAlerts.map((alert) => (
                    <TableRow key={alert.id} hover>
                      <TableCell>{alert.productName}</TableCell>
                      <TableCell>{getSeverityChip(alert.severity)}</TableCell>
                      <TableCell>{alert.resolvedAt}</TableCell>
                      <TableCell>Stock replenished</TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          onClick={() => navigate(`/inventory/products/${alert.sku}`)}
                        >
                          View Product
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
      </Card>

      {/* No Alerts Message */}
      {filteredAlerts.length === 0 && tabValue === 0 && (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <CheckIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            No Active Alerts
          </Typography>
          <Typography color="textSecondary" paragraph>
            All stock levels are within acceptable ranges. Great job!
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              // In real app, this would refresh alerts from server
              alert('Refreshing alerts...');
            }}
          >
            Refresh Alerts
          </Button>
        </Card>
      )}

      {/* Acknowledge Dialog */}
      <Dialog open={acknowledgeDialogOpen} onClose={() => setAcknowledgeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Acknowledge Alert
          <IconButton
            aria-label="close"
            onClick={() => setAcknowledgeDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          {selectedAlert && (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle1">
                  {selectedAlert.productName} ({selectedAlert.sku})
                </Typography>
                <Typography variant="body2">
                  Current stock: {selectedAlert.currentStock} | Minimum: {selectedAlert.minStockLevel}
                </Typography>
              </Alert>
              
              <TextField
                fullWidth
                label="Notes (Optional)"
                multiline
                rows={3}
                value={acknowledgeNotes}
                onChange={(e) => setAcknowledgeNotes(e.target.value)}
                placeholder="Add notes about this acknowledgment..."
                sx={{ mt: 2 }}
              />
              
              <FormControlLabel
                control={<Checkbox defaultChecked />}
                label="Create follow-up task"
                sx={{ mt: 2, display: 'block' }}
              />
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setAcknowledgeDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleConfirmAcknowledge}
            startIcon={<CheckIconSmall />}
          >
            Acknowledge
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reorder Dialog */}
      <Dialog open={reorderDialogOpen} onClose={() => setReorderDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Create Purchase Order
          <IconButton
            aria-label="close"
            onClick={() => setReorderDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          {selectedAlert && (
            <Box>
              <Typography variant="body1" gutterBottom>
                Product: <strong>{selectedAlert.productName}</strong>
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Supplier: {selectedAlert.supplier} | SKU: {selectedAlert.sku}
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <TextField
                fullWidth
                label="Reorder Quantity"
                type="number"
                value={reorderQuantity}
                onChange={(e) => setReorderQuantity(e.target.value)}
                sx={{ mb: 2 }}
                helperText={`Suggested: ${selectedAlert.suggestedReorder} units`}
              />
              
              <TextField
                fullWidth
                label="Expected Delivery Date"
                type="date"
                defaultValue={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Notes (Optional)"
                multiline
                rows={2}
                placeholder="Add notes for this purchase order..."
              />
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setReorderDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleConfirmReorder}
            startIcon={<CartIcon />}
          >
            Create Purchase Order
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Alert Settings
          <IconButton
            aria-label="close"
            onClick={() => setSettingsDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Alert Thresholds
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Low Stock Threshold (%)"
                  type="number"
                  value={alertSettings.lowStockThreshold * 100}
                  onChange={(e) => setAlertSettings({
                    ...alertSettings,
                    lowStockThreshold: parseFloat(e.target.value) / 100
                  })}
                  helperText="Alert when stock is below this percentage of minimum level"
                  InputProps={{ endAdornment: <Typography>%</Typography> }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Critical Threshold (%)"
                  type="number"
                  value={alertSettings.criticalThreshold * 100}
                  onChange={(e) => setAlertSettings({
                    ...alertSettings,
                    criticalThreshold: parseFloat(e.target.value) / 100
                  })}
                  helperText="Critical alert when stock is below this percentage"
                  InputProps={{ endAdornment: <Typography>%</Typography> }}
                />
              </Grid>
            </Grid>
            
            <Divider sx={{ my: 3 }} />
            
            <Typography variant="h6" gutterBottom>
              Notification Settings
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={alertSettings.autoAcknowledge}
                  onChange={(e) => setAlertSettings({
                    ...alertSettings,
                    autoAcknowledge: e.target.checked
                  })}
                />
              }
              label="Auto-acknowledge info alerts"
              sx={{ display: 'block', mb: 2 }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={alertSettings.notifyOnCritical}
                  onChange={(e) => setAlertSettings({
                    ...alertSettings,
                    notifyOnCritical: e.target.checked
                  })}
                />
              }
              label="Email notification for critical alerts"
              sx={{ display: 'block', mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Notification Email"
              type="email"
              value={alertSettings.notifyEmail}
              onChange={(e) => setAlertSettings({
                ...alertSettings,
                notifyEmail: e.target.value
              })}
              sx={{ mb: 2 }}
            />
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Alert Check Frequency</InputLabel>
              <Select
                value={alertSettings.checkFrequency}
                label="Alert Check Frequency"
                onChange={(e) => setAlertSettings({
                  ...alertSettings,
                  checkFrequency: e.target.value
                })}
              >
                <MenuItem value="hourly">Hourly</MenuItem>
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="twice_daily">Twice Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSaveSettings}
          >
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Missing icon component
const CheckCircle = (props: any) => (
  <CheckIcon {...props} />
);

export default LowStockAlerts; 
