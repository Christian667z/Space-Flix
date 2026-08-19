/**
 * Space Flix - Client Data Manager & API Connector
 * Gère la communication avec le backend Node.js (/api/...), la synchronisation
 * des favoris ("Ma Liste"), de l'historique ("Reprendre la lecture") et de l'authentification.
 */

import { INITIAL_MEDIA } from './data.js';

// Configuration Supabase & Clés
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

// --- GESTION LOCALE (CACHE ET HORS LIGNE) ---
const LOCAL_FAVORITES_KEY = 'space_flix_my_list';
const LOCAL_WATCH_HISTORY_KEY = 'space_flix_continue_watching';
const LOCAL_AUTH_TOKEN_KEY = 'space_flix_auth_token';

function getAuthHeaders() {
  const token = localStorage.getItem(LOCAL_AUTH_TOKEN_KEY);
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

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

  async getCurrentUser() {
    // 1. Vérifier via le backend Node.js
    try {
      const res = await fetch('/api/auth/me', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.user && !data.user.isGuest) {
          return data.user;
        }
      }
    } catch (e) {
      // ignore
    }

    // 2. Fallback Supabase SDK direct si connecté
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  async signIn({ email, password }) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem(LOCAL_AUTH_TOKEN_KEY, data.token);
        return { data: { user: data.user, session: { access_token: data.token } }, error: null };
      }
      return { data: null, error: { message: data.message || 'Identifiants incorrects.' } };
    } catch (err) {
      if (supabase) {
        return await supabase.auth.signInWithPassword({ email, password });
      }
      return { data: { user: { email } }, error: null };
    }
  },

  async signUp({ email, password, name }) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem(LOCAL_AUTH_TOKEN_KEY, data.token);
        return { data: { user: data.user, session: { access_token: data.token } }, error: null };
      }
      return { data: null, error: { message: data.message || 'Erreur lors de l\'inscription.' } };
    } catch (err) {
      if (supabase) {
        return await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } }
        });
      }
      return { data: { user: { email } }, error: null };
    }
  },

  async signOut() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch (e) {}
    localStorage.removeItem(LOCAL_AUTH_TOKEN_KEY);
    if (supabase) {
      await supabase.auth.signOut();
    }
  },

  async signInWithGoogle() {
    if (supabase) {
      return await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
    }
  },

  async getWatchHistory() {
    return await this.getAllContinueWatching();
  },

  async saveWatchProgress(params) {
    const { media_id, media, season = 1, episode = 1, progress_seconds = 60, duration_seconds = 7200 } = params;
    return await this.savePlaybackProgress({
      mediaId: media_id || media?.id,
      title: media?.title || 'Titre',
      type: media?.type || 'movie',
      posterUrl: media?.poster_url || '',
      backdropUrl: media?.backdrop_url || '',
      seasonNumber: season,
      episodeNumber: episode,
      currentTime: progress_seconds,
      duration: duration_seconds
    });
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

  // --- GESTION DE "MA LISTE" (FAVORIS) VIA /api/favorites ---
  async getFavorites() {
    // 1. Appel de l'endpoint backend Node.js
    try {
      const res = await fetch('/api/favorites', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.favorites && Array.isArray(data.favorites)) {
          setLocalFavorites(data.favorites);
          return data.favorites;
        }
      }
    } catch (e) {
      console.warn("Backend get favorites fallback:", e.message);
    }

    // 2. Fallback local
    return getLocalFavorites();
  },

  async isFavorite(mediaId) {
    const favs = getLocalFavorites();
    return favs.includes(String(mediaId));
  },

  async toggleFavorite(mediaId) {
    const targetId = String(mediaId);
    let newState = false;

    // 1. Appel du backend Node.js /api/favorites/toggle
    try {
      const res = await fetch('/api/favorites/toggle', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ mediaId: targetId })
      });
      if (res.ok) {
        const data = await res.json();
        newState = Boolean(data.added);
      }
    } catch (e) {
      console.warn("Backend toggle favorites fallback:", e.message);
      // Fallback calcul local
      const favs = getLocalFavorites();
      newState = !favs.includes(targetId);
    }

    // 2. Mise à jour instantanée du cache local
    let favs = getLocalFavorites();
    if (newState) {
      if (!favs.includes(targetId)) favs.push(targetId);
    } else {
      favs = favs.filter(id => id !== targetId);
    }
    setLocalFavorites(favs);

    return newState;
  },

  // --- REPRISE DE LECTURE AUTOMATIQUE (PLAYBACK PROGRESS & CONTINUE WATCHING) VIA /api/history ---
  /**
   * Sauvegarde la position exacte de lecture (currentTime, duration, etc.) dans l'API Node.js et LocalStorage
   */
  async savePlaybackProgress({
    mediaId,
    title,
    type = 'movie',
    posterUrl = '',
    backdropUrl = '',
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
      backdrop_url: backdropUrl,
      season_number: seasonNumber,
      episode_number: episodeNumber,
      episode_title: episodeTitle,
      current_time_seconds: Math.round(currentTime),
      duration_seconds: Math.round(duration),
      progress_percent: progressPercent,
      completed: isCompleted,
      updated_at: new Date().toISOString()
    };

    // 1. Envoi au backend Node.js /api/history
    try {
      fetch('/api/history', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          media: {
            id: String(mediaId),
            title,
            poster_url: posterUrl,
            backdrop_url: backdropUrl,
            type
          },
          season: seasonNumber,
          episode: episodeNumber,
          progress_seconds: Math.round(currentTime),
          duration_seconds: Math.round(duration),
          completed: isCompleted
        })
      }).catch(() => {});
    } catch (err) {
      // non bloquant
    }

    // 2. Sauvegarde dans le stockage local pour fluidité immédiate
    let history = getLocalHistory();
    history = history.filter(item => !(item.media_id === String(mediaId) && item.season_number === seasonNumber && item.episode_number === episodeNumber));
    history.unshift(progressRecord);
    if (history.length > 25) history = history.slice(0, 25);
    setLocalHistory(history);
  },

  /**
   * Récupère la dernière position enregistrée pour un média précis
   */
  async getPlaybackProgress(mediaId, seasonNumber = 1, episodeNumber = 1) {
    if (!mediaId) return null;

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
    // 1. Appel du backend Node.js /api/history
    try {
      const res = await fetch('/api/history', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.history && Array.isArray(data.history) && data.history.length > 0) {
          const formatted = data.history.map(item => ({
            media_id: item.mediaId || item.media?.id,
            media_title: item.media?.title || 'Titre',
            media_type: item.media?.type || 'movie',
            poster_url: item.media?.poster_url || '',
            backdrop_url: item.media?.backdrop_url || '',
            season_number: item.season || 1,
            episode_number: item.episode || 1,
            current_time_seconds: item.progressSeconds || 0,
            duration_seconds: item.durationSeconds || 0,
            progress_percent: item.progressPercent || 0,
            completed: Boolean(item.completed)
          }));
          return formatted.filter(h => !h.completed && (h.current_time_seconds > 5 || h.progress_percent > 2));
        }
      }
    } catch (e) {
      console.warn("Backend get history fallback:", e.message);
    }

    // 2. Fallback local
    const history = getLocalHistory();
    return history.filter(h => !h.completed && h.current_time_seconds > 5);
  },

  /**
   * Supprime un titre de l'historique
   */
  async removePlaybackProgress(mediaId, seasonNumber = 1, episodeNumber = 1) {
    try {
      fetch(`/api/history/${mediaId}?season=${seasonNumber}&episode=${episodeNumber}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      }).catch(() => {});
    } catch (e) {}

    let history = getLocalHistory();
    history = history.filter(h => !(h.media_id === String(mediaId) && h.season_number === seasonNumber && h.episode_number === episodeNumber));
    setLocalHistory(history);
  },

  /**
   * Signale un flux vidéo cassé vers /api/report
   */
  async reportBrokenStream({ tmdb_id, media_title, server_name, server_index, error_type, details }) {
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          tmdb_id,
          media_title,
          server_name,
          server_index,
          error_type,
          details
        })
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Rapport de flux erreur:", e);
    }
    return { success: false, recommendedServerIndex: (Number(server_index || 0) + 1) % 5 };
  }
};
