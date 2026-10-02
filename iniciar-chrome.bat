@echo off
chcp 65001 > nul
echo ========================================================
echo    Iniciando Google Chrome com Depuração Remota (Suno)
echo ========================================================
echo.
echo Porta configurada: 9222
echo Perfil dedicado: %LOCALAPPDATA%\ChromeSunoBot
echo.
echo DICA: Faça login na sua conta do Suno nesta janela que se abrirá.
echo Seu login ficará gravado para as próximas automações!
echo ========================================================
echo.

set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist %CHROME_PATH% set CHROME_PATH="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist %CHROME_PATH% set CHROME_PATH="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if not exist %CHROME_PATH% (
    echo [AVISO] Google Chrome não encontrado no caminho padrão. Tentando Microsoft Edge...
    set CHROME_PATH="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    if not exist %CHROME_PATH% set CHROME_PATH="C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)

if not exist %CHROME_PATH% (
    echo [ERRO] Não foi possível encontrar Google Chrome nem Microsoft Edge.
    echo Por favor, verifique o caminho do seu navegador.
    pause
    exit /b 1
)

start "" %CHROME_PATH% --remote-debugging-port=9222 --user-data-dir="%LOCALAPPDATA%\ChromeSunoBot" "https://suno.com/create"
echo Chrome aberto com sucesso!
