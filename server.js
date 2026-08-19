import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Import des routes modulaires Backend
import authRoutes from './Backend/routes/auth.js';
import healthRoutes from './Backend/routes/health.js';
import tmdbRoutes from './Backend/routes/tmdb.js';
import historyRoutes from './Backend/routes/history.js';
import favoritesRoutes from './Backend/routes/favorites.js';
import reportRoutes from './Backend/routes/report.js';

// Import des middlewares
import { errorHandler, notFoundHandler } from './Backend/middlewares/errorHandler.js';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// =========================================================================
// 1. MIDDLEWARES DE SÉCURITÉ & PARSING
// =========================================================================
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// =========================================================================
// 2. ENREGISTREMENT DES ROUTES API (/api/*)
// =========================================================================
app.use('/api/auth', authRoutes);
app.use('/api', healthRoutes); // /api/health, /api/cache/stats
app.use('/api/tmdb', tmdbRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/report', reportRoutes);

// =========================================================================
// 3. TÉLÉCHARGEMENT DU CODE SOURCE ZIP (/download-zip)
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
// 4. GESTION DES ROUTES API INCONNUES (404 JSON)
// =========================================================================
app.all('/api/*', notFoundHandler);

// =========================================================================
// 5. FICHIERS STATIQUES & ROUTES HTML FRONTEND
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

// Middleware Global de Gestion des Erreurs
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SPACE FLIX] Serveur démarré avec architecture modulaire sur http://0.0.0.0:${PORT}`);
});
