@echo off
rem Pembungkus double-click untuk install.ps1. Memasang repo tempat file ini berada.
setlocal
for %%I in ("%~dp0..\..") do set "REPO_DIR=%%~fI"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -InstallDir "%REPO_DIR%"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
  echo Instalasi selesai.
) else (
  echo Instalasi gagal. Periksa pesan error di atas.
)
pause
exit /b %EXIT_CODE%
