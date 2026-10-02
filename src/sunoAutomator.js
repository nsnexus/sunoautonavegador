/**
 * Módulo de automação da interface e API interna do Suno
 */

/**
 * Ativa o modo Custom (Personalizado) caso ainda não esteja ativo
 */
async function ensureCustomMode(page) {
  console.log('[Suno] Verificando se o modo Custom está ativo...');
  
  const customAtivo = await page.evaluate(() => {
    // Verifica se os campos de Letra e Estilo já estão visíveis no DOM
    const textareas = document.querySelectorAll('textarea');
    const hasLyricsBox = Array.from(textareas).some((ta) => 
      /lyrics|letra/i.test(ta.placeholder || '') || /lyrics|letra/i.test(ta.getAttribute('aria-label') || '')
    );
    if (hasLyricsBox) return true;

    // Se não encontrou, procura o botão ou switch de 'Custom'
    const buttons = Array.from(document.querySelectorAll('button, [role="switch"]'));
    const customToggle = buttons.find((btn) => /custom/i.test(btn.innerText || btn.getAttribute('aria-label') || ''));
    if (customToggle) {
      customToggle.click();
      return true;
    }
    return false;
  });

  await new Promise((r) => setTimeout(r, 1000));
  return customAtivo;
}

/**
 * Preenche os campos do Suno de forma compatível com React
 */
async function fillCreationForm(page, { lyrics, style, title, instrumental = false }) {
  console.log(`[Suno] Preenchendo formulário: "${title}" (${style})...`);

  const preenchido = await page.evaluate(
    ({ lyrics, style, title, instrumental }) => {
      // Helper para disparar evento de input no React
      const setVal = (el, val) => {
        if (!el) return false;
        const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      };

      // 1. Campo de Letra (Lyrics)
      const allTextareas = Array.from(document.querySelectorAll('textarea'));
      let lyricsInput = allTextareas.find((ta) => 
        /lyrics|letra/i.test(ta.placeholder || '') || /lyrics|letra/i.test(ta.getAttribute('aria-label') || '')
      ) || allTextareas[0];

      if (lyricsInput) {
        setVal(lyricsInput, lyrics);
      }

      // 2. Campo de Estilo (Style of Music)
      const allInputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
      let styleInput = allInputs.find((inp) => 
        /style/i.test(inp.placeholder || '') || /style/i.test(inp.getAttribute('aria-label') || '')
      );
      if (styleInput) {
        setVal(styleInput, style);
      }

      // 3. Campo de Título (Title)
      let titleInput = allInputs.find((inp) => 
        /title|título/i.test(inp.placeholder || '') || /title|título/i.test(inp.getAttribute('aria-label') || '')
      );
      if (titleInput) {
        setVal(titleInput, title);
      }

      // 4. Instrumental (se aplicável)
      if (instrumental) {
        const instToggle = Array.from(document.querySelectorAll('button, [role="switch"]')).find((el) => 
          /instrumental/i.test(el.innerText || el.getAttribute('aria-label') || '')
        );
        if (instToggle && instToggle.getAttribute('aria-checked') !== 'true') {
          instToggle.click();
        }
      }

      return {
        lyricsOk: !!lyricsInput,
        styleOk: !!styleInput,
        titleOk: !!titleInput
      };
    },
    { lyrics, style, title, instrumental }
  );

  console.log('[Suno] Status dos campos preenchidos:', preenchido);
  await new Promise((r) => setTimeout(r, 1000));
}

/**
 * Clica no botão de Create e captura a resposta de geração
 */
async function clickCreateAndListen(page) {
  console.log('[Suno] Preparando para clicar em Create...');

  // Promessa que escuta a resposta de rede do Suno (generate/v2)
  let generatedClipIds = [];

  const responseHandler = async (response) => {
    try {
      const url = response.url();
      if (url.includes('/api/generate/') || url.includes('/api/generate/v2/')) {
        const json = await response.json().catch(() => null);
        if (json && json.clips && Array.isArray(json.clips)) {
          generatedClipIds = json.clips.map((c) => c.id);
          console.log('[Suno] Clips identificados via rede:', generatedClipIds);
        }
      }
    } catch (e) {}
  };

  page.on('response', responseHandler);

  // Clica no botão Create
  const clicou = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const createBtn = buttons.find((btn) => {
      const txt = (btn.innerText || '').trim();
      return /^(Create|Criar)/i.test(txt) && !btn.disabled;
    });

    if (createBtn) {
      createBtn.click();
      return true;
    }
    return false;
  });

  if (!clicou) {
    page.off('response', responseHandler);
    throw new Error('Botão "Create" não encontrado ou está desabilitado.');
  }

  console.log('[Suno] Botão "Create" clicado! Aguardando confirmação dos clips...');

  // Aguarda até 15s para a chamada de generate responder
  const startTime = Date.now();
  while (generatedClipIds.length === 0 && Date.now() - startTime < 15000) {
    await new Promise((r) => setTimeout(r, 500));
  }

  page.off('response', responseHandler);

  // Fallback caso a interceptação de rede não tenha pego os IDs: busca os clips mais recentes no DOM ou feed
  if (generatedClipIds.length === 0) {
    console.log('[Suno] Tentando recuperar clip IDs recentes via sessão...');
    generatedClipIds = await page.evaluate(async () => {
      try {
        const res = await fetch('https://studio-api.prod.suno.com/api/feed/v2?page=0');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.clips)) {
            return data.clips.slice(0, 2).map((c) => c.id);
          }
        }
      } catch (e) {}
      return [];
    });
  }

  return generatedClipIds;
}

/**
 * Aguarda a geração dos clips terminar e retorna os links
 */
async function waitForClipsReady(page, clipIds, maxWaitSeconds = 180) {
  if (!clipIds || clipIds.length === 0) {
    throw new Error('Nenhum Clip ID foi informado para monitoramento.');
  }

  console.log(`[Suno] Monitorando status dos clips: ${clipIds.join(', ')}...`);
  const startTime = Date.now();

  while ((Date.now() - startTime) / 1000 < maxWaitSeconds) {
    // Consulta o status via API interna no contexto da página autenticada
    const clipsStatus = await page.evaluate(async (ids) => {
      try {
        const query = ids.map((id) => `ids=${encodeURIComponent(id)}`).join('&');
        const res = await fetch(`https://studio-api.prod.suno.com/api/feed/v2?${query}`);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.clips)) {
            return data.clips;
          }
        }
      } catch (e) {}
      return [];
    }, clipIds);

    const completados = clipsStatus.filter((c) => c.status === 'complete' && c.audio_url);
    console.log(`[Suno] Progresso: ${completados.length}/${clipIds.length} músicas finalizadas...`);

    if (completados.length >= clipIds.length && clipIds.length > 0) {
      console.log('[Suno] ✅ Todas as músicas foram geradas com sucesso!');
      return completados.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        shareUrl: `https://suno.com/song/${c.id}`,
        audioUrl: c.audio_url || `https://cdn1.suno.ai/${c.id}.mp3`,
        videoUrl: c.video_url || `https://cdn1.suno.ai/${c.id}.mp4`,
        imageUrl: c.image_url || `https://cdn2.suno.ai/image_${c.id}.png`,
        duration: c.metadata?.duration || null
      }));
    }

    // Aguarda 6 segundos antes de consultar novamente
    await new Promise((r) => setTimeout(r, 6000));
  }

  throw new Error(`Tempo limite atingido (${maxWaitSeconds}s) aguardando as músicas ficarem prontas.`);
}

module.exports = {
  ensureCustomMode,
  fillCreationForm,
  clickCreateAndListen,
  waitForClipsReady
};
