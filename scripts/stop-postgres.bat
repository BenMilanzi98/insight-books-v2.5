@echo off
setlocal

set "PGDATA=%USERPROFILE%\scoop\persist\postgresql\data"

if not exist "%PGDATA%" (
  echo PostgreSQL data directory not found:
  echo   %PGDATA%
  exit /b 1
)

where pg_ctl >nul 2>&1
if errorlevel 1 (
  echo pg_ctl not found. Open a terminal where Scoop PostgreSQL is on PATH.
  exit /b 1
)

pg_ctl status -D "%PGDATA%" 2>nul | findstr /C:"server is running" >nul
if errorlevel 1 (
  echo PostgreSQL is not running.
  exit /b 0
)

echo Stopping PostgreSQL...
pg_ctl stop -D "%PGDATA%"
if errorlevel 1 (
  echo Failed to stop PostgreSQL.
  exit /b 1
)

echo PostgreSQL stopped.
exit /b 0
