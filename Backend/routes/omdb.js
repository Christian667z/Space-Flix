import express from 'express';
import { getFromCache, setInCache } from '../db.js';

const router = express.Router();

const OMDB_API_KEY = process.env.OMDB_API_KEY || '27f815d0';
const OMDB_BASE_URL = 'https://www.omdbapi.com/';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function fetchOmdb(params) {
  const searchParams = new URLSearchParams({
    apikey: OMDB_API_KEY,
    ...params
  });

  const url = `${OMDB_BASE_URL}?${searchParams.toString()}`;
  const cacheKey = `omdb:${url}`;

  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    const data = await res.json();
    if (data.Response === 'True') {
      setInCache(cacheKey, data, CACHE_TTL_MS);
    }
    return data;
  } catch (err) {
    return {
      Response: 'False',
      Error: err.message || 'Impossible de contacter OMDb API'
    };
  }
}

/**
 * 1. Obtenir les détails et notes d'un film ou d'une série par titre ou IMDb ID
 * GET /api/omdb?t=Inception&y=2010 ou GET /api/omdb?i=tt1375666
 */
router.get('/', async (req, res, next) => {
  try {
    const { t, i, title, imdb_id, y, year, type, plot = 'full' } = req.query;

    const queryParams = { plot };
    if (i || imdb_id) queryParams.i = i || imdb_id;
    else if (t || title) queryParams.t = t || title;
    else {
      return res.status(400).json({
        Response: 'False',
        Error: 'Veuillez fournir au moins un titre (t) ou un identifiant IMDb (i).'
      });
    }

    if (y || year) queryParams.y = y || year;
    if (type) queryParams.type = type;

    const data = await fetchOmdb(queryParams);

    // Formater les notes pour faciliter l'affichage
    let imdbRating = data.imdbRating || null;
    let rottenTomatoes = null;
    let metacritic = data.Metascore || null;

    if (Array.isArray(data.Ratings)) {
      const rt = data.Ratings.find(r => r.Source === 'Rotten Tomatoes');
      if (rt) rottenTomatoes = rt.Value;
      const imdb = data.Ratings.find(r => r.Source === 'Internet Movie Database');
      if (imdb) imdbRating = imdb.Value;
      const meta = data.Ratings.find(r => r.Source === 'Metacritic');
      if (meta) metacritic = meta.Value;
    }

    res.json({
      ...data,
      ratings_summary: {
        imdb: imdbRating,
        rotten_tomatoes: rottenTomatoes,
        metacritic: metacritic
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 2. Recherche générale par mot-clé
 * GET /api/omdb/search?s=Batman&page=1
 */
router.get('/search', async (req, res, next) => {
  try {
    const { s, q, query, page = 1, type, y } = req.query;
    const searchTerm = s || q || query;

    if (!searchTerm) {
      return res.status(400).json({
        Response: 'False',
        Error: 'Le paramètre de recherche "s" est obligatoire.'
      });
    }

    const queryParams = { s: searchTerm, page };
    if (type) queryParams.type = type;
    if (y) queryParams.y = y;

    const data = await fetchOmdb(queryParams);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
