/**
 * Product Import Component
 * Bulk product import from CSV/Excel files
 * 
 * BUSINESS RULES:
 * - CSV/Excel file upload with validation
 * - Template download with sample data
 * - Real-time validation preview
 * - Batch processing with progress tracking
 * - Detailed error reporting
 * 
 * DESIGN RULES:
 * - Material-UI components
 * - Drag-and-drop file upload
 * - Step-by-step wizard interface
 * - Responsive design
 * - TypeScript strict mode
 */
import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Typography,
  Paper,
  Alert,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Grid,
  Link,
  Divider
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Description as TemplateIcon,
  Visibility as PreviewIcon,
  PlayArrow as ImportIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../../features/auth/useAuth';

// Mock data for development
const mockValidationResult = {
  isValid: true,
  errors: [],
  warnings: [
    { row: 5, message: 'Duplicate SKU: PROD-001' },
    { row: 10, message: 'Missing supplier information' }
  ],
  statistics: {
    totalRows: 100,
    validRows: 95,
    duplicateRows: 2,
    missingRequired: 3
  }
};

const mockImportResult = {
  success: 95,
  failed: 5,
  skipped: 0,
  errors: [
    { row: 3, field: 'cost_price', value: 'invalid', error: 'Must be a number' },
    { row: 7, field: 'selling_price', value: '-10', error: 'Cannot be negative' },
    { row: 12, field: 'sku', value: '', error: 'SKU is required' }
  ],
  warnings: [],
  summary: {
    totalProcessed: 100,
    processingTime: 2500,
    memoryUsage: 45.2
  }
};

const steps = [
  'Upload File',
  'Validate Data',
  'Review & Confirm',
  'Import Results'
];

