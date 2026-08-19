import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import bcrypt from 'bcryptjs';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour parser JSON et URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================================================================
// 1. SYSTÈME DE CACHE MÉMOIRE HAUTE PERFORMANCE (TTL & LRU)
// =========================================================================
const CACHE_STORE = new Map();
const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 heure par défaut

function getFromCache(key) {
  const item = CACHE_STORE.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    CACHE_STORE.delete(key);
    return null;
  }
  return item.data;
}

function setInCache(key, data, ttlMs = DEFAULT_TTL_MS) {
  // Limiter la taille du cache à 500 entrées max pour préserver la RAM
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
// 2. STOCKAGE PERSISTANT LOCAL AVEC FICHIER JSON (.data/db.json)
// =========================================================================
const DATA_DIR = path.join(__dirname, '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DB = {
  users: new Map(), // email -> user data (with passwordHash)
  sessions: new Map(), // token -> user
  history: new Map(), // userId -> [history items]
  favorites: new Map(), // userId -> Set of mediaIds
  reports: [] // [broken stream reports]
};

// Initialisation utilisateur démo
const demoPasswordHash = bcrypt.hashSync('demo1234', 10);
DB.users.set('demo@handyflix.com', {
  id: 'user-demo-1',
  email: 'demo@handyflix.com',
  name: 'Cinéphile VIP',
  passwordHash: demoPasswordHash,
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
  createdAt: new Date().toISOString()
});
DB.history.set('user-demo-1', []);
DB.favorites.set('user-demo-1', new Set());

// Charger la base de données depuis le disque si elle existe
function loadDatabase() {
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
      console.log('[DB] Base de données locale chargée avec succès.');
    }
  } catch (err) {
    console.warn('[DB] Impossible de charger la base locale, utilisation de la mémoire:', err.message);
  }
}

// Sauvegarde debouncée sur disque
let saveTimeout = null;
function persistDatabase() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const serializable = {
        users: Array.from(DB.users.values()),
        history: Array.from(DB.history.entries()),
        favorites: Array.from(DB.favorites.entries()).map(([k, set]) => [k, Array.from(set)]),
        reports: DB.reports.slice(0, 100)
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(serializable, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[DB] Erreur lors de la sauvegarde sur disque:', err.message);
    }
  }, 1000);
}

loadDatabase();

// Helper pour récupérer l'ID utilisateur de façon sécurisée
const DEFAULT_USER_ID = 'guest-user-default';

function resolveUser(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token && DB.sessions.has(token)) {
      return DB.sessions.get(token);
    }
  }
  return null;
}

function resolveUserId(req) {
  const user = resolveUser(req);
  if (user) return user.id;
  return DEFAULT_USER_ID;
}

// =========================================================================
// 3. PROXY TMDB AVEC CACHE INTELLIGENT & GESTION D'ERREURS
// =========================================================================
app.get('/api/tmdb/*', async (req, res) => {
  try {
    const tmdbPath = req.params[0] || '';
    const apiKey = process.env.TMDB_API_KEY || '99b995150ed16f5fc8a3fff320ca41df';
    
    // Clé unique pour le cache basée sur le chemin et les query params
    const queryString = new URLSearchParams(req.query).toString();
    const cacheKey = `tmdb:${tmdbPath}?${queryString}`;

    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      res.setHeader('X-Cache-Status', 'HIT');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.json(cachedData);
    }

    const url = new URL(`https://api.themoviedb.org/3/${tmdbPath}`);
    url.searchParams.set('api_key', apiKey);
    if (!req.query.language) {
      url.searchParams.set('language', 'fr-FR');
    }
    
    for (const [key, value] of Object.entries(req.query)) {
      if (value !== undefined && value !== null && key !== 'api_key') {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'HANDYFLIX-Node/2.5'
      }
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return res.status(response.status).json({
        error: 'TMDB returned a non-JSON response',
        status: response.status
      });
    }

    const data = await response.json();

    if (response.ok) {
      // Cache pour 1h pour les tendances / populaires, 30m pour la recherche
      const ttl = tmdbPath.includes('trending') || tmdbPath.includes('popular')
        ? 60 * 60 * 1000
        : 30 * 60 * 1000;

      setInCache(cacheKey, data, ttl);
      res.setHeader('X-Cache-Status', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=1800');
    }

    res.status(response.status).json(data);
  } catch (err) {
    console.error('TMDB Proxy Error:', err);
    res.status(502).json({ error: 'Échec de la communication avec TMDB', message: err.message });
  }
});

// Endpoint d'état du cache
app.get('/api/cache/stats', (req, res) => {
  res.json({
    totalEntries: CACHE_STORE.size,
    uptimeSeconds: Math.round(process.uptime()),
    memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
  });
});

