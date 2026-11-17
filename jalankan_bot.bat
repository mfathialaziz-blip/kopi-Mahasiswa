@echo off
title WhatsApp Bot Kopi Mahasiswa
echo ========================================================
echo   MENJALANKAN BOT WHATSAPP KOPI MAHASISWA
echo ========================================================
echo.
cd /d %~dp0
echo Memeriksa port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo Menutup proses sebelumnya (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul
echo Memulai bot...
node index.js
pause

