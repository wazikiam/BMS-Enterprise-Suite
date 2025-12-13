import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  Grid,
  Alert,
  IconButton,
  Tooltip,
  CircularProgress,
  Divider,
  Switch,
  FormControlLabel,
  Chip,
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Business as BusinessIcon,
  AssignmentInd as TaxIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Validation schema - name and phone required only
const walkinCustomerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().min(8, 'Phone number is required').max(20),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().max(200).optional().or(z.literal('')),
  company: z.string().max(100).optional().or(z.literal('')),
  taxId: z.string().max(50).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  createPermanent: z.boolean().default(false),
});

type WalkinCustomerFormData = z.infer<typeof walkinCustomerSchema>;

interface WalkinCustomerFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: WalkinCustomerFormData) => Promise<{ id: string; isTemporary: boolean }>;
  onQuickSale?: (customerId: string) => void;
  loading?: boolean;
  existingTemporaryId?: string;
}

const WalkinCustomerForm: React.FC<WalkinCustomerFormProps> = ({
  open,
  onClose,
  onSubmit,
  onQuickSale,
  loading = false,
  existingTemporaryId,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; isTemporary: boolean } | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'success'>('create');

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<WalkinCustomerFormData>({
    resolver: zodResolver(walkinCustomerSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      address: '',
      company: '',
      taxId: '',
      notes: '',
      createPermanent: false,
    },
  });

  const createPermanent = watch('createPermanent');

  const handleFormSubmit = async (data: WalkinCustomerFormData) => {
    try {
      setError(null);
      const result = await onSubmit(data);
      setSuccess(result);
      setFormMode('success');
      
      // If we have onQuickSale callback, call it after a delay
      if (onQuickSale && !data.createPermanent) {
        setTimeout(() => {
          onQuickSale(result.id);
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customer');
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    setSuccess(null);
    setFormMode('create');
    onClose();
  };

  const handleCreateAnother = () => {
    reset();
    setSuccess(null);
    setError(null);
    setFormMode('create');
  };

  // Generate a temporary ID for display
  const generateTemporaryId = () => {
    return `TEMP-${Date.now().toString().slice(-6)}`;
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        bgcolor: 'primary.main',
        color: 'white',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonAddIcon />
          <Typography variant="h6">
            {existingTemporaryId ? 'Complete Walk-in Customer' : 'New Walk-in Customer'}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {formMode === 'create' ? (
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <DialogContent sx={{ pt: 3 }}>
            {existingTemporaryId && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Completing temporary customer: <strong>{existingTemporaryId}</strong>
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Quick Walk-in Registration:</strong> Only name and phone are required.
                Other fields are optional and can be added later.
              </Typography>
            </Alert>

            <Grid container spacing={2}>
              {/* Required Fields */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="primary" gutterBottom>
                  Required Information
                </Typography>
              </Grid>

              {/* Name */}
              <Grid item xs={12} md={6}>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Customer Name"
                      fullWidth
                      required
                      error={!!errors.name}
                      helperText={errors.name?.message}
                      InputProps={{
                        startAdornment: (
                          <PersonIcon sx={{ mr: 1, color: 'action.active' }} />
                        ),
                      }}
                      placeholder="Enter full name"
                    />
                  )}
                />
              </Grid>

              {/* Phone */}
              <Grid item xs={12} md={6}>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Phone Number"
                      fullWidth
                      required
                      error={!!errors.phone}
                      helperText={errors.phone?.message}
                      InputProps={{
                        startAdornment: (
                          <PhoneIcon sx={{ mr: 1, color: 'action.active' }} />
                        ),
                      }}
                      placeholder="e.g., +212 6XX-XXXXXX"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Optional Information
                </Typography>
              </Grid>

              {/* Email */}
              <Grid item xs={12} md={6}>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Email Address"
                      type="email"
                      fullWidth
                      error={!!errors.email}
                      helperText={errors.email?.message}
                      InputProps={{
                        startAdornment: (
                          <EmailIcon sx={{ mr: 1, color: 'action.active' }} />
                        ),
                      }}
                      placeholder="optional@email.com"
                    />
                  )}
                />
              </Grid>

              {/* Company */}
              <Grid item xs={12} md={6}>
                <Controller
                  name="company"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Company"
                      fullWidth
                      error={!!errors.company}
                      helperText={errors.company?.message}
                      InputProps={{
                        startAdornment: (
                          <BusinessIcon sx={{ mr: 1, color: 'action.active' }} />
                        ),
                      }}
                      placeholder="Optional company name"
                    />
                  )}
                />
              </Grid>

              {/* Address */}
              <Grid item xs={12}>
                <Controller
                  name="address"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Address"
                      fullWidth
                      multiline
                      rows={2}
                      error={!!errors.address}
                      helperText={errors.address?.message}
                      InputProps={{
                        startAdornment: (
                          <LocationIcon sx={{ mr: 1, color: 'action.active', alignSelf: 'flex-start', mt: 1 }} />
                        ),
                      }}
                      placeholder="Optional address details"
                    />
                  )}
                />
              </Grid>

              {/* Tax ID */}
              <Grid item xs={12} md={6}>
                <Controller
                  name="taxId"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Tax ID"
                      fullWidth
                      error={!!errors.taxId}
                      helperText={errors.taxId?.message}
                      InputProps={{
                        startAdornment: (
                          <TaxIcon sx={{ mr: 1, color: 'action.active' }} />
                        ),
                      }}
                      placeholder="Optional tax identification"
                    />
                  )}
                />
              </Grid>

              {/* Notes */}
              <Grid item xs={12} md={6}>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Notes"
                      fullWidth
                      multiline
                      rows={2}
                      error={!!errors.notes}
                      helperText={errors.notes?.message}
                      placeholder="Additional notes or remarks"
                    />
                  )}
                />
              </Grid>

              {/* Permanent Customer Toggle */}
              <Grid item xs={12}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'background.default', 
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider'
                }}>
                  <Controller
                    name="createPermanent"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={field.value}
                            onChange={field.onChange}
                            color="primary"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              Create as Permanent Customer
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {createPermanent 
                                ? 'Customer will be added to the main database with full profile'
                                : 'Customer will be created as temporary for this sale only'
                              }
                            </Typography>
                          </Box>
                        }
                      />
                    )}
                  />
                </Box>
              </Grid>

              {/* Preview */}
              <Grid item xs={12}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'info.50', 
                  borderRadius: 1,
                  border: '1px dashed',
                  borderColor: 'info.main'
                }}>
                  <Typography variant="subtitle2" color="info.main" gutterBottom>
                    Customer Preview
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Type:
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Chip
                        size="small"
                        label={createPermanent ? 'Permanent' : 'Temporary'}
                        color={createPermanent ? 'success' : 'warning'}
                        variant="outlined"
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Temporary ID:
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" fontFamily="monospace">
                        {generateTemporaryId()}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              {loading ? 'Creating...' : 'Create Customer'}
            </Button>
          </DialogActions>
        </form>
      ) : (
        /* Success Mode */
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          <Box sx={{ mb: 3 }}>
            <PersonAddIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom color="success.main">
              Customer Created Successfully!
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {success?.isTemporary 
                ? 'Temporary customer created for this sale. They can be converted to permanent later.'
                : 'Permanent customer added to your database.'
              }
            </Typography>
          </Box>

          <Box sx={{ 
            p: 3, 
            bgcolor: 'background.default', 
            borderRadius: 2,
            mb: 3,
            textAlign: 'left'
          }}>
            <Typography variant="subtitle2" gutterBottom>
              Customer Details
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Customer ID:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" fontWeight="medium" fontFamily="monospace">
                  {success?.id}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Type:
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Chip
                  size="small"
                  label={success?.isTemporary ? 'Temporary' : 'Permanent'}
                  color={success?.isTemporary ? 'warning' : 'success'}
                />
              </Grid>
              {!success?.isTemporary && (
                <>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Status:
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Chip
                      size="small"
                      label="Active"
                      color="success"
                      variant="outlined"
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </Box>

          {success?.isTemporary && onQuickSale && (
            <Alert severity="info" sx={{ mb: 3 }}>
              You can now proceed to create a quick sale for this customer.
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="outlined"
              onClick={handleCreateAnother}
            >
              Create Another
            </Button>
            {success?.isTemporary && onQuickSale && (
              <Button
                variant="contained"
                onClick={() => onQuickSale(success.id)}
              >
                Start Quick Sale
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleClose}
            >
              Done
            </Button>
          </Box>
        </DialogContent>
      )}
    </Dialog>
  );
};

export default WalkinCustomerForm;