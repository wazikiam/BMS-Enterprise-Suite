import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Button,
  Divider,
  Alert,
} from '@mui/material';
import {
  AccountBalance as BalanceIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  AttachMoney as MoneyIcon,
  CreditCard as CreditCardIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { CustomerBalance } from '@bms/core';

interface BalanceViewProps {
  customerId: string;
  customerName: string;
  balance: CustomerBalance;
  creditLimit?: number;
  loading?: boolean;
  onRefresh?: () => void;
  onViewTransactions?: () => void;
  onAdjustBalance?: () => void;
}

const BalanceView: React.FC<BalanceViewProps> = ({
  customerId,
  customerName,
  balance,
  creditLimit,
  loading = false,
  onRefresh,
  onViewTransactions,
  onAdjustBalance,
}) => {
  // Calculate percentages for visualization
  const availableCredit = creditLimit ? creditLimit - balance.currentBalance : 0;
  const creditUtilization = creditLimit ? (balance.currentBalance / creditLimit) * 100 : 0;
  const warningThreshold = 80; // Default warning at 80%
  const isNearLimit = creditLimit && creditUtilization >= warningThreshold;
  const isOverLimit = creditLimit && balance.currentBalance > creditLimit;

  // Calculate change percentage
  const getChangePercentage = () => {
    if (!balance.previousBalance || balance.previousBalance === 0) return 0;
    return ((balance.currentBalance - balance.previousBalance) / Math.abs(balance.previousBalance)) * 100;
  };

  const changePercentage = getChangePercentage();
  const isPositiveChange = changePercentage > 0;

  // Determine status color and text
  const getStatusInfo = () => {
    if (!creditLimit) {
      return { color: 'info' as const, text: 'No Credit Limit Set', icon: <MoneyIcon /> };
    }
    if (isOverLimit) {
      return { color: 'error' as const, text: 'Over Credit Limit', icon: <WarningIcon /> };
    }
    if (isNearLimit) {
      return { color: 'warning' as const, text: 'Near Credit Limit', icon: <WarningIcon /> };
    }
    return { color: 'success' as const, text: 'Within Limit', icon: <CreditCardIcon /> };
  };

  const statusInfo = getStatusInfo();

  return (
    <Card sx={{ width: '100%' }}>
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BalanceIcon color="primary" />
            <Typography variant="h6" component="div">
              Customer Balance
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {onRefresh && (
              <Tooltip title="Refresh Balance">
                <IconButton onClick={onRefresh} size="small" disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Customer Info */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Customer
          </Typography>
          <Typography variant="body1" fontWeight="medium">
            {customerName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ID: {customerId}
          </Typography>
        </Box>

        {/* Current Balance Card */}
        <Card variant="outlined" sx={{ mb: 3, p: 2, bgcolor: 'background.default' }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Current Balance
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography variant="h4" component="div" fontWeight="bold">
                  {balance.currentBalance.toFixed(2)} MAD
                </Typography>
                {changePercentage !== 0 && (
                  <Chip
                    size="small"
                    label={`${isPositiveChange ? '+' : ''}${changePercentage.toFixed(1)}%`}
                    color={isPositiveChange ? 'error' : 'success'}
                    icon={isPositiveChange ? <TrendingUpIcon /> : <TrendingDownIcon />}
                    sx={{ height: 24 }}
                  />
                )}
              </Box>
              {balance.previousBalance && (
                <Typography variant="caption" color="text.secondary">
                  Previous: {balance.previousBalance.toFixed(2)} MAD
                </Typography>
              )}
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Status
              </Typography>
              <Chip
                label={statusInfo.text}
                color={statusInfo.color}
                icon={statusInfo.icon}
                sx={{ mb: 1 }}
              />
              {creditLimit && (
                <>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Credit Limit: {creditLimit.toFixed(2)} MAD
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Available: {availableCredit.toFixed(2)} MAD
                  </Typography>
                </>
              )}
            </Grid>
          </Grid>
        </Card>

        {/* Credit Utilization Progress */}
        {creditLimit && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Credit Utilization
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {creditUtilization.toFixed(1)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(creditUtilization, 100)}
              color={isOverLimit ? 'error' : isNearLimit ? 'warning' : 'success'}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                0%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {warningThreshold}% Warning
              </Typography>
              <Typography variant="caption" color="text.secondary">
                100%
              </Typography>
            </Box>
          </Box>
        )}

        {/* Balance Breakdown */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Balance Breakdown
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Total Due
                </Typography>
                <Typography variant="h6" color="error.main" fontWeight="bold">
                  {balance.totalDue.toFixed(2)} MAD
                </Typography>
              </Card>
            </Grid>
            <Grid item xs={6}>
              <Card variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Total Credit
                </Typography>
                <Typography variant="h6" color="success.main" fontWeight="bold">
                  {balance.totalCredit.toFixed(2)} MAD
                </Typography>
              </Card>
            </Grid>
          </Grid>
        </Box>

        {/* Balance Details */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Details
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="body2">Last Updated:</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" textAlign="right">
                {new Date(balance.lastUpdated).toLocaleDateString()}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2">Last Transaction:</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" textAlign="right">
                {balance.lastTransactionDate
                  ? new Date(balance.lastTransactionDate).toLocaleDateString()
                  : 'No transactions'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2">Currency:</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" textAlign="right">
                {balance.currency}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {/* Alerts */}
        {isOverLimit && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Customer has exceeded credit limit by {(balance.currentBalance - creditLimit).toFixed(2)} MAD.
            New sales require manager approval.
          </Alert>
        )}

        {isNearLimit && !isOverLimit && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Customer is near credit limit ({creditUtilization.toFixed(1)}% utilized).
            Consider reviewing credit limit.
          </Alert>
        )}

        {/* Action Buttons */}
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          {onViewTransactions && (
            <Button
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={onViewTransactions}
              size="small"
            >
              View Transactions
            </Button>
          )}
          {onAdjustBalance && (
            <Button
              variant="contained"
              onClick={onAdjustBalance}
              size="small"
            >
              Adjust Balance
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default BalanceView; 
