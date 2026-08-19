import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

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
// 2. STOCKAGE EN MÉMOIRE PERSISTANT LOCAL (USERS, HISTORIQUE, FAVORIS, RAPPORTS)
// =========================================================================
const DB = {
  users: new Map(), // email -> user data
  sessions: new Map(), // token -> user
  history: new Map(), // userId -> [history items]
  favorites: new Map(), // userId -> Set of mediaIds
  reports: [] // [broken stream reports]
};

// Utilisateur invité / démo par défaut
const DEFAULT_USER_ID = 'guest-user-default';
DB.users.set('demo@handyflix.com', {
  id: 'user-demo-1',
  email: 'demo@handyflix.com',
  name: 'Cinéphile VIP',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
  createdAt: new Date().toISOString()
});
DB.history.set('user-demo-1', []);
DB.favorites.set('user-demo-1', new Set());

// Helper pour récupérer l'ID utilisateur depuis le header Authorization ou session
function resolveUserId(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = DB.sessions.get(token);
    if (session) return session.id;
  }
  const customUserId = req.headers['x-user-id'] || req.query.user_id;
  return customUserId || DEFAULT_USER_ID;
}

// =========================================================================
// 3. PROXY TMDB AVEC CACHE INTELLIGENT
// =========================================================================
app.get('/api/tmdb/*', async (req, res) => {
  try {
    const tmdbPath = req.params[0] || '';
    const apiKey = process.env.TMDB_API_KEY || '4a53239a5ffacda5b630ad805ef96e1a';
    
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

    const data = await response.json();

    // Cache pour 1h pour les tendances / populaires, 30m pour la recherche
    const ttl = tmdbPath.includes('trending') || tmdbPath.includes('popular')
      ? 60 * 60 * 1000
      : 30 * 60 * 1000;

    setInCache(cacheKey, data, ttl);

    res.setHeader('X-Cache-Status', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=1800');
    res.status(response.status).json(data);
  } catch (err) {
    console.error('TMDB Proxy Error:', err);
    res.status(500).json({ error: 'Failed to proxy request to TMDB', message: err.message });
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
// 4. API AUTHENTIFICATION & PROFILS (/api/auth/*)
// =========================================================================

// Inscription
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (DB.users.has(cleanEmail)) {
    return res.status(409).json({ error: 'Un compte avec cet email existe déjà.' });
  }

  const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newUser = {
    id: userId,
    email: cleanEmail,
    name: name || cleanEmail.split('@')[0],
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
    createdAt: new Date().toISOString()
  };

  DB.users.set(cleanEmail, newUser);
  DB.history.set(userId, []);
  DB.favorites.set(userId, new Set());

  // Créer un token de session
  const token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  DB.sessions.set(token, newUser);

  res.status(201).json({
    message: 'Compte créé avec succès !',
    user: newUser,
    token
  });
});

// Connexion
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Veuillez saisir votre email.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  let user = DB.users.get(cleanEmail);

  // Si l'utilisateur n'existe pas encore, création automatique en un clic (Fast Login)
  if (!user) {
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    user = {
      id: userId,
      email: cleanEmail,
      name: cleanEmail.split('@')[0],
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
      createdAt: new Date().toISOString()
    };
    DB.users.set(cleanEmail, user);
    DB.history.set(userId, []);
    DB.favorites.set(userId, new Set());
  }

  const token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  DB.sessions.set(token, user);

  res.json({
    message: 'Connexion réussie !',
    user,
    token
  });
});

// Profil Actif
app.get('/api/auth/me', (req, res) => {
  const userId = resolveUserId(req);
  for (const user of DB.users.values()) {
    if (user.id === userId) {
      return res.json({ user, authenticated: true });
    }
  }

  // Profil invité si non trouvé
  res.json({
    user: {
      id: userId,
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
    const token = authHeader.substring(7);
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

// Enregistrer la progression d'un visionnage
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
  const existingIdx = list.findIndex(h => h.media.id === media.id);

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
    season: Number(season),
    episode: Number(episode),
    progressPercent: Math.min(100, Math.max(0, Number(progress))),
    durationSeconds: Number(duration),
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

  res.json({ success: true, historyItem });
});

// Supprimer un élément de l'historique
app.delete('/api/history/:mediaId', (req, res) => {
  const userId = resolveUserId(req);
  const mediaId = req.params.mediaId;
  
  if (DB.history.has(userId)) {
    const list = DB.history.get(userId).filter(h => h.mediaId !== mediaId && h.media.id !== mediaId);
    DB.history.set(userId, list);
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

  if (!mediaId) {
    return res.status(400).json({ error: 'mediaId requis.' });
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

  res.json({ added, mediaId, totalFavorites: favSet.size });
});

// =========================================================================
// 7. API SIGNALEMENT DE LIENS MORTS & BASCULEMENT DE SERVEUR (/api/report)
// =========================================================================

app.post('/api/report', (req, res) => {
  const { tmdb_id, media_title, server_name, server_index, error_type, details } = req.body;

  const report = {
    id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
// 8. TÉLÉCHARGEMENT DU CODE SOURCE ZIP (/download-zip)
// =========================================================================
const handleZipDownload = (req, res) => {
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  res.attachment('handyflix-complete.zip');
  res.setHeader('Content-Type', 'application/zip');

  archive.on('error', (err) => {
    console.error('Erreur création ZIP:', err);
    res.status(500).send({ error: 'Erreur lors de la création du ZIP' });
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
  console.log(`[HANDYFLIX] Server running with in-memory cache, auth & API endpoints on http://0.0.0.0:${PORT}`);
});


