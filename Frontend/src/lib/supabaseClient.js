/**
 * Space Flix - Client Supabase et Data Manager
 * Gère la connexion Supabase, l'authentification, les favoris ("Ma Liste"),
 * et la reprise de lecture automatique (Playback Progress / Continue Watching).
 */

import { INITIAL_MEDIA } from './data.js';

// Clés par défaut et stockage de configuration
const DEFAULT_SUPABASE_URL = 'https://gfjyywtxshebhteaxxtf.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdmanl5d3R4c2hlYmh0ZWF4eHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNTc4NjYsImV4cCI6MjEwMjYzMzg2Nn0.G8EwY9CNUA6fW3d8XqKSjM5qhE8-67qgcUsp0BVPHP0';

const SUPABASE_URL = window.SPACE_FLIX_CONFIG?.SUPABASE_URL || localStorage.getItem('SPACE_FLIX_SUPABASE_URL') || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SPACE_FLIX_CONFIG?.SUPABASE_ANON_KEY || localStorage.getItem('SPACE_FLIX_SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY;

let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    console.log("🚀 Connecté avec succès au backend Supabase !");
  } catch (err) {
    console.warn("⚠️ Mode démo local actif (Supabase SDK initialisation):", err);
  }
}

export const supabaseClient = supabase;

// --- GESTION LOCALE (FALLBACK ET UTILISATEURS INVITÉS) ---
const LOCAL_FAVORITES_KEY = 'space_flix_my_list';
const LOCAL_WATCH_HISTORY_KEY = 'space_flix_continue_watching';

function getLocalFavorites() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_FAVORITES_KEY) || '[]');
  } catch {
    return [];
  }
}

function setLocalFavorites(favs) {
  localStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify(favs));
}

function getLocalHistory() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_WATCH_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function setLocalHistory(history) {
  localStorage.setItem(LOCAL_WATCH_HISTORY_KEY, JSON.stringify(history));
}

