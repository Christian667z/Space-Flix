import express from 'express';
import { DB, persistDatabase, resolveUserId } from '../db.js';

const router = express.Router();

// Récupérer l'historique d'un utilisateur
router.get('/', (req, res) => {
  const userId = resolveUserId(req);
  const userHistory = DB.history.get(userId) || [];
  const sorted = [...userHistory].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json({ history: sorted, total: sorted.length });
});

// Enregistrer la progression d'un visionnage
router.post('/', (req, res) => {
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
    if (list.length > 30) list.pop();
  }

  persistDatabase();
  res.json({ success: true, historyItem });
});

// Supprimer un élément de l'historique
router.delete('/:mediaId', (req, res) => {
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

export default router;
