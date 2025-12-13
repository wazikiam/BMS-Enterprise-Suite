/**
 * Product List Component
 * Displays list of products with filtering and pagination
 * 
 * BUSINESS RULES:
 * - Display 2000+ products efficiently
 * - Fast search with category filtering
 * - Low stock highlighting
 * - Bulk operations
 * 
 * DESIGN RULES:
 * - Odoo-inspired table layout
 * - Material-UI components
 * - Responsive design
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
  Paper
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/useAuth';

// Mock data for development
const mockProducts = [
  { id: '1', sku: 'PROD-001', name: 'Laptop Dell XPS 15', category: 'Electronics > Computers', currentStock: 25, minStockLevel: 10, costPrice: 15000, sellingPrice: 20000, isActive: true },
  { id: '2', sku: 'PROD-002', name: 'iPhone 15 Pro', category: 'Electronics > Phones', currentStock: 5, minStockLevel: 15, costPrice: 12000, sellingPrice: 18000, isActive: true },
  { id: '3', sku: 'PROD-003', name: 'Office Chair', category: 'Furniture > Office', currentStock: 50, minStockLevel: 20, costPrice: 2500, sellingPrice: 4500, isActive: true },
];

const ProductList: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  
  const [products, setProducts] = useState(mockProducts);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');

  // Handle pagination
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || product.category.includes(categoryFilter);
    
    const matchesStock = stockFilter === 'all' ||
                        (stockFilter === 'low' && product.currentStock <= product.minStockLevel) ||
                        (stockFilter === 'out' && product.currentStock === 0) ||
                        (stockFilter === 'in' && product.currentStock > 0);
    
    return matchesSearch && matchesCategory && matchesStock;
  });

  // Paginate products
  const paginatedProducts = filteredProducts.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Get unique categories for filter
  const categories = ['all', 'Electronics', 'Furniture'];

  // Calculate inventory value
  const totalInventoryValue = products.reduce((sum, product) => {
    return sum + (product.costPrice * product.currentStock);
  }, 0);

  return (
    <Box>
      {/* Header with KPIs */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="textSecondary">
              Total Products
            </Typography>
            <Typography variant="h4" sx={{ mt: 1 }}>
              {products.length}
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="textSecondary">
              Low Stock
            </Typography>
            <Typography variant="h4" sx={{ mt: 1, color: 'warning.main' }}>
              {products.filter(p => p.currentStock <= p.minStockLevel).length}
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="textSecondary">
              Out of Stock
            </Typography>
            <Typography variant="h4" sx={{ mt: 1, color: 'error.main' }}>
              {products.filter(p => p.currentStock === 0).length}
            </Typography>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="textSecondary">
              Inventory Value
            </Typography>
            <Typography variant="h4" sx={{ mt: 1, color: 'success.main' }}>
              {totalInventoryValue.toLocaleString()} MAD
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
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
              size="small"
            />
          </Grid>
          
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                label="Category"
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <MenuItem value="all">All Categories</MenuItem>
                {categories.filter(c => c !== 'all').map(category => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Stock</InputLabel>
              <Select
                value={stockFilter}
                label="Stock"
                onChange={(e) => setStockFilter(e.target.value)}
              >
                <MenuItem value="all">All Stock</MenuItem>
                <MenuItem value="low">Low Stock</MenuItem>
                <MenuItem value="out">Out of Stock</MenuItem>
                <MenuItem value="in">In Stock</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={4} sx={{ textAlign: 'right' }}>
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              sx={{ mr: 1 }}
            >
              Filters
            </Button>
            
            {hasPermission(['admin', 'manager']) && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => navigate('/inventory/products/new')}
              >
                New Product
              </Button>
            )}
          </Grid>
        </Grid>
      </Card>

      {/* Products Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>SKU</TableCell>
                <TableCell>Product Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Cost Price</TableCell>
                <TableCell align="right">Selling Price</TableCell>
                <TableCell align="center">Stock</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedProducts.map((product) => (
                <TableRow 
                  key={product.id}
                  hover
                  sx={{ 
                    '&:hover': { backgroundColor: 'action.hover' },
                    backgroundColor: product.currentStock === 0 ? 'error.light' :
                                   product.currentStock <= product.minStockLevel ? 'warning.light' : 'inherit'
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {product.sku}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {product.name}
                    </Typography>
                  </TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell align="right">
                    {product.costPrice.toLocaleString()} MAD
                  </TableCell>
                  <TableCell align="right">
                    {product.sellingPrice.toLocaleString()} MAD
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body1" sx={{ mr: 1 }}>
                        {product.currentStock}
                      </Typography>
                      {product.currentStock <= product.minStockLevel && (
                        <Tooltip title="Low stock">
                          <WarningIcon fontSize="small" color="warning" />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={product.isActive ? 'Active' : 'Inactive'}
                      color={product.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="View Details">
                      <IconButton size="small" onClick={() => navigate(`/inventory/products/${product.id}`)}>
                        <InventoryIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    
                    {hasPermission(['admin', 'manager']) && (
                      <>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => navigate(`/inventory/products/${product.id}/edit`)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        
                        {hasPermission(['admin']) && (
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={filteredProducts.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Card>

      {/* Bulk Actions Bar */}
      {hasPermission(['admin', 'manager']) && (
        <Paper sx={{ mt: 2, p: 2, display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="textSecondary">
            {filteredProducts.length} products found
          </Typography>
          <Box>
            <Button size="small" sx={{ mr: 1 }}>
              Export CSV
            </Button>
            <Button size="small" color="primary">
              Bulk Update
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default ProductList; 
