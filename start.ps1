# JobAgent — Server starten
# Ausfuehren mit: powershell -ExecutionPolicy Bypass -File start.ps1

Write-Host "Stoppe alte Prozesse..." -ForegroundColor Yellow

# Alle uvicorn + vite Prozesse beenden
Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*uvicorn*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess |
    Where-Object { $_ -gt 0 } |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess |
    Where-Object { $_ -gt 0 } |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 1

Write-Host "Starte Backend (Port 8000)..." -ForegroundColor Cyan
Start-Process -FilePath "C:\Users\kormu\anaconda3\python.exe" `
    -ArgumentList "-m uvicorn app.main:app --reload --port 8002" `
    -WorkingDirectory "C:\Users\kormu\projekte\JobAgent_Tool\backend" `
    -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "Starte Frontend (Port 5173)..." -ForegroundColor Cyan
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c npm run dev" `
    -WorkingDirectory "C:\Users\kormu\projekte\JobAgent_Tool\frontend" `
    -WindowStyle Normal

Write-Host ""
Write-Host "Fertig!" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:  http://localhost:8002" -ForegroundColor White
Write-Host "  API Docs: http://localhost:8002/docs" -ForegroundColor White
