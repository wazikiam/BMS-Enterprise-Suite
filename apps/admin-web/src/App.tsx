import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { Visibility, VisibilityOff, Login as LoginIcon } from '@mui/icons-material';

function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    setError('');

    // Simulate API call
    setTimeout(() => {
      if (email === 'admin@bms.com' && password === 'Admin123!') {
        alert('Login successful! Welcome Admin.');
        // In real app: navigate to dashboard
      } else if (email === 'seller@bms.com' && password === 'Seller123!') {
        alert('Login successful! Welcome Seller.');
      } else {
        setError('Invalid credentials. Try: admin@bms.com / Admin123!');
      }
      setLoading(false);
    }, 1000);
  };

  const handleDemoLogin = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setTimeout(() => handleLogin(), 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      p: 2,
    }}>
      <Paper sx={{
        p: 4,
        width: '100%',
        maxWidth: 400,
        borderRadius: 2,
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
      }}>
        {/* Logo/Header */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h4" fontWeight="bold" color="primary">
            BMS Enterprise Suite
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Professional Business Management System
          </Typography>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Login Form */}
        <Box sx={{ mt: 2 }} onKeyPress={handleKeyPress}>
          <TextField
            fullWidth
            label="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            disabled={loading}
            autoComplete="email"
            autoFocus
          />

          <TextField
            fullWidth
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            disabled={loading}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            autoComplete="current-password"
          />

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleLogin}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <LoginIcon />}
            sx={{ mt: 3, py: 1.5 }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </Box>

        {/* Demo Accounts */}
        <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Demo Accounts (click to auto-fill):
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleDemoLogin('admin@bms.com', 'Admin123!')}
              disabled={loading}
            >
              Admin
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleDemoLogin('manager@bms.com', 'Manager123!')}
              disabled={loading}
            >
              Manager
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleDemoLogin('seller@bms.com', 'Seller123!')}
              disabled={loading}
            >
              Seller
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleDemoLogin('viewer@bms.com', 'Viewer123!')}
              disabled={loading}
            >
              Viewer
            </Button>
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{ mt: 4, pt: 2, borderTop: 1, borderColor: 'divider', textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            © 2025 BMS Enterprise Suite • Version 1.0.0
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Week 1 Foundation Complete • Built with React + Node.js + TypeScript
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Backend: http://localhost:3000 • Frontend: http://localhost:5173
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

export default App;