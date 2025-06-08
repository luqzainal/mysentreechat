@echo off
echo ===== MEMULAKAN PROSES DEPLOY =====

echo 1. Memasang dependencies...
cd frontend
call npm install
if errorlevel 1 (
    echo Ralat: Gagal memasang dependencies
    exit /b 1
)

echo 2. Membina aplikasi untuk production...
call npm run build
if errorlevel 1 (
    echo Ralat: Gagal membina aplikasi
    exit /b 1
)

echo 3. Memasang serve untuk menjalankan aplikasi...
call npm install -g serve
if errorlevel 1 (
    echo Ralat: Gagal memasang serve
    exit /b 1
)

echo 4. Menjalankan aplikasi...
echo Aplikasi akan berjalan di http://localhost:4173
echo Tekan Ctrl+C untuk berhenti
serve -s dist -l 4173

pause 