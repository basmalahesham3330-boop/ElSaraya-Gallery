@echo off
REM ================================================================
REM ERP Backend - Database Restore Script (Windows)
REM ================================================================
REM Usage: scripts\restore.bat <backup_file>
REM 
REM Restores the PostgreSQL database from a backup file.
REM WARNING: This will stop the backend service during restoration.
REM ================================================================

setlocal

REM Check if backup file is provided
if "%~1"=="" (
    echo ERROR: No backup file specified!
    echo Usage: %0 ^<backup_file^>
    echo.
    echo Available backups:
    dir /B backups\erp_backup_*.sql 2>nul
    exit /b 1
)

set BACKUP_FILE=%~1

REM Check if backup file exists
if not exist "%BACKUP_FILE%" (
    echo ERROR: Backup file not found: %BACKUP_FILE%
    exit /b 1
)

echo ======================================
echo ERP Database Restore
echo ======================================
echo WARNING: This will replace all current data!
echo Backup file: %BACKUP_FILE%
echo.
set /P CONFIRM="Are you sure you want to continue? (yes/no): "

if /I not "%CONFIRM%"=="yes" (
    echo Restore cancelled.
    exit /b 0
)

REM Check if Docker Compose services are running
docker compose ps | findstr /C:"erp_postgres" | findstr /C:"Up" >nul 2>&1
if errorlevel 1 (
    echo ERROR: PostgreSQL container is not running!
    echo Start it with: docker compose up -d db
    exit /b 1
)

REM Stop backend to prevent connections
echo Stopping backend service...
docker compose stop backend

REM Restore database
echo Restoring database...
type "%BACKUP_FILE%" | docker compose exec -T db psql -U erp_user -d erp_db >nul 2>&1
if errorlevel 1 (
    echo ERROR: Restore failed!
    echo Starting backend service...
    docker compose start backend
    exit /b 1
)

echo Database restored successfully

REM Start backend
echo Starting backend service...
docker compose start backend

REM Wait for backend to be healthy
echo Waiting for backend to be healthy...
timeout /t 5 /nobreak >nul

set MAX_WAIT=30
set WAITED=0
:wait_loop
if !WAITED! GEQ !MAX_WAIT! goto wait_timeout
curl -sf http://localhost:8000/api/v1/health >nul 2>&1
if errorlevel 1 (
    timeout /t 2 /nobreak >nul
    set /A WAITED+=2
    goto wait_loop
)

echo Backend is healthy
goto restore_complete

:wait_timeout
echo Warning: Backend health check timed out
echo Check logs with: docker compose logs backend

:restore_complete
echo ======================================
echo Restore completed successfully!
echo ======================================

endlocal
