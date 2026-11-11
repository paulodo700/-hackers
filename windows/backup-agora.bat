@echo off
title Mototaxi - Copia de seguranca
cd /d "%~dp0.."
node scripts\backup.js
echo.
pause
