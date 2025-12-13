@echo off
echo ========================================
echo   BMS Enterprise Suite - FAST START
echo ========================================
echo.

REM Start Backend Server in new window
start "BMS Backend" cmd /k "cd /d %~dp0packages\server && title BMS Backend && color 0B && echo [BACKEND] Starting... && npx ts-node src/index.ts"

REM Wait 3 seconds
timeout /t 3 /nobreak >nul

REM Start Frontend Server in new window
start "BMS Frontend" cmd /k "cd /d %~dp0apps\admin-web && title BMS Frontend && color 0A && echo [FRONTEND] Starting... && npm run dev"

REM Wait 3 seconds
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   SERVERS STARTED IN SEPARATE WINDOWS!
echo ========================================
echo.
echo BACKEND:  http://localhost:3000
echo   Health: http://localhost:3000/health
echo.
echo FRONTEND: http://localhost:5173
echo   Login:  http://localhost:5173
echo.
echo ========================================
echo   Check your taskbar for:
echo   1. "BMS Backend" window (Blue)
echo   2. "BMS Frontend" window (Green)
echo ========================================
echo.
pause