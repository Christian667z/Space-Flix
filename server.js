import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import helmet from 'helmet';
import cors from 'cors';

// Import de la configuration Supabase & vérification d'environnement
import { checkEnvironmentVariables } from './Backend/config/supabase.js';

// Import des routes modulaires Backend
import authRoutes from './Backend/routes/auth.js';
import healthRoutes from './Backend/routes/health.js';
import tmdbRoutes from './Backend/routes/tmdb.js';
import historyRoutes from './Backend/routes/history.js';
import favoritesRoutes from './Backend/routes/favorites.js';
import reportRoutes from './Backend/routes/report.js';

// Import des middlewares de sécurité et gestion des erreurs
import { errorHandler, notFoundHandler } from './Backend/middlewares/errorHandler.js';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// =========================================================================
// 1. VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT AU DÉMARRAGE
// =========================================================================
checkEnvironmentVariables();

// =========================================================================
// 2. SÉCURITÉ (HELMET & CORS) & PARSING DES REQUÊTES
// =========================================================================
// Configuration Helmet adaptée pour autoriser les iframes et embeds de streaming vidéo
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Configuration CORS globale
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Requested-With']
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// =========================================================================
// 3. ENREGISTREMENT DES ROUTES MODULAIRES API (/api/*)
// =========================================================================
app.use('/api/tmdb', tmdbRoutes);         // Proxy TMDB avec clé sécurisée et cache
app.use('/api/history', historyRoutes);   // Historique et reprise de lecture "Continue Watching"
app.use('/api/favorites', favoritesRoutes); // Gestion des favoris "Ma Liste"
app.use('/api/auth', authRoutes);         // Inscription, Connexion, Profils & Mot de passe
app.use('/api', healthRoutes);            // Healthcheck & Stats de cache
app.use('/api/report', reportRoutes);      // Signalements de flux vidéo cassés

// =========================================================================
// 4. TÉLÉCHARGEMENT DU CODE SOURCE ZIP (/download-zip)
// =========================================================================
const handleZipDownload = (req, res, next) => {
  try {
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    res.attachment('spaceflix-complete.zip');
    res.setHeader('Content-Type', 'application/zip');

    archive.on('error', (err) => {
      console.error('Erreur création ZIP:', err);
      if (!res.headersSent) {
        next(err);
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
  } catch (err) {
    next(err);
  }
};

app.get('/download-zip', handleZipDownload);
app.get('/api/download-zip', handleZipDownload);

// =========================================================================
// 5. GESTION DES ROUTES API INCONNUES (404 JSON)
// =========================================================================
app.all('/api/*', notFoundHandler);

// =========================================================================
// 6. FICHIERS STATIQUES & ROUTES HTML FRONTEND
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

// Fallback navigation SPA vers index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'Frontend', 'index.html'));
});

// =========================================================================
// 7. MIDDLEWARE GLOBAL DE GESTION DES ERREURS
// =========================================================================
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SPACE FLIX] Serveur Node.js actif sur http://0.0.0.0:${PORT}`);
});
