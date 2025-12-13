@echo off
echo ========================================
echo   BMS Enterprise Suite Startup
echo ========================================
echo.

REM Start Backend Server in new window
echo Starting Backend Server (port 3000)...
start "BMS Backend" cmd /k "cd /D %~dp0packages\server && npm run dev"

REM Wait for backend to start
timeout /t 5 /nobreak >nul

REM Start Frontend in new window
echo Starting Frontend Server (port 5173)...
start "BMS Frontend" cmd /k "cd /D %~dp0apps\admin-web && npm run dev"

REM Wait for frontend to start
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo   SERVERS STARTED!
echo ========================================
echo.
echo BACKEND:  http://localhost:3000
echo   Health: http://localhost:3000/health
echo.
echo FRONTEND: http://localhost:5173
echo   Login:  http://localhost:5173
echo.
echo DEMO LOGINS:
echo   Admin:    admin@bms.com / Admin123!
echo   Manager:  manager@bms.com / Manager123!
echo   Seller:   seller@bms.com / Seller123!
echo   Viewer:   viewer@bms.com / Viewer123!
echo.
echo ========================================
echo   Check taskbar for server windows
echo ========================================
echo.
pause