@echo off
REM ================================================================
REM ERP Backend - Deployment Verification Script (Windows)
REM ================================================================
REM Runs comprehensive checks to verify deployment health
REM ================================================================

setlocal enabledelayedexpansion

set PASSED=0
set FAILED=0
set WARNINGS=0

echo ========================================
echo ERP Backend Deployment Verification
echo ========================================
echo.

REM ================================================================
REM 1. Docker Installation
REM ================================================================
echo [1] Docker Installation
echo ----------------------------------------

docker --version >nul 2>&1
if errorlevel 1 (
    echo [X] Docker not installed
    set /A FAILED+=1
) else (
    for /f "tokens=3" %%a in ('docker --version') do set DOCKER_VERSION=%%a
    echo [OK] Docker installed (!DOCKER_VERSION!)
    set /A PASSED+=1
)

docker compose version >nul 2>&1
if errorlevel 1 (
    echo [X] Docker Compose not installed
    set /A FAILED+=1
) else (
    for /f "tokens=*" %%a in ('docker compose version --short') do set COMPOSE_VERSION=%%a
    echo [OK] Docker Compose installed (!COMPOSE_VERSION!)
    set /A PASSED+=1
)

echo.

REM ================================================================
REM 2. Environment Configuration
REM ================================================================
echo [2] Environment Configuration
echo ----------------------------------------

if exist ".env" (
    echo [OK] .env file exists
    set /A PASSED+=1
    
    findstr /C:"APP_ENV=production" .env >nul 2>&1
    if errorlevel 1 (
        echo [!] APP_ENV not set to production
        set /A WARNINGS+=1
    ) else (
        echo [OK] APP_ENV set to production
        set /A PASSED+=1
    )
    
    findstr /C:"APP_DEBUG=false" .env >nul 2>&1
    if errorlevel 1 (
        echo [!] APP_DEBUG not set to false
        set /A WARNINGS+=1
    ) else (
        echo [OK] APP_DEBUG is false
        set /A PASSED+=1
    )
    
    findstr /C:"POSTGRES_PASSWORD=erp_password" .env >nul 2>&1
    if not errorlevel 1 (
        echo [X] Using default database password ^(SECURITY RISK!^)
        set /A FAILED+=1
    ) else (
        findstr /C:"POSTGRES_PASSWORD=CHANGE_THIS" .env >nul 2>&1
        if not errorlevel 1 (
            echo [X] Using default database password ^(SECURITY RISK!^)
            set /A FAILED+=1
        ) else (
            echo [OK] Custom database password set
            set /A PASSED+=1
        )
    )
    
) else (
    echo [X] .env file not found
    set /A FAILED+=1
)

echo.

REM ================================================================
REM 3. Docker Services
REM ================================================================
echo [3] Docker Services
echo ----------------------------------------

docker compose ps | findstr /C:"erp_postgres" >nul 2>&1
if errorlevel 1 (
    echo [X] PostgreSQL container not found
    set /A FAILED+=1
) else (
    echo [OK] PostgreSQL container exists
    set /A PASSED+=1
    
    docker compose ps | findstr /C:"erp_postgres" | findstr /C:"running" >nul 2>&1
    if errorlevel 1 (
        echo [X] PostgreSQL container not running
        set /A FAILED+=1
    ) else (
        echo [OK] PostgreSQL container running
        set /A PASSED+=1
    )
)

docker compose ps | findstr /C:"erp_backend" >nul 2>&1
if errorlevel 1 (
    echo [X] Backend container not found
    set /A FAILED+=1
) else (
    echo [OK] Backend container exists
    set /A PASSED+=1
    
    docker compose ps | findstr /C:"erp_backend" | findstr /C:"running" >nul 2>&1
    if errorlevel 1 (
        echo [X] Backend container not running
        set /A FAILED+=1
    ) else (
        echo [OK] Backend container running
        set /A PASSED+=1
    )
)

echo.

REM ================================================================
REM 4. Network Connectivity
REM ================================================================
echo [4] Network Connectivity
echo ----------------------------------------

curl -sf http://localhost:8000/api/v1/health >nul 2>&1
if errorlevel 1 (
    echo [X] Backend health endpoint not responding
    set /A FAILED+=1
) else (
    echo [OK] Backend health endpoint responding
    set /A PASSED+=1
    
    curl -s http://localhost:8000/api/v1/health | findstr /C:"\"status\":\"ok\"" >nul 2>&1
    if errorlevel 1 (
        echo [X] Health status is not OK
        set /A FAILED+=1
    ) else (
        echo [OK] Health status is OK
        set /A PASSED+=1
    )
)

echo.

REM ================================================================
REM 5. Database
REM ================================================================
echo [5] Database
echo ----------------------------------------

docker compose exec -T db pg_isready -U erp_user -d erp_db >nul 2>&1
if errorlevel 1 (
    echo [X] Database not accepting connections
    set /A FAILED+=1
) else (
    echo [OK] Database accepting connections
    set /A PASSED+=1
)

echo.

REM ================================================================
REM 6. Backup System
REM ================================================================
echo [6] Backup System
echo ----------------------------------------

if exist "backups" (
    echo [OK] Backup directory exists
    set /A PASSED+=1
) else (
    echo [!] Backup directory does not exist
    set /A WARNINGS+=1
)

if exist "scripts\backup.bat" (
    echo [OK] Backup script exists
    set /A PASSED+=1
) else (
    echo [X] Backup script not found
    set /A FAILED+=1
)

echo.

REM ================================================================
REM Summary
REM ================================================================
echo ========================================
echo Verification Summary
echo ========================================
echo Passed:   !PASSED!
echo Failed:   !FAILED!
echo Warnings: !WARNINGS!
set /A TOTAL=!PASSED! + !FAILED! + !WARNINGS!
echo Total:    !TOTAL!
echo.

if !FAILED! EQU 0 (
    if !WARNINGS! EQU 0 (
        echo ========================================
        echo All checks passed successfully!
        echo System is ready for production.
        echo ========================================
        exit /b 0
    ) else (
        echo ========================================
        echo System operational with warnings
        echo Review warnings before production.
        echo ========================================
        exit /b 0
    )
) else (
    echo ========================================
    echo Verification failed!
    echo Fix issues before deploying.
    echo ========================================
    exit /b 1
)

endlocal
