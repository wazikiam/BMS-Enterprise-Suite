import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Avatar,
  Badge,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  NotificationsOff as NotificationsOffIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  CreditCard as CreditCardIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Settings as SettingsIcon,
  MarkEmailRead as MarkEmailReadIcon,
  Sms as SmsIcon,
  Chat as ChatIcon,
} from '@mui/icons-material';
import { Customer, CustomerBalance, CreditLimit, Alert as AlertType } from '@bms/core';

interface CreditLimitAlert extends AlertType {
  customer: Customer;
  balance: CustomerBalance;
  creditLimit?: CreditLimit;
  currentUtilization: number;
  exceededAmount?: number;
}

interface CreditLimitAlertsProps {
  alerts: CreditLimitAlert[];
  loading?: boolean;
  onRefresh?: () => void;
  onDismissAlert?: (alertId: string) => Promise<void>;
  onDismissAll?: () => Promise<void>;
  onResolveAlert?: (alertId: string, resolution: string) => Promise<void>;
  onViewCustomer?: (customerId: string) => void;
  onSetCreditLimit?: (customerId: string) => void;
  onSendNotification?: (alertId: string, method: 'email' | 'sms' | 'in_app') => Promise<void>;
  onConfigureAlerts?: () => void;
}

const CreditLimitAlerts: React.FC<CreditLimitAlertsProps> = ({
  alerts = [],
  loading = false,
  onRefresh,
  onDismissAlert,
  onDismissAll,
  onResolveAlert,
  onViewCustomer,
  onSetCreditLimit,
  onSendNotification,
  onConfigureAlerts,
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [tabValue, setTabValue] = useState(0);
  const [selectedAlert, setSelectedAlert] = useState<CreditLimitAlert | null>(null);
  const [resolutionDialogOpen, setResolutionDialogOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);

  // Filter alerts by severity
  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
  const warningAlerts = alerts.filter(alert => alert.severity === 'warning');
  const infoAlerts = alerts.filter(alert => alert.severity === 'info');

  // Get alerts for current tab
  const getTabAlerts = () => {
    switch (tabValue) {
      case 0: return alerts; // All
      case 1: return criticalAlerts;
      case 2: return warningAlerts;
      case 3: return infoAlerts;
      default: return alerts;
    }
  };

  const tabAlerts = getTabAlerts();

  // Handle pagination
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Paginated data
  const paginatedAlerts = tabAlerts.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Calculate statistics
  const calculateStats = () => {
    const totalAlerts = alerts.length;
    const totalCritical = criticalAlerts.length;
    const totalWarning = warningAlerts.length;
    const totalInfo = infoAlerts.length;
    
    const resolvedAlerts = alerts.filter(alert => alert.status === 'resolved').length;
    const pendingAlerts = alerts.filter(alert => alert.status === 'pending').length;
    
    const averageUtilization = alerts.length > 0 
      ? alerts.reduce((sum, alert) => sum + alert.currentUtilization, 0) / alerts.length
      : 0;

    return {
      totalAlerts,
      totalCritical,
      totalWarning,
      totalInfo,
      resolvedAlerts,
      pendingAlerts,
      averageUtilization,
    };
  };

  const stats = calculateStats();

  // Get alert severity chip
  const getSeverityChip = (severity: string) => {
    const severityConfig: Record<string, { color: 'error' | 'warning' | 'info' | 'default', label: string, icon: React.ReactNode }> = {
      critical: { color: 'error', label: 'Critical', icon: <WarningIcon fontSize="small" /> },
      warning: { color: 'warning', label: 'Warning', icon: <WarningIcon fontSize="small" /> },
      info: { color: 'info', label: 'Info', icon: <NotificationsIcon fontSize="small" /> },
    };

    const config = severityConfig[severity] || { color: 'default' as const, label: severity, icon: null };
    return (
      <Chip
        size="small"
        label={config.label}
        color={config.color}
        icon={config.icon}
        variant="filled"
      />
    );
  };

  // Get alert status chip
  const getStatusChip = (status: string) => {
    const statusConfig: Record<string, { color: 'success' | 'warning' | 'default', label: string, icon: React.ReactNode }> = {
      resolved: { color: 'success', label: 'Resolved', icon: <CheckCircleIcon fontSize="small" /> },
      pending: { color: 'warning', label: 'Pending', icon: <WarningIcon fontSize="small" /> },
      dismissed: { color: 'default', label: 'Dismissed', icon: <CancelIcon fontSize="small" /> },
    };

    const config = statusConfig[status] || { color: 'default' as const, label: status, icon: null };
    return (
      <Chip
        size="small"
        label={config.label}
        color={config.color}
        icon={config.icon}
        variant="outlined"
      />
    );
  };

  // Handle alert dismissal
  const handleDismissAlert = async (alertId: string) => {
    if (!onDismissAlert) return;
    
    try {
      setDismissing(alertId);
      await onDismissAlert(alertId);
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    } finally {
      setDismissing(null);
    }
  };

  // Handle alert resolution
  const handleResolveAlert = async () => {
    if (!selectedAlert || !onResolveAlert) return;
    
    try {
      await onResolveAlert(selectedAlert.id, resolutionNote || 'Resolved by user');
      setResolutionDialogOpen(false);
      setResolutionNote('');
      setSelectedAlert(null);
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  // Handle send notification
  const handleSendNotification = async (alertId: string, method: 'email' | 'sms' | 'in_app') => {
    if (!onSendNotification) return;
    
    try {
      setSendingNotification(`${alertId}-${method}`);
      await onSendNotification(alertId, method);
    } catch (error) {
      console.error('Failed to send notification:', error);
    } finally {
      setTimeout(() => setSendingNotification(null), 1000);
    }
  };

  // Get alert description
  const getAlertDescription = (alert: CreditLimitAlert) => {
    if (alert.currentUtilization >= 100) {
      return `Customer has exceeded credit limit by ${alert.exceededAmount?.toFixed(2) || 0} MAD`;
    } else if (alert.currentUtilization >= 80) {
      return `Customer is near credit limit (${alert.currentUtilization.toFixed(1)}% utilized)`;
    } else {
      return alert.description || 'Credit limit alert';
    }
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" component="h1" gutterBottom>
            Credit Limit Alerts
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor and manage customer credit limit violations and warnings
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {onRefresh && (
            <Tooltip title="Refresh Alerts">
              <IconButton onClick={onRefresh} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
          {onConfigureAlerts && (
            <Tooltip title="Configure Alerts">
              <IconButton onClick={onConfigureAlerts}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <Badge badgeContent={stats.pendingAlerts} color="error" max={999}>
                <NotificationsActiveIcon color="error" sx={{ fontSize: 32, mb: 1 }} />
              </Badge>
              <Typography variant="h4" fontWeight="bold">
                {stats.totalAlerts}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Alerts
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <WarningIcon color="error" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h4" color="error.main" fontWeight="bold">
                {stats.totalCritical}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Critical
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <WarningIcon color="warning" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h4" color="warning.main" fontWeight="bold">
                {stats.totalWarning}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Warnings
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <NotificationsIcon color="info" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h4" color="info.main" fontWeight="bold">
                {stats.totalInfo}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Info
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card variant="outlined">
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h4" color="success.main" fontWeight="bold">
                {stats.resolvedAlerts}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Resolved
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Critical Alert Banner */}
      {criticalAlerts.length > 0 && (
        <Alert 
          severity="error" 
          icon={<WarningIcon />}
          sx={{ mb: 3 }}
          action={
            <Button 
              color="inherit" 
              size="small"
              onClick={() => setTabValue(1)}
            >
              VIEW CRITICAL ALERTS
            </Button>
          }
        >
          <Typography variant="body2">
            <strong>Urgent:</strong> {criticalAlerts.length} customer(s) have exceeded their credit limits.
            Immediate action is required.
          </Typography>
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <NotificationsIcon />
                All Alerts
                {alerts.length > 0 && (
                  <Chip size="small" label={alerts.length} color="primary" />
                )}
              </Box>
            } 
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon color="error" />
                Critical
                {criticalAlerts.length > 0 && (
                  <Chip size="small" label={criticalAlerts.length} color="error" />
                )}
              </Box>
            } 
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon color="warning" />
                Warning
                {warningAlerts.length > 0 && (
                  <Chip size="small" label={warningAlerts.length} color="warning" />
                )}
              </Box>
            } 
          />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <NotificationsIcon color="info" />
                Info
                {infoAlerts.length > 0 && (
                  <Chip size="small" label={infoAlerts.length} color="info" />
                )}
              </Box>
            } 
          />
        </Tabs>
      </Paper>

      {/* Alerts Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : tabAlerts.length === 0 ? (
        <Alert severity="info">
          <Typography variant="body2">
            No alerts found for the selected filter. {tabValue === 0 ? 'All clear!' : 'Try a different filter.'}
          </Typography>
        </Alert>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Customer</TableCell>
                  <TableCell>Alert</TableCell>
                  <TableCell align="right">Utilization</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedAlerts.map((alert) => (
                  <TableRow
                    key={alert.id}
                    hover
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                      bgcolor: alert.severity === 'critical' ? 'error.50' : undefined,
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                          <PersonIcon fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {alert.customer.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {alert.customer.phone}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {getAlertDescription(alert)}
                      </Typography>
                      {alert.creditLimit && (
                        <Typography variant="caption" color="text.secondary">
                          Limit: {alert.creditLimit.creditLimit.toFixed(2)} MAD
                          {' • '}
                          Balance: {alert.balance.currentBalance.toFixed(2)} MAD
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                        <Typography 
                          variant="body2" 
                          fontWeight="bold"
                          color={alert.currentUtilization >= 100 ? 'error.main' : alert.currentUtilization >= 80 ? 'warning.main' : 'success.main'}
                        >
                          {alert.currentUtilization.toFixed(1)}%
                        </Typography>
                        {alert.currentUtilization >= 100 ? (
                          <ArrowUpwardIcon color="error" fontSize="small" />
                        ) : alert.currentUtilization >= 80 ? (
                          <WarningIcon color="warning" fontSize="small" />
                        ) : null}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {getSeverityChip(alert.severity)}
                    </TableCell>
                    <TableCell>
                      {getStatusChip(alert.status)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {formatDate(alert.createdAt)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                        {onViewCustomer && (
                          <Tooltip title="View Customer">
                            <IconButton
                              size="small"
                              onClick={() => onViewCustomer(alert.customer.id)}
                            >
                              <PersonIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        {onSendNotification && alert.status === 'pending' && (
                          <Tooltip title="Send Email Notification">
                            <IconButton
                              size="small"
                              onClick={() => handleSendNotification(alert.id, 'email')}
                              disabled={sendingNotification === `${alert.id}-email`}
                            >
                              {sendingNotification === `${alert.id}-email` ? (
                                <CircularProgress size={16} />
                              ) : (
                                <MarkEmailReadIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        {onResolveAlert && alert.status === 'pending' && (
                          <Tooltip title="Resolve Alert">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedAlert(alert);
                                setResolutionDialogOpen(true);
                              }}
                            >
                              <CheckCircleIcon fontSize="small" color="success" />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        {onDismissAlert && alert.status === 'pending' && (
                          <Tooltip title="Dismiss Alert">
                            <IconButton
                              size="small"
                              onClick={() => handleDismissAlert(alert.id)}
                              disabled={dismissing === alert.id}
                              color="error"
                            >
                              {dismissing === alert.id ? (
                                <CircularProgress size={16} />
                              ) : (
                                <CancelIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={tabAlerts.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </>
      )}

      {/* Bulk Actions */}
      {alerts.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Showing {paginatedAlerts.length} of {tabAlerts.length} alerts
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {onDismissAll && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<CancelIcon />}
                onClick={onDismissAll}
                disabled={alerts.filter(a => a.status === 'pending').length === 0}
              >
                Dismiss All Pending
              </Button>
            )}
            {onSetCreditLimit && criticalAlerts.length > 0 && (
              <Button
                variant="contained"
                startIcon={<CreditCardIcon />}
                onClick={() => {
                  // In real app, this would open credit limit management
                  console.log('Open credit limit management');
                }}
              >
                Manage Credit Limits
              </Button>
            )}
          </Box>
        </Box>
      )}

      {/* Resolution Dialog */}
      <Dialog open={resolutionDialogOpen} onClose={() => setResolutionDialogOpen(false)}>
        <DialogTitle>Resolve Alert</DialogTitle>
        <DialogContent>
          {selectedAlert && (
            <Box sx={{ mb: 2 }}>
              <Alert severity={selectedAlert.severity as any} sx={{ mb: 2 }}>
                <Typography variant="body2">
                  {getAlertDescription(selectedAlert)}
                </Typography>
              </Alert>
              <Typography variant="body2" paragraph>
                Customer: <strong>{selectedAlert.customer.name}</strong>
                <br />
                Phone: {selectedAlert.customer.phone}
                <br />
                Utilization: {selectedAlert.currentUtilization.toFixed(1)}%
              </Typography>
            </Box>
          )}
          <TextField
            fullWidth
            label="Resolution Notes"
            multiline
            rows={4}
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            placeholder="Describe how this alert was resolved..."
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolutionDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleResolveAlert}
            variant="contained"
            disabled={!resolutionNote.trim()}
          >
            Mark as Resolved
          </Button>
        </DialogActions>
      </Dialog>

      {/* Empty State */}
      {!loading && alerts.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            All Clear!
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            No credit limit alerts at the moment. The system will notify you when alerts are triggered.
          </Typography>
          {onConfigureAlerts && (
            <Button
              variant="outlined"
              startIcon={<SettingsIcon />}
              onClick={onConfigureAlerts}
            >
              Configure Alert Settings
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
};

export default CreditLimitAlerts; 
