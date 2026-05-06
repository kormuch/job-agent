@echo off
title JobAgent Start

echo Stoppe alte Prozesse...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8002"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173"') do taskkill /PID %%a /F >nul 2>&1

echo Starte Backend...
start "JobAgent Backend" /min cmd /c "cd /d C:\Users\kormu\projekte\JobAgent_Tool\backend && C:\Users\kormu\anaconda3\python.exe -m uvicorn app.main:app --reload --port 8002"

echo Warte auf Backend...
timeout /t 3 /nobreak >nul

echo Starte Frontend...
start "JobAgent Frontend" /min cmd /c "cd /d C:\Users\kormu\projekte\JobAgent_Tool\frontend && npm run dev"

echo Warte auf Frontend...
timeout /t 4 /nobreak >nul

echo Oeffne Browser...
start http://localhost:5173

echo Fertig! Fenster schliesst sich.
timeout /t 2 /nobreak >nul
