import express from 'express';
import { getFromCache, setInCache } from '../db.js';

const router = express.Router();

// Clé API TMDB par défaut (sécurisée côté serveur)
const DEFAULT_TMDB_API_KEY = '99b995150ed16f5fc8a3fff320ca41df';

/**
 * Proxy TMDB : GET /api/tmdb/*
 * Intercepte les requêtes du frontend et injecte la clé TMDB_API_KEY côté serveur
 */
router.get('/*', async (req, res, next) => {
  try {
    const rawPath = req.params[0] || '';
    // Sécurité: interdire la traversée de répertoire et supprimer les barres obliques de début
    const tmdbPath = rawPath.replace(/\.\./g, '').replace(/^\/+/, '');

    if (!tmdbPath) {
      return res.status(400).json({
        success: false,
        message: 'Chemin de ressource TMDB manquant (ex: /api/tmdb/movie/popular).'
      });
    }

    const apiKey = process.env.TMDB_API_KEY || DEFAULT_TMDB_API_KEY;

    // Création d'une clé de cache unique
    const queryString = new URLSearchParams(req.query).toString();
    const cacheKey = `tmdb:${tmdbPath}?${queryString}`;

    // Vérifier si la réponse est déjà en cache
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      res.setHeader('X-Cache-Status', 'HIT');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.json(cachedData);
    }

    // Construction de l'URL TMDB sécurisée avec injection de la clé API
    const url = new URL(`https://api.themoviedb.org/3/${tmdbPath}`);
    url.searchParams.set('api_key', apiKey);
    
    if (!req.query.language) {
      url.searchParams.set('language', 'fr-FR');
    }

    // Transmettre tous les autres paramètres de requête (page, query, with_genres, etc.)
    for (const [key, value] of Object.entries(req.query)) {
      if (value !== undefined && value !== null && key !== 'api_key') {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SPACEFLIX-Server-Proxy/3.2'
      }
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return res.status(response.status >= 400 ? response.status : 502).json({
        success: false,
        message: 'L\'API TMDB a retourné une réponse inattendue ou est indisponible.',
        status: response.status
      });
    }

    const data = await response.json();

    if (response.ok) {
      // Durée de vie du cache adaptée selon le type de contenu
      const ttl = tmdbPath.includes('trending') || tmdbPath.includes('popular') || tmdbPath.includes('top_rated')
        ? 60 * 60 * 1000  // 1 heure
        : 30 * 60 * 1000; // 30 minutes

      setInCache(cacheKey, data, ttl);
      res.setHeader('X-Cache-Status', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=1800');
    }

    res.status(response.status).json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
