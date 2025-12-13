 
/**
 * Stock Level View Component
 * Displays real-time stock levels with alerts and movements
 * 
 * BUSINESS RULES:
 * - Real-time stock tracking
 * - Low stock alerts with thresholds
 * - Stock movement history
 * - Stock value calculation
 * 
 * DESIGN RULES:
 * - Material-UI components
 * - Responsive dashboard layout
 * - Odoo-inspired design patterns
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
  LinearProgress,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Divider
} from '@mui/material';
import {
  Warning as WarningIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Inventory as InventoryIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';

// Mock data for development
const mockStockLevels = [
  { id: '1', productName: 'Laptop Dell XPS 15', sku: 'PROD-001', currentStock: 25, minStockLevel: 10, reorderPoint: 5, lastMovement: '2024-01-15', movementType: 'in', movementQty: 5, stockValue: 375000 },
  { id: '2', productName: 'iPhone 15 Pro', sku: 'PROD-002', currentStock: 5, minStockLevel: 15, reorderPoint: 8, lastMovement: '2024-01-14', movementType: 'out', movementQty: 2, stockValue: 60000 },
  { id: '3', productName: 'Office Chair', sku: 'PROD-003', currentStock: 50, minStockLevel: 20, reorderPoint: 10, lastMovement: '2024-01-13', movementType: 'in', movementQty: 10, stockValue: 125000 },
  { id: '4', productName: 'Wireless Mouse', sku: 'PROD-004', currentStock: 0, minStockLevel: 30, reorderPoint: 15, lastMovement: '2024-01-12', movementType: 'out', movementQty: 5, stockValue: 0 },
  { id: '5', productName: 'Monitor 27" 4K', sku: 'PROD-005', currentStock: 8, minStockLevel: 10, reorderPoint: 5, lastMovement: '2024-01-11', movementType: 'in', movementQty: 3, stockValue: 160000 },
];

const mockStockAlerts = [
  { id: '1', productName: 'iPhone 15 Pro', alertType: 'low_stock', currentLevel: 5, threshold: 15, triggered: '2024-01-14' },
  { id: '2', productName: 'Wireless Mouse', alertType: 'out_of_stock', currentLevel: 0, threshold: 30, triggered: '2024-01-12' },
  { id: '3', productName: 'Monitor 27" 4K', alertType: 'low_stock', currentLevel: 8, threshold: 10, triggered: '2024-01-11' },
];

const StockLevelView: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  
  const [stockLevels, setStockLevels] = useState(mockStockLevels);
  const [alerts, setAlerts] = useState(mockStockAlerts);
  const [filter, setFilter] = useState('all'); // all, low, out, healthy
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [adjustmentQty, setAdjustmentQty] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  // Calculate statistics
  const totalStockValue = stockLevels.reduce((sum, item) => sum + item.stockValue, 0);
  const lowStockCount = stockLevels.filter(item => item.currentStock > 0 && item.currentStock <= item.minStockLevel).length;
  const outOfStockCount = stockLevels.filter(item => item.currentStock === 0).length;
  const healthyStockCount = stockLevels.filter(item => item.currentStock > item.minStockLevel).length;

  // Filter stock levels
  const filteredStockLevels = stockLevels.filter(item => {
    if (filter === 'low') return item.currentStock > 0 && item.currentStock <= item.minStockLevel;
    if (filter === 'out') return item.currentStock === 0;
    if (filter === 'healthy') return item.currentStock > item.minStockLevel;
    return true;
  });

  // Calculate stock percentage for progress bars
  const getStockPercentage = (current: number, min: number) => {
    if (min === 0) return 100;
    const percentage = (current / min) * 100;
    return Math.min(percentage, 100);
  };

  // Get stock status color
  const getStockStatusColor = (current: number, min: number) => {
    if (current === 0) return 'error';
    if (current <= min) return 'warning';
    return 'success';
  };

  // Get stock status text
  const getStockStatusText = (current: number, min: number) => {
    if (current === 0) return 'Out of Stock';
    if (current <= min) return 'Low Stock';
    return 'In Stock';
  };

  // Handle stock adjustment
  const handleAdjustStock = (product: any) => {
    setSelectedProduct(product);
    setAdjustmentQty('');
    setAdjustmentReason('');
    setAdjustDialogOpen(true);
  };

  const handleConfirmAdjustment = () => {
    // In real app, this would call API
    console.log(`Adjusting ${selectedProduct.productName} by ${adjustmentQty}: ${adjustmentReason}`);
    setAdjustDialogOpen(false);
    
    // Show success message
    alert(`Stock adjustment submitted for ${selectedProduct.productName}`);
  };

  // Handle alert acknowledgment
  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts(alerts.filter(alert => alert.id !== alertId));
  };

  return (
    <Box>
      {/* Stock Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <InventoryIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6" color="textSecondary">
                Total Stock Value
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {totalStockValue.toLocaleString()} MAD
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Across {stockLevels.length} products
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <TrendingUpIcon color="success" sx={{ mr: 1 }} />
              <Typography variant="h6" color="textSecondary">
                Healthy Stock
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'success.main' }}>
              {healthyStockCount}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Above minimum levels
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <WarningIcon color="warning" sx={{ mr: 1 }} />
              <Typography variant="h6" color="textSecondary">
                Low Stock
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'warning.main' }}>
              {lowStockCount}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Needs attention
            </Typography>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <TrendingDownIcon color="error" sx={{ mr: 1 }} />
              <Typography variant="h6" color="textSecondary">
                Out of Stock
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'error.main' }}>
              {outOfStockCount}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Requires reorder
            </Typography>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Left Column: Stock Levels Table */}
        <Grid item xs={12} md={8}>
          <Card>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                Stock Levels
              </Typography>
              
              <Box>
                <Button
                  size="small"
                  startIcon={<FilterIcon />}
                  onClick={() => setFilter(filter === 'all' ? 'low' : filter === 'low' ? 'out' : filter === 'out' ? 'healthy' : 'all')}
                  sx={{ mr: 1 }}
                >
                  {filter === 'all' ? 'All' : filter === 'low' ? 'Low Stock' : filter === 'out' ? 'Out of Stock' : 'Healthy'}
                </Button>
                
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
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
              </Box>
            </Box>

            <Divider />

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell align="center">Current Stock</TableCell>
                    <TableCell align="center">Min Level</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="center">Last Movement</TableCell>
                    <TableCell align="right">Stock Value</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredStockLevels.map((item) => {
                    const stockPercentage = getStockPercentage(item.currentStock, item.minStockLevel);
                    const statusColor = getStockStatusColor(item.currentStock, item.minStockLevel);
                    const statusText = getStockStatusText(item.currentStock, item.minStockLevel);
                    
                    return (
                      <TableRow 
                        key={item.id}
                        hover
                        sx={{ 
                          '&:hover': { backgroundColor: 'action.hover' },
                          backgroundColor: item.currentStock === 0 ? 'error.light' :
                                         item.currentStock <= item.minStockLevel ? 'warning.light' : 'inherit'
                        }}
                      >
                        <TableCell>
                          <Box>
                            <Typography variant="body1" fontWeight="medium">
                              {item.productName}
                            </Typography>
                            <Typography variant="body2" color="textSecondary" fontFamily="monospace">
                              {item.sku}
                            </Typography>
                          </Box>
                        </TableCell>
                        
                        <TableCell align="center">
                          <Typography variant="h6">
                            {item.currentStock}
                          </Typography>
                        </TableCell>
                        
                        <TableCell align="center">
                          <Typography variant="body2">
                            {item.minStockLevel}
                          </Typography>
                        </TableCell>
                        
                        <TableCell align="center">
                          <Box sx={{ width: '100%' }}>
                            <Chip
                              label={statusText}
                              color={statusColor as any}
                              size="small"
                              sx={{ mb: 1 }}
                            />
                            <LinearProgress
                              variant="determinate"
                              value={stockPercentage}
                              color={statusColor as any}
                              sx={{ height: 6, borderRadius: 3 }}
                            />
                          </Box>
                        </TableCell>
                        
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {item.movementType === 'in' ? (
                              <ArrowUpIcon color="success" fontSize="small" sx={{ mr: 0.5 }} />
                            ) : (
                              <ArrowDownIcon color="error" fontSize="small" sx={{ mr: 0.5 }} />
                            )}
                            <Typography variant="body2">
                              {item.movementQty} units
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="textSecondary">
                            {item.lastMovement}
                          </Typography>
                        </TableCell>
                        
                        <TableCell align="right">
                          <Typography variant="body1" fontWeight="medium">
                            {item.stockValue.toLocaleString()} MAD
                          </Typography>
                        </TableCell>
                        
                        <TableCell align="center">
                          <Tooltip title="Adjust Stock">
                            <IconButton 
                              size="small"
                              onClick={() => handleAdjustStock(item)}
                              disabled={!hasPermission(['admin', 'manager'])}
                            >
                              <InventoryIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          
                          <Tooltip title="View Movements">
                            <IconButton 
                              size="small"
                              onClick={() => navigate(`/inventory/stock/movements/${item.id}`)}
                            >
                              <TrendingUpIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>

        {/* Right Column: Stock Alerts */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                Stock Alerts
              </Typography>
              <Chip label={alerts.length} color="error" size="small" />
            </Box>

            <Divider />

            <Box sx={{ p: 2 }}>
              {alerts.length === 0 ? (
                <Alert severity="success">
                  No active stock alerts
                </Alert>
              ) : (
                alerts.map((alert) => (
                  <Alert
                    key={alert.id}
                    severity={alert.alertType === 'out_of_stock' ? 'error' : 'warning'}
                    sx={{ mb: 2 }}
                    action={
                      hasPermission(['admin', 'manager']) && (
                        <Button
                          color="inherit"
                          size="small"
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                        >
                          ACKNOWLEDGE
                        </Button>
                      )
                    }
                  >
                    <Typography variant="body2" fontWeight="medium">
                      {alert.productName}
                    </Typography>
                    <Typography variant="body2">
                      {alert.alertType === 'out_of_stock' 
                        ? 'Out of stock' 
                        : `Low stock: ${alert.currentLevel} / ${alert.threshold}`}
                    </Typography>
                    <Typography variant="caption" display="block">
                      Triggered: {alert.triggered}
                    </Typography>
                  </Alert>
                ))
              )}
            </Box>

            {/* Quick Actions */}
            <Box sx={{ p: 2, bgcolor: 'grey.50', borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" gutterBottom>
                Quick Actions
              </Typography>
              
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    onClick={() => navigate('/inventory/products/low-stock')}
                  >
                    View Low Stock
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    onClick={() => navigate('/inventory/reports/stock')}
                  >
                    Stock Report
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* Stock Adjustment Dialog */}
      <Dialog open={adjustDialogOpen} onClose={() => setAdjustDialogOpen(false)}>
        <DialogTitle>
          Adjust Stock: {selectedProduct?.productName}
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Adjustment Quantity"
              type="number"
              value={adjustmentQty}
              onChange={(e) => setAdjustmentQty(e.target.value)}
              placeholder="Positive to add, negative to remove"
              helperText={`Current stock: ${selectedProduct?.currentStock || 0}`}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Reason for Adjustment"
              multiline
              rows={3}
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              placeholder="Enter reason for stock adjustment..."
            />
            
            {selectedProduct && adjustmentQty && (
              <Alert severity="info" sx={{ mt: 2 }}>
                New stock level will be: {selectedProduct.currentStock + parseInt(adjustmentQty)}
              </Alert>
            )}
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setAdjustDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleConfirmAdjustment}
            disabled={!adjustmentQty || !adjustmentReason}
          >
            Confirm Adjustment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StockLevelView;