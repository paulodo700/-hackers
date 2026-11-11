@echo off
title Mototaxi - Ligar junto com o Windows
set "ATALHO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\mototaxi-servidor.bat"

> "%ATALHO%" echo @echo off
>> "%ATALHO%" echo start "Mototaxi" /min "%~dp02-iniciar.bat"

if exist "%ATALHO%" (
  echo Pronto. O servidor do Mototaxi vai ligar sozinho sempre que voce entrar no Windows.
  echo.
  echo Para desfazer, apague este arquivo:
  echo   %ATALHO%
) else (
  echo Nao foi possivel criar o atalho de inicializacao.
)
echo.
pause
