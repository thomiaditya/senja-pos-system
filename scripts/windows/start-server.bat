@echo off
rem Menjalankan server Kopi Senja POS dengan Node.js portable dari folder .tools.
setlocal
cd /d "%~dp0..\.."

if not exist ".tools\node\node.exe" (
  echo Node.js belum terpasang. Jalankan scripts\windows\install.bat terlebih dahulu.
  pause
  exit /b 1
)
if not exist ".next\BUILD_ID" (
  echo Build belum ditemukan. Jalankan scripts\windows\install.bat terlebih dahulu.
  pause
  exit /b 1
)

set "PATH=%CD%\.tools\node;%PATH%"
if not defined PORT set "PORT=3000"

echo Kopi Senja POS berjalan di http://localhost:%PORT%
echo Tutup jendela ini untuk menghentikan server.
echo.
call pnpm start
pause
