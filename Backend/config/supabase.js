import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

/**
 * Initialisation Lazy du client Supabase Admin
 * Évite le crash de démarrage si les variables d'environnement ne sont pas définies
 */
export function getSupabaseAdmin() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Client mock / non configuré
    return null;
  }

  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    return supabaseClient;
  } catch (err) {
    console.warn('[SUPABASE] Erreur lors de l\'initialisation du client Supabase:', err.message);
    return null;
  }
}

export const isSupabaseConfigured = () => {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY));
};
