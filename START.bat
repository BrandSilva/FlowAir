@echo off
setlocal enabledelayedexpansion
title FlowAir - Development
color 0A

set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

echo.
echo ========================================
echo        FLOWAIR - Development Mode
echo ========================================
echo.
echo [STEP 1/6] Checking system requirements...

where node >nul 2>nul
if !errorlevel! neq 0 (
    echo [ERROR] Node.js is not installed. Install the LTS version from https://nodejs.org/
    pause
    exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)" >nul 2>nul
if !errorlevel! neq 0 (
    echo [ERROR] Node.js 22.12 or newer is required. Install the LTS version from https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js found

where python >nul 2>nul
if !errorlevel! neq 0 (
    echo [ERROR] Python is not installed. Install Python 3.11 to 3.14 from https://www.python.org/
    echo         and check "Add Python to PATH" during installation.
    pause
    exit /b 1
)
echo [OK] Python found

echo.
echo [STEP 2/6] Checking FFprobe and FFmpeg...
set "FFMPEG_OK=1"
if exist "%PROJECT_DIR%ffmpeg\bin\ffprobe.exe" (
    echo [OK] FFprobe found in project folder
) else (
    set "FFMPEG_OK=0"
    echo [WARNING] ffmpeg\bin\ffprobe.exe not found - media validation will not work
)
if exist "%PROJECT_DIR%ffmpeg\bin\ffmpeg.exe" (
    echo [OK] FFmpeg found in project folder
) else (
    set "FFMPEG_OK=0"
    echo [WARNING] ffmpeg\bin\ffmpeg.exe not found - media conversion will not work
)
if "!FFMPEG_OK!"=="0" (
    echo           Download the FFmpeg 8.0.1 essentials build from https://www.gyan.dev/ffmpeg/builds/
    echo           and copy ffprobe.exe and ffmpeg.exe into ffmpeg\bin
)

echo.
echo [STEP 3/6] Preparing Python environment...
cd /d "%PROJECT_DIR%backend"
if not exist "venv\Scripts\python.exe" (
    python -c "import sys; sys.exit(0 if (3, 11) <= sys.version_info[:2] <= (3, 14) else 1)" >nul 2>nul
    if !errorlevel! neq 0 (
        echo [ERROR] The backend needs Python 3.11 to 3.14. Install Python 3.14 from https://www.python.org/
        pause
        exit /b 1
    )
    echo [SETUP] Creating virtual environment...
    python -m venv venv
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to create the virtual environment
        pause
        exit /b 1
    )
)
"venv\Scripts\python.exe" -c "import fastapi, uvicorn, psutil, obsws_python" >nul 2>nul
if !errorlevel! neq 0 (
    "venv\Scripts\python.exe" -c "import sys; sys.exit(0 if (3, 11) <= sys.version_info[:2] <= (3, 14) else 1)" >nul 2>nul
    if !errorlevel! neq 0 (
        echo [ERROR] backend\venv uses an unsupported Python. Delete backend\venv and run START.bat again with Python 3.14
        pause
        exit /b 1
    )
    echo [SETUP] Installing backend dependencies...
    "venv\Scripts\python.exe" -m pip install --disable-pip-version-check -r requirements.txt
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install Python dependencies. Check your internet connection.
        pause
        exit /b 1
    )
)
echo [OK] Python environment ready

echo.
echo [STEP 4/6] Preparing Node.js environment...
cd /d "%PROJECT_DIR%frontend"
set "NPM_OK=1"
if not exist "node_modules\electron\package.json" set "NPM_OK=0"
if not exist "node_modules\vite\bin\vite.js" set "NPM_OK=0"
if not exist "node_modules\@esbuild\win32-x64\esbuild.exe" set "NPM_OK=0"
if "!NPM_OK!"=="0" (
    echo [SETUP] Installing frontend dependencies...
    call npm install --no-audit --no-fund --cache "%TEMP%\flowair-npm-cache"
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install Node.js dependencies.
        echo [INFO] If this folder is synced by Syncthing/Dropbox or scanned by antivirus,
        echo [INFO] pause it for node_modules and retry.
        pause
        exit /b 1
    )
)
if not exist "node_modules\electron\dist\electron.exe" (
    echo [SETUP] Downloading the Electron runtime...
    node node_modules\electron\install.js
    if not exist "node_modules\electron\dist\electron.exe" (
        echo [ERROR] The Electron runtime could not be downloaded. Check your internet connection.
        pause
        exit /b 1
    )
)
echo [OK] Node.js environment ready

echo.
echo [STEP 5/6] Checking ports...
netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul
if !errorlevel! equ 0 (
    echo [WARNING] Port 8000 is already in use. FlowAir will report the conflict when it starts.
) else (
    echo [OK] Port 8000 is free
)

echo.
echo [STEP 6/6] Starting FlowAir...
title FlowAir - Running
set "ELECTRON_RUN_AS_NODE="
start "FlowAir Vite" /B cmd /c "node node_modules\vite\bin\vite.js --strictPort"
call npm start
set "EXIT_CODE=!errorlevel!"

echo.
echo Stopping development server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do taskkill /F /T /PID %%a >nul 2>nul
echo Done.

if not "!EXIT_CODE!"=="0" (
    echo [ERROR] FlowAir exited with code !EXIT_CODE!
    pause
)
