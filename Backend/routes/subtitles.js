import express from 'express';
import { getFromCache, setInCache } from '../db.js';

const router = express.Router();

const SUBDL_API_KEY = process.env.SUBDL_API_KEY || 'subdl_JPpTPDp3B2wDg8QOirQbKuSeq4qo1ze_buFHnmE_v6E';
const SUBDL_BASE_URL = 'https://api.subdl.com/api/v1/subtitles';
const SUBDL_DOWNLOAD_BASE = 'https://dl.subdl.com';
const CACHE_TTL_MS = 15 * 60 * 1000;

const POPULAR_LANGUAGES = [
  { code: 'FR', name: 'Français', flag: '🇫🇷' },
  { code: 'EN', name: 'English', flag: '🇬🇧' },
  { code: 'ES', name: 'Español', flag: '🇪🇸' },
  { code: 'AR', name: 'العربية', flag: '🇸🇦' },
  { code: 'DE', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'IT', name: 'Italiano', flag: '🇮🇹' },
  { code: 'PT', name: 'Português', flag: '🇵🇹' },
  { code: 'JA', name: '日本語', flag: '🇯🇵' },
  { code: 'KO', name: '한국어', flag: '🇰🇷' },
  { code: 'RU', name: 'Русский', flag: '🇷🇺' }
];

function formatLanguage(langCode) {
  const code = (langCode || '').toUpperCase();
  const match = POPULAR_LANGUAGES.find(l => l.code === code);
  return match ? match : { code: code, name: langCode, flag: '🌐' };
}

/**
 * 1. Search Subtitles via SubDL API
 * GET /api/subtitles?tmdb_id=...&imdb_id=...&film_name=...&type=movie|tv&season=1&episode=1&languages=FR,EN
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      tmdb_id,
      imdb_id,
      film_name,
      type = 'movie',
      season,
      episode,
      languages = 'FR,EN,ES,AR,DE,IT'
    } = req.query;

    if (!tmdb_id && !imdb_id && !film_name) {
      return res.status(400).json({
        error: 'Au moins un identifiant (tmdb_id, imdb_id ou film_name) est requis.'
      });
    }

    const params = new URLSearchParams({
      api_key: SUBDL_API_KEY,
      languages: languages.toUpperCase(),
      subs_per_page: '30',
      comment: '1'
    });

    if (tmdb_id) params.set('tmdb_id', tmdb_id);
    if (imdb_id) params.set('imdb_id', imdb_id.startsWith('tt') ? imdb_id : `tt${imdb_id}`);
    if (film_name) params.set('film_name', film_name);
    if (type) params.set('type', type === 'tv' ? 'tv' : 'movie');
    if (season) params.set('season_number', season);
    if (episode) params.set('episode_number', episode);

    const requestUrl = `${SUBDL_BASE_URL}?${params.toString()}`;
    const cacheKey = `subtitles:${requestUrl}`;

    const cached = getFromCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const response = await fetch(requestUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SpaceFlix/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`SubDL API returned ${response.status} ${response.statusText}`);
    }

    const subdlData = await response.json();

    if (!subdlData.status && subdlData.error) {
      return res.json({
        status: false,
        message: subdlData.error || 'Aucun sous-titre trouvé',
        subtitles: [],
        grouped: {}
      });
    }

    const rawSubtitles = subdlData.subtitles || subdlData.results || [];
    const grouped = {};

    const formattedSubtitles = rawSubtitles.map((sub, index) => {
      const langCode = (sub.lang || sub.language || 'EN').toUpperCase();
      const langInfo = formatLanguage(langCode);
      const downloadUrl = sub.url 
        ? (sub.url.startsWith('http') ? sub.url : `${SUBDL_DOWNLOAD_BASE}${sub.url}`)
        : (sub.full_url || null);

      const item = {
        id: `sub_${index}_${sub.sd_id || sub.id || Math.random().toString(36).substr(2, 6)}`,
        release_name: sub.release_name || sub.name || 'Sous-titre standard',
        language: langInfo.name,
        lang_code: langCode,
        flag: langInfo.flag,
        author: sub.author || 'Communauté',
        hi: Boolean(sub.hi || sub.hearing_impaired),
        season: sub.season || season || null,
        episode: sub.episode || episode || null,
        download_url: downloadUrl,
        direct_url: `/api/subtitles/download?url=${encodeURIComponent(downloadUrl || '')}&name=${encodeURIComponent(sub.release_name || 'subtitle')}`
      };

      if (!grouped[langCode]) {
        grouped[langCode] = {
          code: langCode,
          name: langInfo.name,
          flag: langInfo.flag,
          items: []
        };
      }
      grouped[langCode].items.push(item);

      return item;
    });

    const result = {
      status: true,
      count: formattedSubtitles.length,
      subtitles: formattedSubtitles,
      grouped: grouped,
      available_languages: Object.keys(grouped).map(k => grouped[k])
    };

    setInCache(cacheKey, result, CACHE_TTL_MS);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * 2. Get Supported Languages List
 * GET /api/subtitles/languages
 */
router.get('/languages', (req, res) => {
  res.json({
    status: true,
    languages: POPULAR_LANGUAGES
  });
});

/**
 * 3. Proxy Download Subtitle Stream/File
 * GET /api/subtitles/download?url=...
 */
router.get('/download', async (req, res) => {
  try {
    const { url, name } = req.query;
    if (!url) {
      return res.status(400).send('Paramètre URL manquant');
    }

    const decodedUrl = decodeURIComponent(url);
    const subRes = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'SpaceFlix/1.0'
      }
    });

    if (!subRes.ok) {
      return res.status(subRes.status).send('Impossible de récupérer le fichier de sous-titres');
    }

    const contentType = subRes.headers.get('content-type') || 'application/octet-stream';
    const filename = (name ? decodeURIComponent(name) : 'subtitle') + '.zip';

    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^a-zA-Z0-9_.-]/g, '_')}"`);
    res.setHeader('Content-Type', contentType);

    const arrayBuffer = await subRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('Subtitle download proxy error:', err);
    res.status(500).send('Erreur lors du téléchargement');
  }
});

export default router;
