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

// Endpoint pour télécharger l'archive ZIP complète du projet
const handleZipDownload = (req, res) => {
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  res.attachment('space-flix-complete.zip');
  res.setHeader('Content-Type', 'application/zip');

  archive.on('error', (err) => {
    console.error('Erreur création ZIP:', err);
    res.status(500).send({ error: 'Erreur lors de la création du ZIP' });
  });

  archive.pipe(res);

  // Ajouter les dossiers et fichiers essentiels en excluant node_modules
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

// Proxy TMDB API sécurisé côté serveur
app.get('/api/tmdb/*', async (req, res) => {
  try {
    const tmdbPath = req.params[0] || '';
    const apiKey = process.env.TMDB_API_KEY || '4a53239a5ffacda5b630ad805ef96e1a';
    
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
        'User-Agent': 'SpaceFlix/2.5'
      }
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('TMDB Proxy Error:', err);
    res.status(500).json({ error: 'Failed to proxy request to TMDB', message: err.message });
  }
});

// Serve static assets from Frontend directory
app.use(express.static(path.join(__dirname, 'Frontend')));

// Specific routes for legal/about/filters pages if accessed directly without .html
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

// Fallback for clean routes or single page navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'Frontend', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Space Flix running on http://0.0.0.0:${PORT}`);
});

