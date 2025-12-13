import React, { useState, useEffect } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Chip,
  Paper,
  Alert,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  Warning as WarningIcon,
  CreditCard as CreditCardIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { Customer, CustomerBalance } from '@bms/core';

interface CustomerPickerProps {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
  onAddNew?: () => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  showCreditInfo?: boolean;
  balance?: CustomerBalance | null;
  creditLimit?: number;
  requireCreditCheck?: boolean;
}

interface CustomerOption extends Customer {
  creditStatus?: 'good' | 'warning' | 'over_limit' | 'no_limit';
  availableCredit?: number;
  creditUtilization?: number;
}

const CustomerPicker: React.FC<CustomerPickerProps> = ({
  value,
  onChange,
  onAddNew,
  disabled = false,
  loading = false,
  error,
  showCreditInfo = true,
  balance,
  creditLimit,
  requireCreditCheck = false,
}) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Mock customer data - in real app, this would come from API
  const mockCustomers: CustomerOption[] = [
    {
      id: '1',
      name: 'John Doe',
      phone: '+212 611-223344',
      email: 'john@example.com',
      company: 'Tech Solutions Inc.',
      creditStatus: 'good',
      availableCredit: 5000,
      creditUtilization: 30,
    },
    {
      id: '2',
      name: 'Jane Smith',
      phone: '+212 622-334455',
      email: 'jane@example.com',
      creditStatus: 'warning',
      availableCredit: 1000,
      creditUtilization: 85,
    },
    {
      id: '3',
      name: 'Acme Corporation',
      phone: '+212 633-445566',
      email: 'contact@acme.com',
      company: 'Acme Corp',
      creditStatus: 'over_limit',
      availableCredit: -500,
      creditUtilization: 110,
    },
    {
      id: '4',
      name: 'Mohammed Ali',
      phone: '+212 644-556677',
      creditStatus: 'no_limit',
    },
  ];

  // Simulate API search
  const searchCustomers = async (searchTerm: string): Promise<CustomerOption[]> => {
    if (!searchTerm.trim()) return [];
    
    setIsSearching(true);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const filtered = mockCustomers.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone.includes(searchTerm) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.company?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    setIsSearching(false);
    return filtered;
  };

  // Handle input changes
  useEffect(() => {
    if (inputValue.length >= 2) {
      searchCustomers(inputValue).then(setOptions);
    } else {
      setOptions([]);
    }
  }, [inputValue]);

  // Get credit status color
  const getCreditStatusColor = (status?: string) => {
    switch (status) {
      case 'good': return 'success';
      case 'warning': return 'warning';
      case 'over_limit': return 'error';
      case 'no_limit': return 'info';
      default: return 'default';
    }
  };

  // Get credit status text
  const getCreditStatusText = (customer: CustomerOption) => {
    if (!customer.creditStatus) return 'No credit info';
    
    switch (customer.creditStatus) {
      case 'good': return 'Good credit';
      case 'warning': return 'Near limit';
      case 'over_limit': return 'Over limit';
      case 'no_limit': return 'No limit set';
      default: return 'Unknown';
    }
  };

  // Get credit status icon
  const getCreditStatusIcon = (status?: string) => {
    switch (status) {
      case 'good': return null;
      case 'warning': return <WarningIcon fontSize="small" />;
      case 'over_limit': return <WarningIcon fontSize="small" />;
      case 'no_limit': return <CreditCardIcon fontSize="small" />;
      default: return null;
    }
  };

  // Render option in dropdown
  const renderOption = (props: React.HTMLAttributes<HTMLLIElement>, option: CustomerOption) => (
    <li {...props}>
      <Box sx={{ width: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body1" fontWeight="medium">
              {option.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <PhoneIcon fontSize="small" sx={{ color: 'action.active' }} />
              <Typography variant="body2" color="text.secondary">
                {option.phone}
              </Typography>
            </Box>
            {option.email && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmailIcon fontSize="small" sx={{ color: 'action.active' }} />
                <Typography variant="body2" color="text.secondary">
                  {option.email}
                </Typography>
              </Box>
            )}
            {option.company && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BusinessIcon fontSize="small" sx={{ color: 'action.active' }} />
                <Typography variant="body2" color="text.secondary">
                  {option.company}
                </Typography>
              </Box>
            )}
          </Box>
          
          {showCreditInfo && option.creditStatus && (
            <Chip
              size="small"
              label={getCreditStatusText(option)}
              color={getCreditStatusColor(option.creditStatus)}
              icon={getCreditStatusIcon(option.creditStatus)}
              variant="outlined"
            />
          )}
        </Box>
        
        {showCreditInfo && option.availableCredit !== undefined && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Available credit:{' '}
              <Typography
                component="span"
                variant="caption"
                fontWeight="medium"
                color={option.availableCredit >= 0 ? 'success.main' : 'error.main'}
              >
                {option.availableCredit >= 0 ? '+' : ''}{option.availableCredit.toFixed(2)} MAD
              </Typography>
              {option.creditUtilization && (
                <>
                  {' • '}
                  <Typography component="span" variant="caption" color="text.secondary">
                    {option.creditUtilization}% utilized
                  </Typography>
                </>
              )}
            </Typography>
          </Box>
        )}
      </Box>
    </li>
  );

  // Render selected value
  const renderSelectedValue = (selected: CustomerOption) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <PersonIcon fontSize="small" />
      <Box>
        <Typography variant="body2" fontWeight="medium">
          {selected.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {selected.phone}
          {selected.company && ` • ${selected.company}`}
        </Typography>
      </Box>
    </Box>
  );

  // Handle customer selection
  const handleCustomerSelect = (event: React.SyntheticEvent, newValue: CustomerOption | null) => {
    onChange(newValue);
    
    // Check credit status if required
    if (requireCreditCheck && newValue?.creditStatus === 'over_limit') {
      // In real app, this would trigger a warning or require manager approval
      console.warn('Customer is over credit limit. Manager approval may be required.');
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Customer Selection */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <Autocomplete
          sx={{ flexGrow: 1 }}
          open={open}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          value={value}
          onChange={handleCustomerSelect}
          inputValue={inputValue}
          onInputChange={(event, newInputValue) => setInputValue(newInputValue)}
          options={options}
          loading={isSearching || loading}
          disabled={disabled}
          getOptionLabel={(option) => option.name}
          renderOption={renderOption}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Customer"
              placeholder="Search by name, phone, or email..."
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {isSearching || loading ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          PaperComponent={({ children, ...paperProps }) => (
            <Paper {...paperProps}>
              {children}
              {onAddNew && (
                <>
                  <Divider />
                  <Box
                    sx={{
                      p: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                    onClick={onAddNew}
                  >
                    <AddIcon fontSize="small" color="primary" />
                    <Typography variant="body2" color="primary">
                      Add New Customer
                    </Typography>
                  </Box>
                </>
              )}
            </Paper>
          )}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          noOptionsText={
            inputValue.length >= 2 ? 'No customers found' : 'Start typing to search customers...'
          }
        />
        
        {/* Refresh Button */}
        <Tooltip title="Refresh customer list">
          <IconButton
            size="small"
            onClick={() => {
              if (inputValue.length >= 2) {
                searchCustomers(inputValue).then(setOptions);
              }
            }}
            disabled={disabled || isSearching}
            sx={{ mt: 0.5 }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Selected Customer Details */}
      {value && (
        <Box sx={{ mt: 2 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Selected Customer Details
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PersonIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    <strong>Name:</strong> {value.name}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <PhoneIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    <strong>Phone:</strong> {value.phone}
                  </Typography>
                </Box>
                {value.email && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <EmailIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      <strong>Email:</strong> {value.email}
                    </Typography>
                  </Box>
                )}
              </Grid>
              
              {showCreditInfo && balance && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ 
                    p: 1.5, 
                    bgcolor: 'background.default', 
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                      Credit Information
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">
                        Current Balance:
                      </Typography>
                      <Typography 
                        variant="body2" 
                        fontWeight="medium"
                        color={balance.currentBalance >= 0 ? 'success.main' : 'error.main'}
                      >
                        {balance.currentBalance >= 0 ? '+' : ''}{balance.currentBalance.toFixed(2)} MAD
                      </Typography>
                    </Box>
                    {creditLimit && (
                      <>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                          <Typography variant="body2">
                            Credit Limit:
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {creditLimit.toFixed(2)} MAD
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                          <Typography variant="body2">
                            Available Credit:
                          </Typography>
                          <Typography 
                            variant="body2" 
                            fontWeight="medium"
                            color={(creditLimit - balance.currentBalance) >= 0 ? 'success.main' : 'error.main'}
                          >
                            {(creditLimit - balance.currentBalance).toFixed(2)} MAD
                          </Typography>
                        </Box>
                      </>
                    )}
                  </Box>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Box>
      )}

      {/* Credit Limit Warning */}
      {value && requireCreditCheck && balance && creditLimit && balance.currentBalance > creditLimit && (
        <Alert 
          severity="error" 
          icon={<WarningIcon />}
          sx={{ mt: 2 }}
        >
          <Typography variant="body2">
            <strong>Warning:</strong> This customer has exceeded their credit limit by{' '}
            {(balance.currentBalance - creditLimit).toFixed(2)} MAD.
            {requireCreditCheck && ' Manager approval is required for new sales.'}
          </Typography>
        </Alert>
      )}

      {/* Credit Limit Warning (near limit) */}
      {value && balance && creditLimit && 
       balance.currentBalance <= creditLimit && 
       balance.currentBalance > creditLimit * 0.8 && (
        <Alert 
          severity="warning" 
          icon={<WarningIcon />}
          sx={{ mt: 2 }}
        >
          <Typography variant="body2">
            <strong>Note:</strong> This customer is near their credit limit (
            {((balance.currentBalance / creditLimit) * 100).toFixed(1)}% utilized).
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

// Need to import Grid for the credit info section
import { Grid } from '@mui/material';

export default CustomerPicker; 
