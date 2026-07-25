@echo off
REM ================================================================
REM ERP Backend - Database Backup Script (Windows)
REM ================================================================
REM Usage: scripts\backup.bat
REM 
REM Creates a compressed backup of the PostgreSQL database with
REM timestamp in the filename. Automatically cleans up backups
REM older than 7 days.
REM ================================================================

setlocal enabledelayedexpansion

REM Configuration
set BACKUP_DIR=backups
set TIMESTAMP=%date:~-4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_FILE=%BACKUP_DIR%\erp_backup_%TIMESTAMP%.sql
set RETENTION_DAYS=7

echo ======================================
echo ERP Database Backup
echo ======================================

REM Create backup directory if it doesn't exist
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM Check if Docker Compose services are running
docker compose ps | findstr /C:"erp_postgres" | findstr /C:"running" >nul 2>&1
if errorlevel 1 (
    echo ERROR: PostgreSQL container is not running!
    echo Start it with: docker compose up -d db
    exit /b 1
)

REM Create backup
echo Creating backup...
docker compose exec -T db pg_dump -U erp_user -d erp_db > "%BACKUP_FILE%"
if errorlevel 1 (
    echo ERROR: Backup failed!
    exit /b 1
)

echo Backup created successfully
echo File: %BACKUP_FILE%

REM Note: Windows doesn't have built-in gzip, so backup is uncompressed
REM Install 7-Zip or gzip for Windows if compression is needed

REM Clean up old backups
echo Cleaning up old backups (older than %RETENTION_DAYS% days)...
forfiles /P "%BACKUP_DIR%" /M erp_backup_*.sql /D -%RETENTION_DAYS% /C "cmd /c del @path" 2>nul

REM List current backups
echo Current backups:
dir /B "%BACKUP_DIR%\erp_backup_*.sql" 2>nul

echo ======================================
echo Backup completed successfully!
echo ======================================

endlocal
