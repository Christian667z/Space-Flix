import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// =========================================================================
// 1. SYSTÈME DE CACHE MÉMOIRE
// =========================================================================
export const CACHE_STORE = new Map();
const DEFAULT_TTL_MS = 60 * 60 * 1000;

export function getFromCache(key) {
  const item = CACHE_STORE.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    CACHE_STORE.delete(key);
    return null;
  }
  return item.data;
}

export function setInCache(key, data, ttlMs = DEFAULT_TTL_MS) {
  if (CACHE_STORE.size > 500) {
    const oldestKey = CACHE_STORE.keys().next().value;
    CACHE_STORE.delete(oldestKey);
  }
  CACHE_STORE.set(key, {
    data,
    expiry: Date.now() + ttlMs,
    createdAt: new Date().toISOString()
  });
}

// =========================================================================
// 2. BASE DE DONNÉES EN MÉMOIRE PERSISTANTE
// =========================================================================
export const DB = {
  users: new Map(), // email -> user data
  sessions: new Map(), // token -> user
  history: new Map(), // userId -> [history items]
  favorites: new Map(), // userId -> Set of mediaIds
  reports: [] // [broken stream reports]
};

// Initialisation utilisateur démo
const demoPasswordHash = bcrypt.hashSync('demo1234', 10);
DB.users.set('demo@spaceflix.com', {
  id: 'user-demo-1',
  email: 'demo@spaceflix.com',
  name: 'Cinéphile VIP',
  passwordHash: demoPasswordHash,
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
  createdAt: new Date().toISOString()
});
DB.history.set('user-demo-1', []);
DB.favorites.set('user-demo-1', new Set());

export function loadDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      
      if (Array.isArray(data.users)) {
        for (const u of data.users) {
          DB.users.set(u.email, u);
        }
      }
      if (Array.isArray(data.sessions)) {
        for (const [token, user] of data.sessions) {
          const freshUser = DB.users.get(user.email) || user;
          DB.sessions.set(token, freshUser);
        }
      }
      if (Array.isArray(data.history)) {
        for (const [userId, hist] of data.history) {
          DB.history.set(userId, hist);
        }
      }
      if (Array.isArray(data.favorites)) {
        for (const [userId, favs] of data.favorites) {
          DB.favorites.set(userId, new Set(favs));
        }
      }
      if (Array.isArray(data.reports)) {
        DB.reports = data.reports;
      }
      console.log('[DB] Base de données et sessions locales chargées avec succès.');
    }
  } catch (err) {
    console.warn('[DB] Impossible de charger la base locale:', err.message);
  }
}

let saveTimeout = null;
export function persistDatabase() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const serializable = {
        users: Array.from(DB.users.values()),
        sessions: Array.from(DB.sessions.entries()),
        history: Array.from(DB.history.entries()),
        favorites: Array.from(DB.favorites.entries()).map(([k, set]) => [k, Array.from(set)]),
        reports: DB.reports.slice(0, 100)
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(serializable, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[DB] Erreur sauvegarde disque:', err.message);
    }
  }, 1000);
}

// Helpers d'authentification
export const DEFAULT_USER_ID = 'guest-user-default';

export function resolveUser(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token && DB.sessions.has(token)) {
      return DB.sessions.get(token);
    }
  }
  return null;
}

export function resolveUserId(req) {
  const user = resolveUser(req);
  if (user) return user.id;
  return DEFAULT_USER_ID;
}

// Initialiser le chargement au démarrage
loadDatabase();
