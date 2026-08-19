import { verifySupabaseToken } from '../config/supabase.js';
import { DB } from '../db.js';

/**
 * Middleware d'authentification Supabase & Session locale
 * Vérifie le header 'Authorization: Bearer <token>'
 */
export async function authenticateSupabase(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Accès refusé. En-tête d\'autorisation manquant ou invalide.'
    });
  }

  const token = authHeader.substring(7).trim();

  // 1. Essayer de valider le token avec Supabase Auth
  try {
    const supabaseUser = await verifySupabaseToken(token);
    if (supabaseUser) {
      req.user = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name: supabaseUser.user_metadata?.full_name || supabaseUser.email.split('@')[0],
        avatar: supabaseUser.user_metadata?.avatar_url || null,
        provider: 'supabase'
      };
      return next();
    }
  } catch (err) {
    // Si la vérification Supabase échoue, continuer avec la session locale
  }

  // 2. Fallback: Vérifier si le token correspond à une session locale active
  if (DB.sessions.has(token)) {
    const localUser = DB.sessions.get(token);
    req.user = {
      id: localUser.id,
      email: localUser.email,
      name: localUser.name,
      avatar: localUser.avatar,
      provider: 'local'
    };
    return next();
  }

  return res.status(401).json({
    success: false,
    message: 'Session expirée ou jeton d\'authentification invalide.'
  });
}

/**
 * Middleware d'authentification optionnel
 * Si un token est présent, attache l'utilisateur à req.user. Sinon, continue en invité.
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7).trim();

  try {
    const supabaseUser = await verifySupabaseToken(token);
    if (supabaseUser) {
      req.user = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name: supabaseUser.user_metadata?.full_name || supabaseUser.email.split('@')[0],
        provider: 'supabase'
      };
      return next();
    }
  } catch (err) {
    // ignore
  }

  if (DB.sessions.has(token)) {
    req.user = DB.sessions.get(token);
    return next();
  }

  req.user = null;
  next();
}
