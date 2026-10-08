@echo off
title Caisse CISPOLstore
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe sur cet ordinateur.
  echo Installez la version LTS depuis https://nodejs.org puis relancez ce fichier.
  pause
  exit /b
)
:boucle
node server.js
echo.
echo La caisse s'est arretee. Redemarrage automatique dans 5 secondes...
timeout /t 5 >nul
goto boucle
