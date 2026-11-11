@echo off
title Mototaxi - Instalar
cd /d "%~dp0.."

echo ============================================
echo   Mototaxi - Instalacao
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo O Node.js nao esta instalado neste computador.
  echo.
  echo 1. Abra o site https://nodejs.org
  echo 2. Baixe a versao LTS e instale, clicando em Avancar ate o fim.
  echo 3. Feche esta janela e de dois cliques neste arquivo de novo.
  echo.
  pause
  exit /b 1
)

echo Instalando o necessario. Isso pode levar alguns minutos...
echo.
call npm install --omit=dev
if errorlevel 1 (
  echo.
  echo A instalacao falhou. Confira a internet e tente de novo.
  echo Se o erro continuar, tire uma foto desta janela e mande para o Claude.
  pause
  exit /b 1
)

echo.
node scripts\configurar.js
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo Instalacao concluida. Agora de dois cliques em "2-iniciar.bat".
echo.
pause
