@echo off
setlocal
cd /d "%~dp0"
title Audiencias V2 - Conectar Tiendanube
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\conectar-tiendanube.ps1"
pause