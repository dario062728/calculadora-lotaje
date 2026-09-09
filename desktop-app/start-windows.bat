@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Se necesitan permisos de administrador para bloquear sitios a nivel de sistema.
    echo Se va a abrir un dialogo de Windows pidiendo confirmacion...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

where node >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo Node.js no esta instalado.
    echo Instalalo desde https://nodejs.org ^(version LTS, boton verde^) y volve a ejecutar este archivo.
    echo.
    pause
    exit /b
)

echo Iniciando Bloqueo Operativo...
node server.js
pause
