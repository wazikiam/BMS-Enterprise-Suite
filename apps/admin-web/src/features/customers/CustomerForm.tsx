// apps/admin-web/src/features/customers/CustomerForm.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Grid,
  TextField,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Divider,
  FormHelperText,
  Autocomplete,
  Tooltip,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Customer, CustomerType, CustomerStatus } from '../../../../packages/core/src/domain/Customer';
import { useCustomers } from '../hooks/useCustomers';
import { hasPermission } from '../../../utils/hasPermission';
import PhoneInput from '../../../components/form/PhoneInput';
import AddressForm from '../components/AddressForm';
import ContactForm from '../components/ContactForm';
import CreditLimitForm from './credit/CreditLimitForm';

interface CustomerFormProps {
  customer?: Customer;
  mode?: 'create' | 'edit';
  onSuccess?: (customer: Customer) => void;
  onCancel?: () => void;
  compact?: boolean;
}

const CustomerForm: React.FC<CustomerFormProps> = ({
  customer,
  mode = 'create',
  onSuccess,
  onCancel,
  compact = false
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { createCustomer, updateCustomer, loading, error } = useCustomers();
  
  const [activeStep, setActiveStep] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tags, setTags] = useState<string[]>(customer?.tags || []);
  const [tagInput, setTagInput] = useState('');
  
  // Form validation schema
  const validationSchema = Yup.object({
    name: Yup.string()
      .required('Name is required')
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name must not exceed 100 characters'),
    
    phone: Yup.string()
      .required('Phone is required')
      .matches(/^(?:\+212|0)([5-7]\d{8})$/, 'Invalid Moroccan phone number format'),
    
    email: Yup.string()
      .optional()
      .email('Invalid email format'),
    
    type: Yup.string()
      .oneOf(Object.values(CustomerType))
      .required('Customer type is required'),
    
    taxId: Yup.string()
      .optional()
      .matches(/^[A-Z0-9\-]+$/, 'Invalid tax ID format'),
    
    companyName: Yup.string()
      .optional()
      .max(200, 'Company name must not exceed 200 characters'),
    
    creditLimit: Yup.number()
      .optional()
      .min(0, 'Credit limit cannot be negative')
      .max(1000000, 'Credit limit cannot exceed 1,000,000'),
    
    status: Yup.string()
      .oneOf(Object.values(CustomerStatus))
      .required('Status is required'),
    
    notes: Yup.string()
      .optional()
      .max(1000, 'Notes must not exceed 1000 characters')
  });

  // Initialize formik
  const formik = useFormik({
    initialValues: {
      name: customer?.name || '',
      phone: customer?.phone || '',
      email: customer?.email || '',
      type: customer?.type || CustomerType.INDIVIDUAL,
      taxId: customer?.taxId || '',
      companyName: customer?.companyName || '',
      creditLimit: customer?.creditLimit || undefined,
      status: customer?.status || CustomerStatus.ACTIVE,
      notes: customer?.notes || '',
      assignedSellerId: customer?.assignedSellerId || '',
      segmentId: customer?.segmentId || ''
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        const customerData = {
          ...values,
          tags,
          creditLimit: values.creditLimit || undefined
        };

        let result;
        if (mode === 'create') {
          result = await createCustomer(customerData);
        } else {
          if (!customer?.id) return;
          result = await updateCustomer(customer.id, customerData);
        }

        if (onSuccess) {
          onSuccess(result);
        } else {
          navigate(`/customers/${result.id}`);
        }
      } catch (error) {
        console.error('Error saving customer:', error);
      }
    }
  });

  // Handle tag management
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddTag();
    }
  };

  // Steps for the form
  const steps = ['Basic Information', 'Contact Details', 'Additional Information', 'Review & Save'];
  
  const handleNext = () => {
    // Validate current step before proceeding
    const currentStepFields = getStepFields(activeStep);
    const errors = currentStepFields
      .map(field => formik.errors[field as keyof typeof formik.errors])
      .filter(error => error);
    
    if (errors.length === 0) {
      setActiveStep((prevStep) => prevStep + 1);
    } else {
      // Trigger validation for current step
      currentStepFields.forEach(field => {
        formik.setFieldTouched(field, true);
      });
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const getStepFields = (step: number): string[] => {
    switch (step) {
      case 0: return ['name', 'phone', 'type', 'companyName'];
      case 1: return ['email', 'taxId'];
      case 2: return ['creditLimit', 'status'];
      default: return [];
    }
  };

  // Check permissions
  const canEdit = hasPermission('customers', 'update');
  const canCreate = hasPermission('customers', 'create');
  
  if (mode === 'edit' && !canEdit) {
    return (
      <Alert severity="error">
        You don't have permission to edit customers.
      </Alert>
    );
  }

  if (mode === 'create' && !canCreate) {
    return (
      <Alert severity="error">
        You don't have permission to create customers.
      </Alert>
    );
  }

  const isIndividual = formik.values.type === CustomerType.INDIVIDUAL;
  const isCompany = formik.values.type === CustomerType.COMPANY;
  const isTemporary = formik.values.type === CustomerType.TEMPORARY;

  return (
    <Paper elevation={2} sx={{ p: compact ? 2 : 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          {mode === 'create' ? 'Create New Customer' : 'Edit Customer'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {mode === 'create' 
            ? 'Fill in the customer information below. Name and phone are required.' 
            : 'Update the customer information as needed.'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error.message}
        </Alert>
      )}

      {/* Stepper for multi-step form */}
      {!compact && (
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      )}

      <form onSubmit={formik.handleSubmit}>
        <Grid container spacing={3}>
          {/* Step 1: Basic Information */}
          {(activeStep === 0 || compact) && (
            <>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="name"
                  label="Full Name *"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.name && Boolean(formik.errors.name)}
                  helperText={formik.touched.name && formik.errors.name}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <PhoneInput
                  fullWidth
                  name="phone"
                  label="Phone Number *"
                  value={formik.values.phone}
                  onChange={(value) => formik.setFieldValue('phone', value)}
                  onBlur={formik.handleBlur}
                  error={formik.touched.phone && Boolean(formik.errors.phone)}
                  helperText={formik.touched.phone && formik.errors.phone}
                  disabled={loading}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={formik.touched.type && Boolean(formik.errors.type)}>
                  <InputLabel>Customer Type *</InputLabel>
                  <Select
                    name="type"
                    value={formik.values.type}
                    label="Customer Type *"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    disabled={loading}
                  >
                    <MenuItem value={CustomerType.INDIVIDUAL}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <PersonIcon fontSize="small" />
                        Individual
                      </Box>
                    </MenuItem>
                    <MenuItem value={CustomerType.COMPANY}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <BusinessIcon fontSize="small" />
                        Company
                      </Box>
                    </MenuItem>
                    <MenuItem value={CustomerType.TEMPORARY}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <PersonIcon fontSize="small" />
                        Temporary/Walk-in
                      </Box>
                    </MenuItem>
                  </Select>
                  {formik.touched.type && formik.errors.type && (
                    <FormHelperText>{formik.errors.type}</FormHelperText>
                  )}
                </FormControl>
              </Grid>

              {isCompany && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    name="companyName"
                    label="Company Name"
                    value={formik.values.companyName}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.companyName && Boolean(formik.errors.companyName)}
                    helperText={formik.touched.companyName && formik.errors.companyName}
                    disabled={loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <BusinessIcon color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              )}

              {isTemporary && (
                <Grid item xs={12}>
                  <Alert severity="info" icon={<InfoIcon />}>
                    Temporary customers are created for walk-in sales and can be converted to regular customers later.
                  </Alert>
                </Grid>
              )}
            </>
          )}

          {/* Step 2: Contact Details */}
          {(activeStep === 1 || compact) && (
            <>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="email"
                  label="Email Address"
                  type="email"
                  value={formik.values.email}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.email && Boolean(formik.errors.email)}
                  helperText={formik.touched.email && formik.errors.email}
                  disabled={loading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="taxId"
                  label="Tax ID / ICE"
                  value={formik.values.taxId}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.taxId && Boolean(formik.errors.taxId)}
                  helperText={formik.touched.taxId && formik.errors.taxId}
                  disabled={loading}
                />
              </Grid>

              {/* Tags input */}
              <Grid item xs={12}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Tags
                  </Typography>
                  <Box display="flex" gap={1} mb={1}>
                    <TextField
                      size="small"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Add a tag"
                      disabled={loading}
                      sx={{ flexGrow: 1 }}
                    />
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={handleAddTag}
                      disabled={!tagInput.trim() || loading}
                    >
                      Add
                    </Button>
                  </Box>
                  <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        onDelete={() => handleRemoveTag(tag)}
                        disabled={loading}
                      />
                    ))}
                  </Box>
                </Box>
              </Grid>
            </>
          )}

          {/* Step 3: Additional Information */}
          {(activeStep === 2 || compact) && (
            <>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  name="creditLimit"
                  label="Credit Limit (MAD)"
                  type="number"
                  value={formik.values.creditLimit || ''}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.creditLimit && Boolean(formik.errors.creditLimit)}
                  helperText={formik.touched.creditLimit && formik.errors.creditLimit}
                  disabled={loading}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">MAD</InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth error={formik.touched.status && Boolean(formik.errors.status)}>
                  <InputLabel>Status *</InputLabel>
                  <Select
                    name="status"
                    value={formik.values.status}
                    label="Status *"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    disabled={loading || mode === 'create'}
                  >
                    <MenuItem value={CustomerStatus.ACTIVE}>Active</MenuItem>
                    <MenuItem value={CustomerStatus.INACTIVE}>Inactive</MenuItem>
                    <MenuItem value={CustomerStatus.BLOCKED}>Blocked</MenuItem>
                  </Select>
                  {formik.touched.status && formik.errors.status && (
                    <FormHelperText>{formik.errors.status}</FormHelperText>
                  )}
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="notes"
                  label="Notes"
                  value={formik.values.notes}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.notes && Boolean(formik.errors.notes)}
                  helperText={`${formik.values.notes.length}/1000`}
                  disabled={loading}
                  multiline
                  rows={3}
                />
              </Grid>

              {/* Advanced options accordion */}
              {!compact && (
                <Grid item xs={12}>
                  <Accordion expanded={showAdvanced} onChange={() => setShowAdvanced(!showAdvanced)}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1">
                        Advanced Options
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            name="assignedSellerId"
                            label="Assigned Seller ID"
                            value={formik.values.assignedSellerId}
                            onChange={formik.handleChange}
                            disabled={loading}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            name="segmentId"
                            label="Segment ID"
                            value={formik.values.segmentId}
                            onChange={formik.handleChange}
                            disabled={loading}
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
              )}
            </>
          )}

          {/* Step 4: Review & Save */}
          {activeStep === 3 && !compact && (
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Review Customer Information
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Name
                      </Typography>
                      <Typography>{formik.values.name}</Typography>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Phone
                      </Typography>
                      <Typography>{formik.values.phone}</Typography>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Type
                      </Typography>
                      <Typography>{formik.values.type}</Typography>
                    </Grid>
                    
                    {formik.values.email && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Email
                        </Typography>
                        <Typography>{formik.values.email}</Typography>
                      </Grid>
                    )}
                    
                    {formik.values.companyName && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Company Name
                        </Typography>
                        <Typography>{formik.values.companyName}</Typography>
                      </Grid>
                    )}
                    
                    {formik.values.creditLimit && (
                      <Grid item xs={12} md={6}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Credit Limit
                        </Typography>
                        <Typography>{formik.values.creditLimit} MAD</Typography>
                      </Grid>
                    )}
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Status
                      </Typography>
                      <Typography>{formik.values.status}</Typography>
                    </Grid>
                    
                    {tags.length > 0 && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Tags
                        </Typography>
                        <Box display="flex" flexWrap="wrap" gap={0.5}>
                          {tags.map(tag => (
                            <Chip key={tag} label={tag} size="small" />
                          ))}
                        </Box>
                      </Grid>
                    )}
                    
                    {formik.values.notes && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" color="text.secondary">
                          Notes
                        </Typography>
                        <Typography variant="body2">{formik.values.notes}</Typography>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Form actions */}
          <Grid item xs={12}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
              <Box>
                {!compact && activeStep > 0 && (
                  <Button
                    onClick={handleBack}
                    disabled={loading}
                  >
                    Back
                  </Button>
                )}
                
                {(onCancel || !compact) && (
                  <Button
                    onClick={onCancel || (() => navigate('/customers'))}
                    disabled={loading}
                    startIcon={<CancelIcon />}
                    sx={{ ml: 1 }}
                  >
                    Cancel
                  </Button>
                )}
              </Box>

              <Box>
                {!compact && activeStep < steps.length - 1 ? (
                  <Button
                    variant="contained"
                    onClick={handleNext}
                    disabled={loading}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading || !formik.isValid}
                    startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                  >
                    {loading ? 'Saving...' : mode === 'create' ? 'Create Customer' : 'Save Changes'}
                  </Button>
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </form>

      {/* Quick help tips */}
      {mode === 'create' && !compact && (
        <Box sx={{ mt: 4, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom display="flex" alignItems="center">
            <InfoIcon fontSize="small" sx={{ mr: 1 }} />
            Quick Tips
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • <strong>Name & Phone</strong> are the only required fields for quick customer creation
            <br />
            • <strong>Temporary customers</strong> are ideal for walk-in sales
            <br />
            • <strong>Credit limits</strong> can be set later from the customer detail page
            <br />
            • Use <strong>tags</strong> to categorize customers for better organization
          </Typography>
        </Box>
      )}

      {/* Credit limit form for editing existing customers */}
      {mode === 'edit' && customer && !compact && (
        <Box sx={{ mt: 4 }}>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Credit Management
          </Typography>
          <CreditLimitForm customerId={customer.id} />
        </Box>
      )}

      {/* Address and contact forms for editing existing customers */}
      {mode === 'edit' && customer && !compact && (
        <>
          <Box sx={{ mt: 4 }}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Addresses
            </Typography>
            <AddressForm customerId={customer.id} />
          </Box>

          <Box sx={{ mt: 4 }}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Contacts
            </Typography>
            <ContactForm customerId={customer.id} />
          </Box>
        </>
      )}
    </Paper>
  );
};

export default CustomerForm; 
