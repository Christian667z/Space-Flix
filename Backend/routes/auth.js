import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { DB, persistDatabase, resolveUser, DEFAULT_USER_ID } from '../db.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import { authenticateSupabase } from '../middlewares/auth.js';

const router = express.Router();

// Rate limiter simple en mémoire
const RATE_LIMIT_STORE = new Map();
function rateLimit(windowMs = 15 * 60 * 1000, maxRequests = 30) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'client-ip';
    const now = Date.now();
    const clientRecord = RATE_LIMIT_STORE.get(ip) || { count: 0, resetAt: now + windowMs };

    if (now > clientRecord.resetAt) {
      clientRecord.count = 1;
      clientRecord.resetAt = now + windowMs;
    } else {
      clientRecord.count += 1;
    }

    RATE_LIMIT_STORE.set(ip, clientRecord);

    if (clientRecord.count > maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Trop de requêtes. Veuillez patienter avant de réessayer.',
        retryAfterSeconds: Math.ceil((clientRecord.resetAt - now) / 1000)
      });
    }
    next();
  };
}

/**
 * POST /api/auth/register
 * Inscription utilisateur (Supporte Supabase et compte local sécurisé)
 */
router.post('/register', rateLimit(15 * 60 * 1000, 10), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email et mot de passe requis.' });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Le mot de passe doit comporter au moins 6 caractères.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Format d\'adresse email invalide.' });
    }

    if (DB.users.has(cleanEmail)) {
      return res.status(409).json({ success: false, message: 'Un compte avec cet email existe déjà.' });
    }

    // 1. Tenter l'inscription dans Supabase si le client est configuré
    let supabaseUser = null;
    let supabaseSession = null;
    const supabase = getSupabaseAdmin();

    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: { full_name: name || cleanEmail.split('@')[0] }
          }
        });
        if (!error && data?.user) {
          supabaseUser = data.user;
          supabaseSession = data.session;
        }
      } catch (sbErr) {
        console.warn('[AUTH] Inscription Supabase en mode fallback:', sbErr.message);
      }
    }

    // 2. Création de l'utilisateur dans la base persistante
    const userId = supabaseUser ? supabaseUser.id : `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const passwordHash = bcrypt.hashSync(password, 10);
    
    const newUser = {
      id: userId,
      email: cleanEmail,
      name: (name && String(name).trim()) || cleanEmail.split('@')[0],
      passwordHash,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
      createdAt: new Date().toISOString()
    };

    DB.users.set(cleanEmail, newUser);
    DB.history.set(userId, []);
    DB.favorites.set(userId, new Set());

    const token = supabaseSession?.access_token || `tok_${crypto.randomBytes(32).toString('hex')}`;
    DB.sessions.set(token, newUser);
    persistDatabase();

    const { passwordHash: _, ...safeUser } = newUser;

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès !',
      user: safeUser,
      token
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Connexion utilisateur avec validation bcrypt et Supabase
 */
router.post('/login', rateLimit(15 * 60 * 1000, 20), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Veuillez saisir votre email et votre mot de passe.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    let user = DB.users.get(cleanEmail);

    // 1. Tenter la connexion Supabase si configuré
    let supabaseToken = null;
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password
        });
        if (!error && data?.session) {
          supabaseToken = data.session.access_token;
          if (!user) {
            user = {
              id: data.user.id,
              email: cleanEmail,
              name: data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
              passwordHash: bcrypt.hashSync(password, 10),
              avatar: data.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
              createdAt: new Date().toISOString()
            };
            DB.users.set(cleanEmail, user);
            DB.history.set(user.id, []);
            DB.favorites.set(user.id, new Set());
          }
        }
      } catch (sbErr) {
        console.warn('[AUTH] Connexion Supabase fallback:', sbErr.message);
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect.' });
    }

    if (!supabaseToken) {
      const isMatch = user.passwordHash ? bcrypt.compareSync(password, user.passwordHash) : false;
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect.' });
      }
    }

    const token = supabaseToken || `tok_${crypto.randomBytes(32).toString('hex')}`;
    DB.sessions.set(token, user);
    persistDatabase();

    const { passwordHash: _, ...safeUser } = user;

    res.json({
      success: true,
      message: 'Connexion réussie !',
      user: safeUser,
      token
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Renvoie le profil utilisateur actif
 */
router.get('/me', (req, res, next) => {
  try {
    const user = resolveUser(req);
    if (user) {
      const { passwordHash: _, ...safeUser } = user;
      return res.json({ success: true, user: safeUser, authenticated: true });
    }

    res.json({
      success: true,
      user: {
        id: DEFAULT_USER_ID,
        email: 'guest@spaceflix.online',
        name: 'Invité Stream',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
        isGuest: true
      },
      authenticated: false
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/auth/profile
 * Mise à jour du profil utilisateur
 */
router.put('/profile', (req, res, next) => {
  try {
    const user = resolveUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentification requise.' });
    }

    const { name, avatar } = req.body;
    if (name && typeof name === 'string') {
      user.name = name.trim().slice(0, 50);
    }
    if (avatar && typeof avatar === 'string') {
      user.avatar = avatar.trim().slice(0, 500);
    }
    user.updatedAt = new Date().toISOString();

    DB.users.set(user.email, user);
    persistDatabase();

    const { passwordHash: _, ...safeUser } = user;
    res.json({ success: true, message: 'Profil mis à jour avec succès.', user: safeUser });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/auth/password
 * Modification sécurisée du mot de passe
 */
router.put('/password', (req, res, next) => {
  try {
    const user = resolveUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentification requise.' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Mot de passe actuel et nouveau mot de passe requis.' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit comporter au moins 6 caractères.' });
    }

    const isCurrentValid = user.passwordHash ? bcrypt.compareSync(currentPassword, user.passwordHash) : false;
    if (!isCurrentValid) {
      return res.status(401).json({ success: false, message: 'Mot de passe actuel incorrect.' });
    }

    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    user.updatedAt = new Date().toISOString();
    DB.users.set(user.email, user);
    persistDatabase();

    res.json({ success: true, message: 'Mot de passe modifié avec succès.' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 * Déconnexion de la session
 */
router.post('/logout', (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      DB.sessions.delete(token);
      persistDatabase();
    }
    res.json({ success: true, message: 'Déconnexion effectuée.' });
  } catch (err) {
    next(err);
  }
});

export default router;
