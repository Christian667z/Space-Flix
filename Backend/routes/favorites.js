import express from 'express';
import { DB, persistDatabase, resolveUserId } from '../db.js';
import { optionalAuth } from '../middlewares/auth.js';
import { getSupabaseAdmin } from '../config/supabase.js';

const router = express.Router();

// Middleware d'authentification optionnelle
router.use(optionalAuth);

/**
 * GET /api/favorites
 * Récupère la liste des favoris de l'utilisateur connecté ("Ma Liste")
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user?.id || resolveUserId(req);
    const supabase = getSupabaseAdmin();

    // 1. Supabase: Si l'utilisateur est authentifié avec Supabase
    if (supabase && req.user?.provider === 'supabase') {
      try {
        const { data, error } = await supabase
          .from('favorites')
          .select('media_id, created_at')
          .eq('user_id', req.user.id)
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          const mediaIds = data.map(f => f.media_id);
          return res.json({
            success: true,
            source: 'supabase',
            favorites: mediaIds,
            total: mediaIds.length
          });
        }
      } catch (sbErr) {
        console.warn('[FAVORITES] Erreur lecture Supabase, bascule sur la base locale:', sbErr.message);
      }
    }

    // 2. Base locale
    const favSet = DB.favorites.get(userId) || new Set();
    const favoritesList = Array.from(favSet);

    res.json({
      success: true,
      source: 'local',
      favorites: favoritesList,
      total: favoritesList.length
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/favorites
 * Ajoute un média aux favoris
 */
router.post('/', async (req, res, next) => {
  try {
    const userId = req.user?.id || resolveUserId(req);
    const { mediaId, media_id } = req.body;
    const targetId = String(mediaId || media_id || '').trim();

    if (!targetId) {
      return res.status(400).json({
        success: false,
        message: 'L\'identifiant du média (mediaId) est requis.'
      });
    }

    const supabase = getSupabaseAdmin();
    if (supabase && req.user?.provider === 'supabase') {
      try {
        await supabase
          .from('favorites')
          .upsert({
            user_id: req.user.id,
            media_id: targetId,
            created_at: new Date().toISOString()
          }, { onConflict: 'user_id, media_id' });
      } catch (sbErr) {
        console.warn('[FAVORITES] Erreur ajout Supabase:', sbErr.message);
      }
    }

    if (!DB.favorites.has(userId)) {
      DB.favorites.set(userId, new Set());
    }
    const favSet = DB.favorites.get(userId);
    favSet.add(targetId);
    persistDatabase();

    res.json({
      success: true,
      added: true,
      mediaId: targetId,
      totalFavorites: favSet.size
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/favorites/toggle
 * Bascule l'état d'un favori (Ajout / Retrait)
 */
router.post('/toggle', async (req, res, next) => {
  try {
    const userId = req.user?.id || resolveUserId(req);
    const { mediaId, media_id } = req.body;
    const targetId = String(mediaId || media_id || '').trim();

    if (!targetId) {
      return res.status(400).json({
        success: false,
        message: 'L\'identifiant du média (mediaId) est requis.'
      });
    }

    if (!DB.favorites.has(userId)) {
      DB.favorites.set(userId, new Set());
    }

    const favSet = DB.favorites.get(userId);
    let added = false;

    if (favSet.has(targetId)) {
      favSet.delete(targetId);
      added = false;

      // Retirer aussi de Supabase si connecté
      const supabase = getSupabaseAdmin();
      if (supabase && req.user?.provider === 'supabase') {
        try {
          await supabase.from('favorites').delete().eq('user_id', req.user.id).eq('media_id', targetId);
        } catch (sbErr) {
          console.warn('[FAVORITES] Erreur suppression Supabase:', sbErr.message);
        }
      }
    } else {
      favSet.add(targetId);
      added = true;

      // Ajouter aussi à Supabase si connecté
      const supabase = getSupabaseAdmin();
      if (supabase && req.user?.provider === 'supabase') {
        try {
          await supabase.from('favorites').upsert({
            user_id: req.user.id,
            media_id: targetId,
            created_at: new Date().toISOString()
          }, { onConflict: 'user_id, media_id' });
        } catch (sbErr) {
          console.warn('[FAVORITES] Erreur insertion Supabase:', sbErr.message);
        }
      }
    }

    persistDatabase();

    res.json({
      success: true,
      added,
      mediaId: targetId,
      totalFavorites: favSet.size
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/favorites/:mediaId
 * Retire un média des favoris
 */
router.delete('/:mediaId', async (req, res, next) => {
  try {
    const userId = req.user?.id || resolveUserId(req);
    const mediaId = req.params.mediaId;

    const supabase = getSupabaseAdmin();
    if (supabase && req.user?.provider === 'supabase') {
      try {
        await supabase.from('favorites').delete().eq('user_id', req.user.id).eq('media_id', mediaId);
      } catch (sbErr) {
        console.warn('[FAVORITES] Erreur suppression Supabase:', sbErr.message);
      }
    }

    if (DB.favorites.has(userId)) {
      const favSet = DB.favorites.get(userId);
      favSet.delete(mediaId);
      persistDatabase();
    }

    res.json({
      success: true,
      message: 'Média retiré de vos favoris.'
    });
  } catch (err) {
    next(err);
  }
});

export default router;
