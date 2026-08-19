import { createClient } from '@supabase/supabase-js';

// Configuration par défaut (Fallback si les variables d'environnement ne sont pas définies)
const DEFAULT_SUPABASE_URL = 'https://gfjyywtxshebhteaxxtf.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdmanl5d3R4c2hlYmh0ZWF4eHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNTc4NjYsImV4cCI6MjEwMjYzMzg2Nn0.G8EwY9CNUA6fW3d8XqKSjM5qhE8-67qgcUsp0BVPHP0';

export const SUPABASE_URL = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

let supabaseAdminClient = null;

/**
 * Initialisation Lazy du client Supabase Admin / Service
 */
export function getSupabaseAdmin() {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const keyToUse = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !keyToUse) {
    console.warn('[SUPABASE] URL ou clé Supabase manquante.');
    return null;
  }

  try {
    supabaseAdminClient = createClient(SUPABASE_URL, keyToUse, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    return supabaseAdminClient;
  } catch (err) {
    console.warn('[SUPABASE] Erreur lors de l\'initialisation du client Supabase:', err.message);
    return null;
  }
}

/**
 * Vérifie un token JWT Supabase transmis dans le header Authorization
 */
export async function verifySupabaseToken(token) {
  if (!token) return null;
  
  const client = getSupabaseAdmin();
  if (!client) return null;

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data || !data.user) {
      return null;
    }
    return data.user;
  } catch (err) {
    console.warn('[SUPABASE AUTH] Erreur lors de la validation du token:', err.message);
    return null;
  }
}

/**
 * Diagnostic des variables d'environnement Supabase & TMDB
 */
export function checkEnvironmentVariables() {
  const status = {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    TMDB_API_KEY: Boolean(process.env.TMDB_API_KEY || '99b995150ed16f5fc8a3fff320ca41df')
  };

  console.log('--- [ENV CHECK] Vérification des variables d\'environnement ---');
  console.log(`• SUPABASE_URL: ${status.SUPABASE_URL ? '✅ Configuré' : '❌ Manquant'}`);
  console.log(`• SUPABASE_ANON_KEY: ${status.SUPABASE_ANON_KEY ? '✅ Configuré' : '❌ Manquant'}`);
  console.log(`• TMDB_API_KEY: ${status.TMDB_API_KEY ? '✅ Configuré' : '❌ Manquant'}`);
  console.log('------------------------------------------------------------');

  return status;
}

export const isSupabaseConfigured = () => {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
};
