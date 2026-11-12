@echo off
title Mototaxi - Servidor (nao feche esta janela)
cd /d "%~dp0.."

if not exist ".env" (
  echo Falta a configuracao. De dois cliques em "1-instalar.bat" primeiro.
  pause
  exit /b 1
)

:inicio
echo.
echo Ligando o servidor do Mototaxi...
echo Para desligar, feche esta janela.
echo.
node server\index.js
echo.
echo O servidor parou. Ligando de novo em 5 segundos...
timeout /t 5 /nobreak >nul
goto inicio
