@echo off
title Mototaxi - Link da internet (nao feche esta janela)
cd /d "%~dp0"

set "TUNEL=cloudflared"
if exist "%~dp0cloudflared.exe" set "TUNEL=%~dp0cloudflared.exe"

"%TUNEL%" --version >nul 2>nul
if errorlevel 1 (
  echo O programa do tunel ^(cloudflared^) nao foi encontrado.
  echo.
  echo 1. Abra: https://github.com/cloudflare/cloudflared/releases/latest
  echo 2. Baixe o arquivo "cloudflared-windows-amd64.exe".
  echo 3. Mude o nome dele para "cloudflared.exe".
  echo 4. Coloque dentro desta pasta: %~dp0
  echo 5. De dois cliques neste arquivo de novo.
  echo.
  pause
  exit /b 1
)

echo ============================================
echo   Link de TESTE do Mototaxi
echo ============================================
echo.
echo O servidor precisa estar ligado ("2-iniciar.bat" aberto).
echo.
echo Daqui a pouco vai aparecer abaixo um endereco assim:
echo     https://alguma-coisa.trycloudflare.com
echo Esse e o link para abrir no celular.
echo.
echo ATENCAO: este link MUDA toda vez que esta janela e fechada.
echo Para um link fixo, veja o guia docs\SERVIDOR-WINDOWS.md
echo.

"%TUNEL%" tunnel --url http://localhost:3000
echo.
echo O tunel foi encerrado.
pause
