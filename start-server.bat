@echo off
echo Checking for existing Node.js processes on port 3000...
netstat -ano | findstr :3000 >nul
if %errorlevel% == 0 (
    echo Found process using port 3000, attempting to stop it...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
        taskkill /PID %%a /F >nul 2>&1
    )
    echo Waiting for port to be freed...
    timeout /t 2 /nobreak >nul
)

echo Starting AdCopy server...
node server.js