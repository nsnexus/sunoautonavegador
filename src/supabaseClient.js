const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

let supabase = null;

function getSupabase() {
  if (!supabase) {
    if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[Supabase] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no .env.');
      return null;
    }
    supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false }
    });
  }
  return supabase;
}

/**
 * Busca um pedido por ID ou orderNumber
 */
async function getOrder(orderId) {
  const client = getSupabase();
  if (!client) return null;

  // Busca por id primário
  let { data, error } = await client
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (!data && !error) {
    // Tenta por orderNumber
    const res = await client
      .from('orders')
      .select('*')
      .eq('orderNumber', orderId)
      .maybeSingle();
    data = res.data;
    error = res.error;
  }

  if (error) {
    console.error(`[Supabase] Erro ao buscar pedido ${orderId}:`, error.message);
    return null;
  }

  return data;
}

/**
 * Busca pedidos pendentes marcados para geração local
 */
async function getPendingLocalOrders() {
  const client = getSupabase();
  if (!client) return [];

  // Busca pedidos onde suno_provider = 'local' e status aguardando geração
  const { data, error } = await client
    .from('orders')
    .select('*')
    .or('suno_provider.eq.local,status.eq.AGUARDANDO_GERACAO_LOCAL')
    .limit(5);

  if (error) {
    console.error('[Supabase] Erro ao buscar pedidos locais:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Salva os resultados do Suno no pedido
 */
async function saveSunoResults(orderId, clips, { setAsMainAudio = false } = {}) {
  const client = getSupabase();
  if (!client) return false;

  const audioUrls = clips.map((c) => c.audioUrl).filter(Boolean);
  const shareUrls = clips.map((c) => c.shareUrl).filter(Boolean);

  const updates = {
    suno_local_clips: clips,
    suno_share_urls: shareUrls,
    suno_local_generated_at: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Se solicitado, atualiza também os campos canônicos de áudio do pedido
  if (setAsMainAudio && audioUrls.length > 0) {
    updates.audioUrl = audioUrls[0];
    updates.audioFiles = audioUrls;
    updates.audioStatus = 'COMPLETED';
    updates.status = 'AUDIO_GERADO';
  }

  const { error } = await client
    .from('orders')
    .update(updates)
    .eq('id', orderId);

  if (error) {
    console.error(`[Supabase] Erro ao salvar clips no pedido ${orderId}:`, error.message);
    return false;
  }

  console.log(`[Supabase] ✅ Pedido ${orderId} atualizado com os links do Suno!`);
  return true;
}

module.exports = {
  getSupabase,
  getOrder,
  getPendingLocalOrders,
  saveSunoResults
};