export const SupabaseService = {
  isConfigured() {
    return !!supabase;
  },

  async getConfig() {
    return {
      url: SUPABASE_URL,
      key: SUPABASE_ANON_KEY ? '••••••••' + SUPABASE_ANON_KEY.slice(-4) : ''
    };
  },

  // --- CATALOGUE DE MÉDIAS ---
  async getMediaList({ type = null, genre = null, search = null, trendingOnly = false } = {}) {
    if (supabase) {
      try {
        let query = supabase.from('media').select('*');
        if (type) query = query.eq('type', type);
        if (trendingOnly) query = query.eq('is_trending', true);
        if (search) query = query.ilike('title', `%${search}%`);
        
        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          let results = data;
          if (genre && genre !== 'Tous') {
            results = results.filter(item => item.genres && Array.isArray(item.genres) && item.genres.some(g => g.toLowerCase() === genre.toLowerCase()));
          }
          return results;
        }
      } catch (err) {
        console.warn("Supabase fetch media:", err.message);
      }
    }

    // Fallback local
    let list = [...INITIAL_MEDIA];
    if (type) {
      list = list.filter(item => item.type === type);
    }
    if (trendingOnly) {
      list = list.filter(item => item.is_trending);
    }
    if (genre && genre !== 'Tous') {
      const gLower = genre.toLowerCase();
      list = list.filter(item => item.genres && Array.isArray(item.genres) && item.genres.some(g => g.toLowerCase() === gLower || (gLower.includes('sci') && g.toLowerCase().includes('sci'))));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(item => (item.title && item.title.toLowerCase().includes(q)) || (item.synopsis && item.synopsis.toLowerCase().includes(q)));
    }
    return list;
  },

  async getMediaById(id) {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('media').select('*, episodes(*)').eq('id', id).single();
        if (!error && data) return data;
      } catch (e) {
        // Silently fallback
      }
    }
    return INITIAL_MEDIA.find(m => String(m.id) === String(id) || m.slug === id) || null;
  },

  // --- GESTION DE "MA LISTE" (FAVORIS) ---
  async getFavorites() {
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase.from('favorites').select('media_id, media(*)').eq('user_id', user.id);
          if (!error && data && data.length > 0) {
            return data.map(item => item.media || INITIAL_MEDIA.find(m => m.id === item.media_id)).filter(Boolean);
          }
        }
      } catch (e) {
        console.warn("Favs supabase get:", e.message);
      }
    }

    // Local fallback
    const favIds = getLocalFavorites();
    return INITIAL_MEDIA.filter(m => favIds.includes(m.id));
  },

  async isFavorite(mediaId) {
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await supabase.from('favorites').select('id').eq('user_id', user.id).eq('media_id', mediaId).maybeSingle();
          if (data) return true;
        }
      } catch (e) {
        // local check
      }
    }
    const favs = getLocalFavorites();
    return favs.includes(mediaId);
  },

  async toggleFavorite(mediaId) {
    let newState = false;
    // 1. Mise à jour Supabase si connecté
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const isFav = await this.isFavorite(mediaId);
          if (isFav) {
            await supabase.from('favorites').delete().eq('user_id', user.id).eq('media_id', mediaId);
            newState = false;
          } else {
            await supabase.from('favorites').insert([{ user_id: user.id, media_id: mediaId }]);
            newState = true;
          }
        }
      } catch (e) {
        console.warn("Favs toggle supabase:", e.message);
      }
    }

    // 2. Toujours synchroniser en local pour fluidité maximale
    let favs = getLocalFavorites();
    if (favs.includes(mediaId)) {
      favs = favs.filter(id => id !== mediaId);
      newState = false;
    } else {
      favs.push(mediaId);
      newState = true;
    }
    setLocalFavorites(favs);
    return newState;
  },

  // --- REPRISE DE LECTURE AUTOMATIQUE (PLAYBACK PROGRESS & CONTINUE WATCHING) ---
  /**
   * Sauvegarde la position exacte de lecture (currentTime, duration, etc.) dans Supabase et LocalStorage
   */
  async savePlaybackProgress({
    mediaId,
    title,
    type = 'movie',
    posterUrl = '',
    seasonNumber = 1,
    episodeNumber = 1,
    episodeTitle = '',
    currentTime = 0,
    duration = 0
  }) {
    if (!mediaId || currentTime <= 0) return;

    const progressPercent = duration > 0 ? Math.min(100, Math.round((currentTime / duration) * 100)) : 0;
    const isCompleted = progressPercent > 90;

    const progressRecord = {
      media_id: String(mediaId),
      media_title: title,
      media_type: type,
      poster_url: posterUrl,
      season_number: seasonNumber,
      episode_number: episodeNumber,
      episode_title: episodeTitle,
      current_time_seconds: Math.round(currentTime),
      duration_seconds: Math.round(duration),
      progress_percent: progressPercent,
      completed: isCompleted,
      updated_at: new Date().toISOString()
    };

    // 1. Sauvegarde dans Supabase si l'utilisateur est connecté
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('user_history').upsert({
            user_id: user.id,
            ...progressRecord
          }, {
            onConflict: 'user_id,media_id,season_number,episode_number'
          });
        }
      } catch (err) {
        console.warn("Info sauvegarde progression Supabase:", err.message);
      }
    }

    // 2. Sauvegarde dans le stockage local (toujours actif pour les invités ou hors ligne)
    let history = getLocalHistory();
    history = history.filter(item => !(item.media_id === String(mediaId) && item.season_number === seasonNumber && item.episode_number === episodeNumber));
    history.unshift(progressRecord);
    // Garder les 20 plus récents
    if (history.length > 20) history = history.slice(0, 20);
    setLocalHistory(history);
  },

  /**
   * Récupère la dernière position enregistrée pour un média précis
   */
  async getPlaybackProgress(mediaId, seasonNumber = 1, episodeNumber = 1) {
    if (!mediaId) return null;

    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('user_history')
            .select('*')
            .eq('user_id', user.id)
            .eq('media_id', String(mediaId))
            .eq('season_number', seasonNumber)
            .eq('episode_number', episodeNumber)
            .maybeSingle();

          if (!error && data && data.current_time_seconds > 5 && !data.completed) {
            return data;
          }
        }
      } catch (e) {
        // local check fallback
      }
    }

    const history = getLocalHistory();
    const item = history.find(h => h.media_id === String(mediaId) && h.season_number === seasonNumber && h.episode_number === episodeNumber);
    if (item && item.current_time_seconds > 5 && !item.completed) {
      return item;
    }
    return null;
  },

  /**
   * Récupère la liste complète des contenus en cours de visionnage pour le carousel "Reprendre la lecture"
   */
  async getAllContinueWatching() {
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('user_history')
            .select('*')
            .eq('user_id', user.id)
            .eq('completed', false)
            .gt('current_time_seconds', 5)
            .order('updated_at', { ascending: false })
            .limit(10);

          if (!error && Array.isArray(data) && data.length > 0) {
            return data;
          }
        }
      } catch (e) {
        console.warn("Continue watching supabase:", e.message);
      }
    }

    // Fallback local
    const history = getLocalHistory();
    return history.filter(h => !h.completed && h.current_time_seconds > 5);
  },

  /**
   * Supprime un titre de l'historique
   */
  async removePlaybackProgress(mediaId, seasonNumber = 1, episodeNumber = 1) {
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('user_history')
            .delete()
            .eq('user_id', user.id)
            .eq('media_id', String(mediaId))
            .eq('season_number', seasonNumber)
            .eq('episode_number', episodeNumber);
        }
      } catch (e) {
        // ignore
      }
    }

    let history = getLocalHistory();
    history = history.filter(h => !(h.media_id === String(mediaId) && h.season_number === seasonNumber && h.episode_number === episodeNumber));
    setLocalHistory(history);
  }
};
