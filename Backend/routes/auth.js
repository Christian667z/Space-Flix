import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { DB, persistDatabase, resolveUser, DEFAULT_USER_ID } from '../db.js';

const router = express.Router();

// Rate limiter simple en mémoire pour les routes sensibles
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
        error: 'Trop de requêtes. Veuillez patienter avant de réessayer.',
        retryAfterSeconds: Math.ceil((clientRecord.resetAt - now) / 1000)
      });
    }
    next();
  };
}

// Inscription sécurisée avec hachage bcrypt
router.post('/register', rateLimit(15 * 60 * 1000, 10), (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit comporter au moins 6 caractères.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ error: 'Format d\'adresse email invalide.' });
  }

  if (DB.users.has(cleanEmail)) {
    return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });
  }

  const userId = `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
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

  // Créer un token de session
  const token = `tok_${crypto.randomBytes(32).toString('hex')}`;
  DB.sessions.set(token, newUser);
  persistDatabase();

  const { passwordHash: _, ...safeUser } = newUser;

  res.status(201).json({
    message: 'Compte créé avec succès !',
    user: safeUser,
    token
  });
});

// Connexion sécurisée avec vérification de mot de passe
router.post('/login', rateLimit(15 * 60 * 1000, 20), (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Veuillez saisir votre email et votre mot de passe.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const user = DB.users.get(cleanEmail);

  if (!user) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }

  const isMatch = user.passwordHash ? bcrypt.compareSync(password, user.passwordHash) : false;
  if (!isMatch) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }

  const token = `tok_${crypto.randomBytes(32).toString('hex')}`;
  DB.sessions.set(token, user);
  persistDatabase();

  const { passwordHash: _, ...safeUser } = user;

  res.json({
    message: 'Connexion réussie !',
    user: safeUser,
    token
  });
});

// Profil Actif
router.get('/me', (req, res) => {
  const user = resolveUser(req);
  if (user) {
    const { passwordHash: _, ...safeUser } = user;
    return res.json({ user: safeUser, authenticated: true });
  }

  res.json({
    user: {
      id: DEFAULT_USER_ID,
      email: 'guest@handyflix.online',
      name: 'Invité Stream',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      isGuest: true
    },
    authenticated: false
  });
});

// Mise à jour du profil utilisateur
router.put('/profile', (req, res) => {
  const user = resolveUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentification requise.' });
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
  res.json({ success: true, message: 'Profil mis à jour.', user: safeUser });
});

// Changement de mot de passe sécurisé
router.put('/password', (req, res) => {
  const user = resolveUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit comporter au moins 6 caractères.' });
  }

  const isCurrentValid = user.passwordHash ? bcrypt.compareSync(currentPassword, user.passwordHash) : false;
  if (!isCurrentValid) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
  }

  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  user.updatedAt = new Date().toISOString();
  DB.users.set(user.email, user);
  persistDatabase();

  res.json({ success: true, message: 'Mot de passe modifié avec succès.' });
});

// Déconnexion
router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    DB.sessions.delete(token);
    persistDatabase();
  }
  res.json({ message: 'Déconnexion effectuée.' });
});

export default router;
