@echo off
title Huawei Network Manager - Inicializador
echo Iniciando Backend FastAPI (Porta 8000)...
start "Huawei Backend API" cmd /k "cd /d %~dp0 && .\.venv\Scripts\uvicorn backend.main:app --host 0.0.0.0 --port 8000"

echo Iniciando Frontend Next.js (Porta 3000)...
start "Huawei Frontend Web" cmd /k "cd /d %~dp0\frontend && npm start -- -p 3000"

timeout /t 3 /nobreak >nul
start http://localhost:3000
echo Painel iniciado em http://localhost:3000

