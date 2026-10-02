const { connectBrowser, getOrCreateSunoPage, checkLoginStatus } = require('./browser');
const { ensureCustomMode, fillCreationForm, clickCreateAndListen, waitForClipsReady } = require('./sunoAutomator');
const { getOrder, getPendingLocalOrders, saveSunoResults } = require('./supabaseClient');
const config = require('./config');

/**
 * Executa o fluxo de geração de uma música no Suno
 */
async function processarCriacao({ lyrics, style, title, orderId = null, setAsMainAudio = false }) {
  console.log('\n======================================================');
  console.log(`🎵 INICIANDO GERAÇÃO: "${title}"`);
  console.log(`Estilo: ${style}`);
  console.log(`Letra (${lyrics.length} caracteres)`);
  if (orderId) console.log(`Vinculado ao Pedido: ${orderId}`);
  console.log('======================================================\n');

  const browser = await connectBrowser();
  const page = await getOrCreateSunoPage(browser);

  // Validação de login
  const logado = await checkLoginStatus(page);
  if (!logado) {
    console.warn('\n⚠️ [ATENÇÃO] O navegador parece não estar logado na sua conta do Suno!');
    console.warn('Faça login na janela do Chrome aberta e tente novamente.\n');
  }

  // 1. Garante o modo Custom
  await ensureCustomMode(page);

  // 2. Preenche os campos
  await fillCreationForm(page, { lyrics, style, title });

  // 3. Clica em Create
  const clipIds = await clickCreateAndListen(page);
  console.log(`\n🎧 Solicitação enviada! Clip IDs: ${clipIds.join(', ')}`);

  // 4. Aguarda a finalização
  const clipsProntos = await waitForClipsReady(page, clipIds);

  console.log('\n======================================================');
  console.log('🎉 GERAÇÃO CONCLUÍDA COM SUCESSO!');
  console.log('======================================================');
  clipsProntos.forEach((c, idx) => {
    console.log(`\n▶️ Faixa ${idx + 1}:`);
    console.log(`   Título: ${c.title}`);
    console.log(`   Link Compartilhado: ${c.shareUrl}`);
    console.log(`   Áudio Direto:       ${c.audioUrl}`);
    if (c.videoUrl) console.log(`   Vídeo MP4:          ${c.videoUrl}`);
  });
  console.log('======================================================\n');

  // 5. Salva no Supabase se houver pedido vinculado
  if (orderId) {
    await saveSunoResults(orderId, clipsProntos, { setAsMainAudio });
  }

  // Desconecta do browser (sem fechar o Chrome)
  browser.disconnect();
  return clipsProntos;
}

/**
 * Loop contínuo de monitoramento de pedidos
 */
async function startWatchMode() {
  console.log('\n👀 [MODO WATCH INICIADO]');
  console.log(`Monitorando pedidos pendentes a cada ${config.POLL_INTERVAL_MS / 1000}s...`);
  console.log('Pressione Ctrl+C para encerrar.\n');

  let processando = false;

  setInterval(async () => {
    if (processando) return;
    try {
      const pendentes = await getPendingLocalOrders();
      if (pendentes.length > 0) {
        processando = true;
        const pedido = pendentes[0];
        console.log(`[Watch] Novo pedido encontrado: #${pedido.orderNumber || pedido.id}`);

        const lyrics = pedido.lyrics || pedido.lyricsApproved || pedido.story;
        const style = pedido.style || pedido.genre || 'Acoustic Pop';
        const title = pedido.songTitle || pedido.honoreeName || 'Minha Homenagem';

        if (!lyrics) {
          console.warn(`[Watch] Pedido ${pedido.id} não possui letra registrada. Ignorando.`);
          processando = false;
          return;
        }

        await processarCriacao({
          lyrics,
          style,
          title,
          orderId: pedido.id,
          setAsMainAudio: false
        });
        processando = false;
      }
    } catch (e) {
      console.error('[Watch] Erro no loop de monitoramento:', e.message);
      processando = false;
    }
  }, config.POLL_INTERVAL_MS);
}

/**
 * Ponto de entrada CLI
 */
async function main() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const found = args.find((a) => a.startsWith(`--${name}=`));
    return found ? found.split('=')[1] : null;
  };

  const hasFlag = (name) => args.includes(`--${name}`);

  if (hasFlag('help') || args.length === 0) {
    console.log(`
Uso do sunoautonavegador:

  1. Testar com um Pedido do Supabase:
     node src/index.js --order=<ORDER_ID> [--main-audio]

  2. Testar com letra manual direta:
     node src/index.js --title="Minha Canção" --style="Sertanejo Acústico" --lyrics="[Verso]\nEra uma vez...\n[Refrão]\nTe amo tanto..."

  3. Modo Monitor (Worker em Segundo Plano):
     node src/index.js --watch

  Pré-requisito:
     Execute "iniciar-chrome.bat" antes para deixar o Chrome aberto na porta 9222.
`);
    return;
  }

  if (hasFlag('watch')) {
    await startWatchMode();
    return;
  }

  const orderId = getArg('order');
  if (orderId) {
    console.log(`[CLI] Buscando informações do pedido ${orderId} no Supabase...`);
    const order = await getOrder(orderId);
    if (!order) {
      console.error(`[CLI] Pedido ${orderId} não encontrado no banco.`);
      process.exit(1);
    }

    const lyrics = order.lyrics || order.lyricsApproved || order.story;
    const style = getArg('style') || order.style || order.genre || 'Acoustic Pop';
    const title = getArg('title') || order.songTitle || order.honoreeName || 'Homenagem';
    const setAsMainAudio = hasFlag('main-audio');

    if (!lyrics) {
      console.error(`[CLI] O pedido ${orderId} não possui letra gerada/aprovada.`);
      process.exit(1);
    }

    await processarCriacao({ lyrics, style, title, orderId: order.id, setAsMainAudio });
    return;
  }

  const lyrics = getArg('lyrics');
  const style = getArg('style') || 'Acoustic Pop';
  const title = getArg('title') || 'Música de Teste';

  if (lyrics) {
    await processarCriacao({ lyrics, style, title });
    return;
  }

  console.warn('[CLI] Nenhuma opção válida informada. Use --help para ver as instruções.');
}

main().catch((err) => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
