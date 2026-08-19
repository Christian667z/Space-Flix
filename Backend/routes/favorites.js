import express from 'express';
import { DB, persistDatabase, resolveUserId } from '../db.js';

const router = express.Router();

router.get('/', (req, res) => {
  const userId = resolveUserId(req);
  const favSet = DB.favorites.get(userId) || new Set();
  res.json({ favorites: Array.from(favSet) });
});

router.post('/toggle', (req, res) => {
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

export default router;