// =========================================================================
// 4. API AUTHENTIFICATION & PROFILS SÉCURISÉE (/api/auth/*)
// =========================================================================

// Inscription sécurisée avec hachage bcrypt
app.post('/api/auth/register', (req, res) => {
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
  persistDatabase();

  // Créer un token de session cryptographiquement sécurisé
  const token = `tok_${crypto.randomBytes(32).toString('hex')}`;
  DB.sessions.set(token, newUser);

  // Ne pas renvoyer le hash du mot de passe
  const { passwordHash: _, ...safeUser } = newUser;

  res.status(201).json({
    message: 'Compte créé avec succès !',
    user: safeUser,
    token
  });
});

// Connexion sécurisée avec vérification de mot de passe
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Veuillez saisir votre email et votre mot de passe.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const user = DB.users.get(cleanEmail);

  if (!user) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }

  // Vérification du mot de passe
  const isMatch = user.passwordHash ? bcrypt.compareSync(password, user.passwordHash) : false;
  if (!isMatch) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
  }

  const token = `tok_${crypto.randomBytes(32).toString('hex')}`;
  DB.sessions.set(token, user);

  const { passwordHash: _, ...safeUser } = user;

  res.json({
    message: 'Connexion réussie !',
    user: safeUser,
    token
  });
});

// Profil Actif
app.get('/api/auth/me', (req, res) => {
  const user = resolveUser(req);
  if (user) {
    const { passwordHash: _, ...safeUser } = user;
    return res.json({ user: safeUser, authenticated: true });
  }

  // Profil invité si non authentifié
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

// Déconnexion
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    DB.sessions.delete(token);
  }
  res.json({ message: 'Déconnexion effectuée.' });
});

// =========================================================================
// 5. API HISTORIQUE & REPRISE DE LECTURE (CONTINUE WATCHING) (/api/history)
// =========================================================================

// Récupérer l'historique d'un utilisateur
app.get('/api/history', (req, res) => {
  const userId = resolveUserId(req);
  const userHistory = DB.history.get(userId) || [];
  
  // Trier par date de visionnage la plus récente
  const sorted = [...userHistory].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ history: sorted, total: sorted.length });
});

// Enregistrer la progression d'un visionnage (prise en compte des séries & films)
app.post('/api/history', (req, res) => {
  const userId = resolveUserId(req);
  const { media, season = 1, episode = 1, progress = 0, duration = 0, completed = false } = req.body;

  if (!media || !media.id) {
    return res.status(400).json({ error: 'Données de média manquantes.' });
  }

  if (!DB.history.has(userId)) {
    DB.history.set(userId, []);
  }

  const list = DB.history.get(userId);
  const sNum = Number(season) || 1;
  const eNum = Number(episode) || 1;

  // Recherche d'un enregistrement existant (par média et saison/épisode si série)
  const existingIdx = list.findIndex(h => 
    (h.mediaId === media.id || h.media?.id === media.id) &&
    (media.type !== 'tv' || (h.season === sNum && h.episode === eNum))
  );

  const historyItem = {
    mediaId: media.id,
    media: {
      id: media.id,
      tmdb_id: media.tmdb_id,
      title: media.title,
      poster_url: media.poster_url,
      backdrop_url: media.backdrop_url,
      type: media.type || 'movie',
      rating: media.rating
    },
    season: sNum,
    episode: eNum,
    progressPercent: Math.min(100, Math.max(0, Number(progress) || 0)),
    durationSeconds: Math.max(0, Number(duration) || 0),
    completed: Boolean(completed),
    updatedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    list[existingIdx] = historyItem;
  } else {
    list.unshift(historyItem);
    // Limiter l'historique à 30 entrées par utilisateur
    if (list.length > 30) list.pop();
  }

  persistDatabase();
  res.json({ success: true, historyItem });
});

// Supprimer un élément de l'historique
app.delete('/api/history/:mediaId', (req, res) => {
  const userId = resolveUserId(req);
  const mediaId = req.params.mediaId;
  const { season, episode } = req.query;
  
  if (DB.history.has(userId)) {
    let list = DB.history.get(userId);
    if (season !== undefined && episode !== undefined) {
      list = list.filter(h => !( (h.mediaId === mediaId || h.media?.id === mediaId) && h.season === Number(season) && h.episode === Number(episode) ));
    } else {
      list = list.filter(h => h.mediaId !== mediaId && h.media?.id !== mediaId);
    }
    DB.history.set(userId, list);
    persistDatabase();
  }
  res.json({ success: true, message: 'Élément retiré de la reprise de lecture.' });
});

// =========================================================================
// 6. API FAVORIS & MA LISTE (/api/favorites)
// =========================================================================

