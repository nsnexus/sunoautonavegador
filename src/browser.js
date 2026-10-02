const puppeteer = require('puppeteer-core');
const config = require('./config');

/**
 * Conecta ao Chrome existente via Chrome DevTools Protocol (CDP)
 */
async function connectBrowser() {
  const endpoint = `http://127.0.0.1:${config.CHROME_DEBUG_PORT}`;
  try {
    const browser = await puppeteer.connect({
      browserURL: endpoint,
      defaultViewport: null
    });
    console.log(`[Browser] Conectado com sucesso ao Chrome na porta ${config.CHROME_DEBUG_PORT}`);
    return browser;
  } catch (error) {
    throw new Error(
      `Não foi possível conectar ao Chrome em ${endpoint}.\n` +
      `Verifique se o Chrome foi iniciado executando o arquivo "iniciar-chrome.bat" ou com o parâmetro --remote-debugging-port=${config.CHROME_DEBUG_PORT}.\n` +
      `Detalhes: ${error.message}`
    );
  }
}

/**
 * Localiza uma aba já aberta do Suno ou abre uma nova
 */
async function getOrCreateSunoPage(browser) {
  const pages = await browser.pages();
  let sunoPage = pages.find((p) => p.url().includes('suno.com'));

  if (sunoPage) {
    console.log('[Browser] Aba existente do Suno encontrada. Trazendo para frente...');
    await sunoPage.bringToFront();
    if (!sunoPage.url().includes('/create')) {
      await sunoPage.goto(config.SUNO_URL, { waitUntil: 'domcontentloaded' });
    }
  } else {
    console.log('[Browser] Nenhuma aba do Suno aberta. Abrindo https://suno.com/create...');
    sunoPage = await browser.newPage();
    await sunoPage.goto(config.SUNO_URL, { waitUntil: 'domcontentloaded' });
  }

  // Aguarda carregar
  await new Promise((r) => setTimeout(r, 2000));
  return sunoPage;
}

/**
 * Verifica se a sessão do Suno está logada
 */
async function checkLoginStatus(page) {
  const isLoggedIn = await page.evaluate(() => {
    // Procura por botões de login ou perfil
    const text = document.body ? document.body.innerText : '';
    const hasSignIn = /Sign in|Log in|Entrar/i.test(text);
    const hasCredits = /\d+\s*credits|créditos/i.test(text);
    const hasAvatar = !!document.querySelector('button[aria-label*="Profile"], img[alt*="avatar"], button[aria-label*="User"]');
    return hasCredits || hasAvatar || !hasSignIn;
  });

  return isLoggedIn;
}

module.exports = {
  connectBrowser,
  getOrCreateSunoPage,
  checkLoginStatus
};
