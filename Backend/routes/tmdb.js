import express from 'express';
import { getFromCache, setInCache } from '../db.js';

const router = express.Router();

router.get('/*', async (req, res) => {
  try {
    const rawPath = req.params[0] || '';
    const tmdbPath = rawPath.replace(/\.\./g, '').replace(/^\/+/, '');
    
    if (!tmdbPath) {
      return res.status(400).json({ error: 'Chemin TMDB manquant.' });
    }

    const apiKey = process.env.TMDB_API_KEY || '99b995150ed16f5fc8a3fff320ca41df';
    
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
        'User-Agent': 'SPACEFLIX-Node/3.0'
      }
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return res.status(response.status >= 400 ? response.status : 502).json({
        error: 'TMDB a retourné une réponse non-JSON',
        status: response.status
      });
    }

    const data = await response.json();

    if (response.ok) {
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

export default router;
