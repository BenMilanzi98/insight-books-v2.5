@echo off
setlocal

set "PGDATA=%USERPROFILE%\scoop\persist\postgresql\data"
set "PGLOG=%USERPROFILE%\scoop\persist\postgresql\server.log"

if not exist "%PGDATA%" (
  echo PostgreSQL data directory not found:
  echo   %PGDATA%
  echo Install PostgreSQL with Scoop first: scoop install postgresql
  exit /b 1
)

where pg_ctl >nul 2>&1
if errorlevel 1 (
  echo pg_ctl not found. Open a terminal where Scoop PostgreSQL is on PATH.
  exit /b 1
)

pg_ctl status -D "%PGDATA%" 2>nul | findstr /C:"server is running" >nul
if not errorlevel 1 (
  echo PostgreSQL is already running on localhost:5432
  exit /b 0
)

echo Starting PostgreSQL...
pg_ctl start -D "%PGDATA%" -l "%PGLOG%"
if errorlevel 1 (
  echo Failed to start PostgreSQL. Check the log:
  echo   %PGLOG%
  exit /b 1
)

echo PostgreSQL started.
echo Database: insightbooksmw @ localhost:5432
exit /b 0
