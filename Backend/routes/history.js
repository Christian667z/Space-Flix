import express from 'express';
import { DB, persistDatabase, resolveUserId } from '../db.js';
import { optionalAuth } from '../middlewares/auth.js';
import { getSupabaseAdmin } from '../config/supabase.js';

const router = express.Router();

// Middleware d'authentification optionnelle sur toutes les routes d'historique
router.use(optionalAuth);

/**
 * GET /api/history
 * Récupère l'historique de lecture pour alimenter le carrousel "Reprendre la lecture"
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user?.id || resolveUserId(req);
    const supabase = getSupabaseAdmin();

    // 1. Si utilisateur connecté avec Supabase, essayer de charger depuis la table `user_history`
    if (supabase && req.user?.provider === 'supabase') {
      try {
        const { data, error } = await supabase
          .from('user_history')
          .select('*')
          .eq('user_id', req.user.id)
          .order('updated_at', { ascending: false })
          .limit(30);

        if (!error && Array.isArray(data) && data.length > 0) {
          const formatted = data.map(item => ({
            id: item.id,
            mediaId: item.media_id,
            media: {
              id: item.media_id,
              tmdb_id: item.media_id,
              title: item.media_title || 'Titre',
              poster_url: item.poster_url || '',
              type: item.media_type || 'movie'
            },
            season: item.season_number || 1,
            episode: item.episode_number || 1,
            episodeTitle: item.episode_title || null,
            progressSeconds: Number(item.current_time_seconds || 0),
            durationSeconds: Number(item.duration_seconds || 0),
            progressPercent: Number(item.progress_percent || 0),
            completed: Boolean(item.completed),
            updatedAt: item.updated_at
          }));

          return res.json({
            success: true,
            source: 'supabase',
            history: formatted,
            total: formatted.length
          });
        }
      } catch (sbErr) {
        console.warn('[HISTORY] Erreur lecture Supabase, bascule sur la base locale:', sbErr.message);
      }
    }

    // 2. Base locale / Mémoire (Fallback transparent)
    const userHistory = DB.history.get(userId) || [];
    const sorted = [...userHistory].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({
      success: true,
      source: 'local',
      history: sorted,
      total: sorted.length
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/history
 * Enregistre la progression de visionnage (tmdb_id, season, episode, progress_seconds, etc.)
 */
router.post('/', async (req, res, next) => {
  try {
    const userId = req.user?.id || resolveUserId(req);
    const {
      media,
      tmdb_id,
      media_id,
      media_title,
      poster_url,
      backdrop_url,
      type = 'movie',
      season = 1,
      season_number,
      episode = 1,
      episode_number,
      progress = 0,
      progress_seconds,
      current_time_seconds,
      duration = 0,
      duration_seconds,
      completed = false
    } = req.body;

    // Normalisation des champs pour supporter tous les formats reçus du frontend
    const finalMediaId = String(media?.id || media?.tmdb_id || tmdb_id || media_id || '').trim();
    const finalTitle = media?.title || media_title || 'Titre inconnu';
    const finalPoster = media?.poster_url || poster_url || '';
    const finalBackdrop = media?.backdrop_url || backdrop_url || '';
    const finalType = media?.type || type || 'movie';
    const sNum = Number(season_number ?? season) || 1;
    const eNum = Number(episode_number ?? episode) || 1;
    const curSeconds = Number(current_time_seconds ?? progress_seconds ?? 0);
    const durSeconds = Number(duration_seconds ?? duration ?? 0);
    const progPercent = durSeconds > 0 
      ? Math.min(100, Math.round((curSeconds / durSeconds) * 100))
      : Math.min(100, Math.max(0, Number(progress) || 0));

    if (!finalMediaId) {
      return res.status(400).json({
        success: false,
        message: 'L\'identifiant du média (media.id ou tmdb_id) est requis.'
      });
    }

    const historyItem = {
      mediaId: finalMediaId,
      media: {
        id: finalMediaId,
        tmdb_id: finalMediaId,
        title: finalTitle,
        poster_url: finalPoster,
        backdrop_url: finalBackdrop,
        type: finalType,
        rating: media?.rating || 8.0
      },
      season: sNum,
      episode: eNum,
      progressSeconds: curSeconds,
      durationSeconds: durSeconds,
      progressPercent: progPercent,
      completed: Boolean(completed),
      updatedAt: new Date().toISOString()
    };

    // 1. Sauvegarde dans Supabase si l'utilisateur est authentifié avec Supabase
    const supabase = getSupabaseAdmin();
    if (supabase && req.user?.provider === 'supabase') {
      try {
        await supabase
          .from('user_history')
          .upsert({
            user_id: req.user.id,
            media_id: finalMediaId,
            media_title: finalTitle,
            media_type: finalType,
            poster_url: finalPoster,
            season_number: sNum,
            episode_number: eNum,
            current_time_seconds: curSeconds,
            duration_seconds: durSeconds,
            progress_percent: progPercent,
            completed: Boolean(completed),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id, media_id, season_number, episode_number'
          });
      } catch (sbErr) {
        console.warn('[HISTORY] Erreur écriture Supabase:', sbErr.message);
      }
    }

    // 2. Sauvegarde dans la persistance locale
    if (!DB.history.has(userId)) {
      DB.history.set(userId, []);
    }

    const list = DB.history.get(userId);
    const existingIdx = list.findIndex(h => 
      (h.mediaId === finalMediaId || h.media?.id === finalMediaId) &&
      (finalType !== 'tv' || (h.season === sNum && h.episode === eNum))
    );

    if (existingIdx >= 0) {
      list[existingIdx] = historyItem;
    } else {
      list.unshift(historyItem);
      if (list.length > 30) list.pop();
    }

    persistDatabase();

    res.status(200).json({
      success: true,
      message: 'Progression de lecture sauvegardée avec succès.',
      historyItem
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/history/:mediaId
 * Supprime un titre ou un épisode de l'historique
 */
router.delete('/:mediaId', async (req, res, next) => {
  try {
    const userId = req.user?.id || resolveUserId(req);
    const mediaId = req.params.mediaId;
    const { season, episode } = req.query;

    const supabase = getSupabaseAdmin();
    if (supabase && req.user?.provider === 'supabase') {
      try {
        let query = supabase
          .from('user_history')
          .delete()
          .eq('user_id', req.user.id)
          .eq('media_id', mediaId);

        if (season !== undefined && episode !== undefined) {
          query = query.eq('season_number', Number(season)).eq('episode_number', Number(episode));
        }

        await query;
      } catch (sbErr) {
        console.warn('[HISTORY] Erreur suppression Supabase:', sbErr.message);
      }
    }

    if (DB.history.has(userId)) {
      let list = DB.history.get(userId);
      if (season !== undefined && episode !== undefined) {
        list = list.filter(h => !(
          (h.mediaId === mediaId || h.media?.id === mediaId) &&
          h.season === Number(season) &&
          h.episode === Number(episode)
        ));
      } else {
        list = list.filter(h => h.mediaId !== mediaId && h.media?.id !== mediaId);
      }
      DB.history.set(userId, list);
      persistDatabase();
    }

    res.json({
      success: true,
      message: 'Élément retiré de la reprise de lecture.'
    });
  } catch (err) {
    next(err);
  }
});

export default router;