app.get('/api/favorites', (req, res) => {
  const userId = resolveUserId(req);
  const favSet = DB.favorites.get(userId) || new Set();
  res.json({ favorites: Array.from(favSet) });
});

app.post('/api/favorites/toggle', (req, res) => {
  const userId = resolveUserId(req);
  const { mediaId } = req.body;

  if (!mediaId || typeof mediaId !== 'string') {
    return res.status(400).json({ error: 'mediaId valide requis.' });
  }

  if (!DB.favorites.has(userId)) {
    DB.favorites.set(userId, new Set());
  }

  const favSet = DB.favorites.get(userId);
  let added = false;

  if (favSet.has(mediaId)) {
    favSet.delete(mediaId);
    added = false;
  } else {
    favSet.add(mediaId);
    added = true;
  }

  persistDatabase();
  res.json({ added, mediaId, totalFavorites: favSet.size });
});

// =========================================================================
// 7. API SIGNALEMENT DE LIENS MORTS & BASCULEMENT DE SERVEUR (/api/report)
// =========================================================================

app.post('/api/report', (req, res) => {
  const { tmdb_id, media_title, server_name, server_index, error_type, details } = req.body;

  const report = {
    id: `rep_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    tmdb_id: tmdb_id || 'unknown',
    media_title: media_title || 'Titre inconnu',
    server_name: server_name || 'Serveur 1',
    server_index: Number(server_index || 0),
    error_type: error_type || 'broken_stream',
    details: details || 'Le flux vidéo ne charge pas',
    reportedAt: new Date().toISOString()
  };

  DB.reports.unshift(report);
  if (DB.reports.length > 200) DB.reports.pop();
  persistDatabase();

  console.log(`[RAPPORT SERVEUR] Signalement reçu pour "${report.media_title}" sur ${report.server_name}`);

  // Calcul du serveur alternatif recommandé
  const fallbackIndex = (Number(server_index || 0) + 1) % 5;

  res.status(201).json({
    success: true,
    message: 'Merci ! Votre signalement a été enregistré. Basculement automatique suggéré.',
    reportId: report.id,
    recommendedServerIndex: fallbackIndex
  });
});

app.get('/api/reports', (req, res) => {
  res.json({ reports: DB.reports.slice(0, 20), total: DB.reports.length });
});

// =========================================================================
// 8. TÉLÉCHARGEMENT DU CODE SOURCE ZIP (/download-zip) SÉCURISÉ
// =========================================================================
const handleZipDownload = (req, res) => {
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  res.attachment('spaceflix-complete.zip');
  res.setHeader('Content-Type', 'application/zip');

  archive.on('error', (err) => {
    console.error('Erreur création ZIP:', err);
    if (!res.headersSent) {
      res.status(500).send({ error: 'Erreur lors de la création du ZIP' });
    }
  });

  archive.pipe(res);

  const rootDir = __dirname;
  if (fs.existsSync(path.join(rootDir, 'Frontend'))) {
    archive.directory(path.join(rootDir, 'Frontend'), 'Frontend');
  }
  if (fs.existsSync(path.join(rootDir, 'Backend'))) {
    archive.directory(path.join(rootDir, 'Backend'), 'Backend');
  }
  if (fs.existsSync(path.join(rootDir, 'package.json'))) {
    archive.file(path.join(rootDir, 'package.json'), { name: 'package.json' });
  }
  if (fs.existsSync(path.join(rootDir, 'server.js'))) {
    archive.file(path.join(rootDir, 'server.js'), { name: 'server.js' });
  }
  if (fs.existsSync(path.join(rootDir, '.env.example'))) {
    archive.file(path.join(rootDir, '.env.example'), { name: '.env.example' });
  }
  if (fs.existsSync(path.join(rootDir, 'README.md'))) {
    archive.file(path.join(rootDir, 'README.md'), { name: 'README.md' });
  }

  archive.finalize();
};

app.get('/download-zip', handleZipDownload);
app.get('/api/download-zip', handleZipDownload);

// =========================================================================
// 9. FICHIERS STATIQUES & ROUTES HTML
// =========================================================================
app.use(express.static(path.join(__dirname, 'Frontend')));

app.get(['/filters', '/filters.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'Frontend', 'filters.html'));
});

app.get(['/about', '/about.html', '/a_propos', '/a_propos.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'Frontend', 'about.html'));
});

app.get(['/privacy', '/privacy.html', '/confidentialite', '/confidentialite.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'Frontend', 'privacy.html'));
});

app.get(['/terms', '/terms.html', '/conditions', '/conditions.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'Frontend', 'terms.html'));
});

// Fallback navigation SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'Frontend', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SPACE FLIX] Server running with in-memory cache, auth & API endpoints on http://0.0.0.0:${PORT}`);
});



