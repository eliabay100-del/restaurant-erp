@echo off
REM Start the Warka Dine POS server in production mode (default port 3000).
REM Usage: start-server.bat            (port 3000)
REM        start-server.bat 3002       (custom port)
cd /d "%~dp0"
if "%~1"=="" (
  node server.js --production
) else (
  node server.js --production --port %1
)
