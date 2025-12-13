import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Switch,
  FormControlLabel,
  Grid,
  Alert,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreditLimit } from '@bms/core';

// Validation schema
const creditLimitSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  creditLimit: z.number()
    .min(0, 'Credit limit must be positive')
    .max(1000000, 'Credit limit cannot exceed 1,000,000'),
  warningThreshold: z.number()
    .min(0, 'Warning threshold must be positive')
    .max(100, 'Warning threshold cannot exceed 100%')
    .optional(),
  effectiveDate: z.date(),
  expirationDate: z.date().optional(),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
  requireManagerApproval: z.boolean().default(false),
});

type CreditLimitFormData = z.infer<typeof creditLimitSchema>;

interface CreditLimitFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreditLimitFormData) => Promise<void>;
  customerId?: string;
  existingLimit?: CreditLimit | null;
  currentBalance?: number;
}

const CreditLimitForm: React.FC<CreditLimitFormProps> = ({
  open,
  onClose,
  onSubmit,
  customerId,
  existingLimit,
  currentBalance = 0,
}) => {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<CreditLimitFormData>({
    resolver: zodResolver(creditLimitSchema),
    defaultValues: {
      customerId: customerId || '',
      creditLimit: existingLimit?.creditLimit || 0,
      warningThreshold: existingLimit?.warningThreshold || 80,
      effectiveDate: existingLimit?.effectiveDate || new Date(),
      expirationDate: existingLimit?.expirationDate || undefined,
      notes: existingLimit?.notes || '',
      requireManagerApproval: existingLimit?.requireManagerApproval || false,
    },
  });

  const selectedLimit = watch('creditLimit');
  const warningThreshold = watch('warningThreshold') || 80;

  // Calculate warning amount
  const warningAmount = (selectedLimit * warningThreshold) / 100;

  const handleFormSubmit = async (data: CreditLimitFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Validate that new limit is not below current balance
      if (data.creditLimit < currentBalance) {
        setError(`New credit limit (${data.creditLimit.toFixed(2)}) cannot be less than current balance (${currentBalance.toFixed(2)})`);
        setIsSubmitting(false);
        return;
      }

      await onSubmit(data);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credit limit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    onClose();
  };

  // Mock customer data - in real app, this would come from API
  const customers = [
    { id: '1', name: 'John Doe', email: 'john@example.com' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
    { id: '3', name: 'Acme Corp', email: 'contact@acme.com' },
  ];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {existingLimit ? 'Edit Credit Limit' : 'Set Credit Limit'}
      </DialogTitle>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {currentBalance > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Current customer balance: <strong>{currentBalance.toFixed(2)} MAD</strong>
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Customer Selection */}
            <Grid item xs={12}>
              <Controller
                name="customerId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth error={!!errors.customerId}>
                    <InputLabel>Customer</InputLabel>
                    <Select
                      {...field}
                      label="Customer"
                      disabled={!!customerId}
                    >
                      {customers.map((customer) => (
                        <MenuItem key={customer.id} value={customer.id}>
                          {customer.name} ({customer.email})
                        </MenuItem>
                      ))}
                    </Select>
                    {errors.customerId && (
                      <FormHelperText>{errors.customerId.message}</FormHelperText>
                    )}
                  </FormControl>
                )}
              />
            </Grid>

            {/* Credit Limit */}
            <Grid item xs={12} md={6}>
              <Controller
                name="creditLimit"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Credit Limit (MAD)"
                    type="number"
                    fullWidth
                    error={!!errors.creditLimit}
                    helperText={errors.creditLimit?.message}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                )}
              />
            </Grid>

            {/* Warning Threshold */}
            <Grid item xs={12} md={6}>
              <Controller
                name="warningThreshold"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Warning Threshold (%)"
                    type="number"
                    fullWidth
                    error={!!errors.warningThreshold}
                    helperText={errors.warningThreshold?.message}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 80)}
                    InputProps={{
                      endAdornment: (
                        <Typography variant="caption" color="text.secondary">
                          {warningAmount.toFixed(2)} MAD
                        </Typography>
                      ),
                    }}
                  />
                )}
              />
            </Grid>

            {/* Effective Date */}
            <Grid item xs={12} md={6}>
              <Controller
                name="effectiveDate"
                control={control}
                render={({ field }) => (
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Effective Date"
                      value={field.value}
                      onChange={field.onChange}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !!errors.effectiveDate,
                          helperText: errors.effectiveDate?.message,
                        },
                      }}
                    />
                  </LocalizationProvider>
                )}
              />
            </Grid>

            {/* Expiration Date */}
            <Grid item xs={12} md={6}>
              <Controller
                name="expirationDate"
                control={control}
                render={({ field }) => (
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                      label="Expiration Date (Optional)"
                      value={field.value || null}
                      onChange={field.onChange}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          error: !!errors.expirationDate,
                          helperText: errors.expirationDate?.message,
                        },
                      }}
                    />
                  </LocalizationProvider>
                )}
              />
            </Grid>

            {/* Notes */}
            <Grid item xs={12}>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Notes (Optional)"
                    multiline
                    rows={3}
                    fullWidth
                    error={!!errors.notes}
                    helperText={errors.notes?.message}
                  />
                )}
              />
            </Grid>

            {/* Manager Approval */}
            <Grid item xs={12}>
              <Controller
                name="requireManagerApproval"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value}
                        onChange={field.onChange}
                      />
                    }
                    label="Require Manager Approval for Exceeding Limit"
                  />
                )}
              />
            </Grid>

            {/* Summary */}
            <Grid item xs={12}>
              <Box sx={{ 
                p: 2, 
                bgcolor: 'background.default', 
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider'
              }}>
                <Typography variant="subtitle2" gutterBottom>
                  Credit Limit Summary
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Credit Limit:
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" fontWeight="medium">
                      {selectedLimit.toFixed(2)} MAD
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Warning at:
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" fontWeight="medium" color="warning.main">
                      {warningAmount.toFixed(2)} MAD ({warningThreshold}%)
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">
                      Available Credit:
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" fontWeight="medium" color="success.main">
                      {(selectedLimit - currentBalance).toFixed(2)} MAD
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : existingLimit ? 'Update Limit' : 'Set Limit'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CreditLimitForm; 
