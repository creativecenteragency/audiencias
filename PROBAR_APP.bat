@echo off
setlocal
title Audiencias - Creative Center

set "SOURCE=%~dp0"
set "LOCAL_APP=%LOCALAPPDATA%\CreativeCenter\Audiencias-local"
set "CODEX_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
set "CODEX_PNPM=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd"

echo.
echo  AUDIENCIAS - CREATIVE CENTER
echo  Preparando la prueba local...
echo.

if not exist "%CODEX_NODE%\node.exe" goto :missing_tools
if not exist "%CODEX_PNPM%" goto :missing_tools
if not exist "%LOCAL_APP%" mkdir "%LOCAL_APP%"

call :copy_folder app
if errorlevel 1 goto :copy_error
call :copy_folder public
if errorlevel 1 goto :copy_error
call :copy_folder build
if errorlevel 1 goto :copy_error
call :copy_folder worker
if errorlevel 1 goto :copy_error
call :copy_folder db
if errorlevel 1 goto :copy_error
call :copy_folder drizzle
if errorlevel 1 goto :copy_error
call :copy_folder examples
if errorlevel 1 goto :copy_error
call :copy_folder .openai
if errorlevel 1 goto :copy_error

for %%F in (package.json tsconfig.json vite.config.ts next.config.ts postcss.config.mjs eslint.config.mjs drizzle.config.ts README.md .gitignore) do (
  if exist "%SOURCE%%%F" copy /Y "%SOURCE%%%F" "%LOCAL_APP%\%%F" >nul
)

set "PATH=%CODEX_NODE%;%PATH%"
cd /d "%LOCAL_APP%"

if not exist "node_modules\vinext" (
  echo  Primera ejecucion: preparando componentes necesarios.
  echo  Esto puede demorar algunos minutos y se hace una sola vez.
  echo.
  call "%CODEX_PNPM%" install --ignore-scripts
  if errorlevel 1 goto :install_error
)

echo.
echo  Listo. Cuando aparezca Local, abri esa direccion en tu navegador.
echo  Para cerrar la app, volve a esta ventana y presiona Ctrl+C.
echo.
call "%CODEX_PNPM%" dev
goto :end

:copy_folder
if not exist "%SOURCE%%~1" exit /b 0
if not exist "%LOCAL_APP%\%~1" mkdir "%LOCAL_APP%\%~1"
robocopy "%SOURCE%%~1" "%LOCAL_APP%\%~1" /E /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 exit /b 1
exit /b 0

:missing_tools
echo  No encontre las herramientas incluidas con Codex.
echo  Abri esta carpeta desde Codex y pedi: "Inicia la app localmente".
goto :pause_end

:copy_error
echo  No pude copiar uno de los componentes de la aplicacion.
echo  Sincroniza la carpeta en Google Drive e intenta nuevamente.
goto :pause_end

:install_error
echo.
echo  No se pudieron preparar los componentes.
echo  Revisa tu conexion a Internet e intenta nuevamente.
goto :pause_end

:pause_end
echo.
pause

:end
endlocal