const ProductImport: React.FC = () => {
  const { hasPermission } = useAuth();
  
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [importOptions, setImportOptions] = useState({
    validateOnly: false,
    skipInvalidRows: true,
    updateExisting: false,
    createMissingCategories: true,
    notifyOnComplete: true
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [selectedError, setSelectedError] = useState<any>(null);

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setFile(file);
      setFileName(file.name);
      
      // Read file content
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileContent(e.target?.result as string);
        setActiveStep(1); // Move to validation step
      };
      reader.readAsText(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1
  });

  // Handle validation
  const handleValidate = () => {
    // Simulate validation
    setValidationResult(mockValidationResult);
    setActiveStep(2);
  };

  // Handle import
  const handleImport = () => {
    setIsImporting(true);
    
    // Simulate import progress
    const interval = setInterval(() => {
      setImportProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsImporting(false);
          setImportResult(mockImportResult);
          setActiveStep(3);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  // Download template
  const handleDownloadTemplate = () => {
    // Create and download CSV template
    const template = `sku,name,description,barcode,category,cost_price,selling_price,current_stock,min_stock_level,supplier,weight_kg,dimensions,is_active
PROD-001,Sample Product,Product description,123456789012,Electronics,100.50,150.00,50,10,Supplier Co.,1.5,10x20x30,true
PROD-002,Another Product,Another description,987654321098,Furniture,75.00,120.00,25,5,Another Supplier,5.0,50x50x100,true`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // View error details
  const handleViewError = (error: any) => {
    setSelectedError(error);
    setErrorDialogOpen(true);
  };

  // Reset import
  const handleReset = () => {
    setFile(null);
    setFileName('');
    setFileContent('');
    setValidationResult(null);
    setImportResult(null);
    setImportProgress(0);
    setActiveStep(0);
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
          You need admin or manager permissions to import products.
        </Typography>
      </Card>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Bulk Product Import
        </Typography>
        <Typography color="textSecondary">
          Import products from CSV or Excel files. Download the template for proper formatting.
        </Typography>
      </Box>

      {/* Stepper */}
      <Stepper activeStep={activeStep} orientation="vertical" sx={{ mb: 4 }}>
        {steps.map((label, index) => (
          <Step key={label} completed={activeStep > index}>
            <StepLabel>{label}</StepLabel>
            <StepContent>
              {index === 0 && (
                <Box sx={{ mt: 2 }}>
                  {/* File Upload Area */}
                  <Paper
                    {...getRootProps()}
                    sx={{
                      p: 4,
                      textAlign: 'center',
                      border: '2px dashed',
                      borderColor: isDragActive ? 'primary.main' : 'grey.300',
                      backgroundColor: isDragActive ? 'primary.light' : 'grey.50',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: 'primary.main',
                        backgroundColor: 'primary.light'
                      }
                    }}
                  >
                    <input {...getInputProps()} />
                    <UploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h6" gutterBottom>
                      {isDragActive ? 'Drop the file here' : 'Drag & drop your file here'}
                    </Typography>
                    <Typography color="textSecondary" paragraph>
                      or click to browse
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      Supports: CSV, XLS, XLSX (Max 10MB)
                    </Typography>
                  </Paper>

                  {file && (
                    <Alert severity="success" sx={{ mt: 2 }}>
                      File selected: <strong>{fileName}</strong> ({file.size.toLocaleString()} bytes)
                    </Alert>
                  )}

                  <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                      startIcon={<TemplateIcon />}
                      onClick={handleDownloadTemplate}
                      variant="outlined"
                    >
                      Download Template
                    </Button>
                    
                    <Button
                      variant="contained"
                      onClick={handleValidate}
                      disabled={!file}
                    >
                      Validate File
                    </Button>
                  </Box>
                </Box>
              )}

              {index === 1 && validationResult && (
                <Box sx={{ mt: 2 }}>
                  {/* Validation Results */}
                  <Card sx={{ p: 3, mb: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Validation Results
                    </Typography>
                    
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" color="success.main">
                            {validationResult.statistics.validRows}
                          </Typography>
                          <Typography variant="caption">Valid Rows</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" color="error.main">
                            {validationResult.statistics.totalRows - validationResult.statistics.validRows}
                          </Typography>
                          <Typography variant="caption">Invalid Rows</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" color="warning.main">
                            {validationResult.statistics.duplicateRows}
                          </Typography>
                          <Typography variant="caption">Duplicates</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4">
                            {validationResult.statistics.totalRows}
                          </Typography>
                          <Typography variant="caption">Total Rows</Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    {validationResult.warnings.length > 0 && (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        {validationResult.warnings.length} warnings found
                      </Alert>
                    )}

                    {!validationResult.isValid && (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        {validationResult.errors.length} errors found. Please fix before importing.
                      </Alert>
                    )}
                  </Card>

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button onClick={() => setActiveStep(0)} sx={{ mr: 1 }}>
                      Back
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() => setActiveStep(2)}
                      disabled={!validationResult.isValid}
                    >
                      Continue to Review
                    </Button>
                  </Box>
                </Box>
              )}

              {index === 2 && (
                <Box sx={{ mt: 2 }}>
                  {/* Import Options */}
                  <Card sx={{ p: 3, mb: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Import Options
                    </Typography>
                    
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={importOptions.skipInvalidRows}
                              onChange={(e) => setImportOptions({
                                ...importOptions,
                                skipInvalidRows: e.target.checked
                              })}
                            />
                          }
                          label="Skip invalid rows"
                        />
                        <Typography variant="caption" color="textSecondary">
                          Continue import even if some rows have errors
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={importOptions.createMissingCategories}
                              onChange={(e) => setImportOptions({
                                ...importOptions,
                                createMissingCategories: e.target.checked
                              })}
                            />
                          }
                          label="Create missing categories"
                        />
                        <Typography variant="caption" color="textSecondary">
                          Automatically create categories that don't exist
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={importOptions.updateExisting}
                              onChange={(e) => setImportOptions({
                                ...importOptions,
                                updateExisting: e.target.checked
                              })}
                            />
                          }
                          label="Update existing products"
                        />
                        <Typography variant="caption" color="textSecondary">
                          Update products with matching SKUs
                        </Typography>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={importOptions.notifyOnComplete}
                              onChange={(e) => setImportOptions({
                                ...importOptions,
                                notifyOnComplete: e.target.checked
                              })}
                            />
                          }
                          label="Notify on completion"
                        />
                        <Typography variant="caption" color="textSecondary">
                          Send email notification when import completes
                        </Typography>
                      </Grid>
                    </Grid>
                  </Card>

                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2">
                      <strong>Ready to import {validationResult?.statistics.validRows || 0} products</strong>
                      <br />
                      This action cannot be undone. Please review your options before proceeding.
                    </Typography>
                  </Alert>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button onClick={() => setActiveStep(1)}>
                      Back
                    </Button>
                    
                    <Box>
                      <Button onClick={handleReset} sx={{ mr: 1 }}>
                        Cancel
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<ImportIcon />}
                        onClick={handleImport}
                        disabled={isImporting}
                      >
                        {isImporting ? 'Importing...' : 'Start Import'}
                      </Button>
                    </Box>
                  </Box>
                </Box>
              )}

              {index === 3 && importResult && (
                <Box sx={{ mt: 2 }}>
                  {/* Import Results */}
                  <Card sx={{ p: 3, mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                      {importResult.failed === 0 ? (
                        <SuccessIcon color="success" sx={{ fontSize: 40, mr: 2 }} />
                      ) : (
                        <WarningIcon color="warning" sx={{ fontSize: 40, mr: 2 }} />
                      )}
                      
                      <Box>
                        <Typography variant="h5">
                          Import {importResult.failed === 0 ? 'Completed Successfully' : 'Completed with Errors'}
                        </Typography>
                        <Typography color="textSecondary">
                          Processed {importResult.summary.totalProcessed} rows in {importResult.summary.processingTime}ms
                        </Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 2 }} />

                    {/* Results Summary */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" color="success.main">
                            {importResult.success}
                          </Typography>
                          <Typography variant="caption">Successful</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" color="error.main">
                            {importResult.failed}
                          </Typography>
                          <Typography variant="caption">Failed</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" color="textSecondary">
                            {importResult.skipped}
                          </Typography>
                          <Typography variant="caption">Skipped</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={3}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4">
                            {importResult.summary.totalProcessed}
                          </Typography>
                          <Typography variant="caption">Total</Typography>
                        </Box>
                      </Grid>
                    </Grid>

                    {/* Errors Table */}
                    {importResult.errors.length > 0 && (
                      <>
                        <Typography variant="subtitle1" gutterBottom>
                          Import Errors ({importResult.errors.length})
                        </Typography>
                        
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Row</TableCell>
                                <TableCell>Field</TableCell>
                                <TableCell>Error</TableCell>
                                <TableCell align="right">Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {importResult.errors.slice(0, 5).map((error: any, index: number) => (
                                <TableRow key={index}>
                                  <TableCell>{error.row}</TableCell>
                                  <TableCell>{error.field}</TableCell>
                                  <TableCell>
                                    <Typography noWrap sx={{ maxWidth: 200 }}>
                                      {error.error}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Tooltip title="View Details">
                                      <IconButton size="small" onClick={() => handleViewError(error)}>
                                        <PreviewIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        
                        {importResult.errors.length > 5 && (
                          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                            ... and {importResult.errors.length - 5} more errors
                          </Typography>
                        )}
                        
                        <Button
                          size="small"
                          startIcon={<DownloadIcon />}
                          sx={{ mt: 2 }}
                        >
                          Download Error Report
                        </Button>
                      </>
                    )}

                    {/* Performance Summary */}
                    <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Performance Summary
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={4}>
                          <Typography variant="caption" display="block" color="textSecondary">
                            Processing Time
                          </Typography>
                          <Typography variant="body2">
                            {importResult.summary.processingTime}ms
                          </Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" display="block" color="textSecondary">
                            Memory Usage
                          </Typography>
                          <Typography variant="body2">
                            {importResult.summary.memoryUsage.toFixed(1)} MB
                          </Typography>
                        </Grid>
                        <Grid item xs={4}>
                          <Typography variant="caption" display="block" color="textSecondary">
                            Success Rate
                          </Typography>
                          <Typography variant="body2">
                            {((importResult.success / importResult.summary.totalProcessed) * 100).toFixed(1)}%
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  </Card>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                      startIcon={<DeleteIcon />}
                      onClick={handleReset}
                    >
                      Clear & Start New
                    </Button>
                    
                    <Button
                      variant="contained"
                      onClick={handleReset}
                    >
                      Done
                    </Button>
                  </Box>
                </Box>
              )}
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {/* Progress Indicator */}
      {isImporting && (
        <Card sx={{ p: 3, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Importing Products...
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={importProgress} 
            sx={{ height: 10, borderRadius: 5, mb: 2 }}
          />
          <Typography align="center">
            {importProgress}% complete
          </Typography>
          <Typography variant="caption" color="textSecondary" align="center" display="block">
            Processing {Math.floor(importProgress / 10)} of 10 batches...
          </Typography>
        </Card>
      )}

      {/* Error Details Dialog */}
      <Dialog open={errorDialogOpen} onClose={() => setErrorDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Error Details
          <IconButton
            aria-label="close"
            onClick={() => setErrorDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          {selectedError && (
            <Box>
              <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                Row {selectedError.row} • Field: {selectedError.field}
              </Typography>
              
              <Alert severity="error" sx={{ mb: 2 }}>
                {selectedError.error}
              </Alert>
              
              <Typography variant="body2" gutterBottom>
                <strong>Value:</strong> {selectedError.value || '(empty)'}
              </Typography>
              
              <Typography variant="body2" gutterBottom>
                <strong>Suggestions:</strong>
              </Typography>
              <Typography variant="body2" color="textSecondary">
                • Check the value format
                <br />
                • Verify against the template
                <br />
                • Ensure required fields are filled
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setErrorDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quick Stats */}
      {activeStep === 0 && (
        <Card sx={{ p: 3, mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Import Guidelines
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                ✅ Required Fields:
              </Typography>
              <Typography variant="body2" color="textSecondary">
                • SKU (must be unique)
                <br />
                • Product Name
                <br />
                • Category
                <br />
                • Cost Price
                <br />
                • Selling Price
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                📊 File Specifications:
              </Typography>
              <Typography variant="body2" color="textSecondary">
                • Max file size: 10MB
                <br />
                • Supported formats: CSV, XLS, XLSX
                <br />
                • Encoding: UTF-8
                <br />
                • Max rows: 10,000
              </Typography>
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Link href="#" onClick={handleDownloadTemplate} sx={{ display: 'flex', alignItems: 'center' }}>
              <DownloadIcon sx={{ mr: 1 }} />
              Download Complete Template with Instructions
            </Link>
          </Box>
        </Card>
      )}
    </Box>
  );
};

export default ProductImport; 
