@echo off
REM Caminho com espacos quebra o linker GNU — usa junction sem espacos
set "APP_DIR=C:\Users\Sancs\guia-conquistas"
if not exist "%APP_DIR%" (
  echo Criando atalho sem espacos no caminho...
  mkdir "C:\Users\Sancs" 2>nul
  cmd /c mklink /J "%APP_DIR%" "%~dp0"
)
cd /d "%APP_DIR%"
echo Iniciando myConquist (Tauri)...
echo Pasta: %CD%
call npm run tauri:dev
pause
