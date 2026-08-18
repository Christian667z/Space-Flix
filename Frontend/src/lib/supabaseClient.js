/**
 * Space Flix - Client Supabase et Data Manager
 * Gère la connexion Supabase, l'authentification, les favoris ("Ma Liste"),
 * et fournit un fallback automatique sur le catalogue local si Supabase n'est pas encore configuré.
 */

import { INITIAL_MEDIA } from './data.js';

// Configuration Supabase (peut être remplacée via window.SPACE_FLIX_CONFIG ou modifiée ici)
const DEFAULT_SUPABASE_URL = 'https://gfjyywtxshebhteaxxtf.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdmanl5d3R4c2hlYmh0ZWF4eHRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNTc4NjYsImV4cCI6MjEwMjYzMzg2Nn0.G8EwY9CNUA6fW3d8XqKSjM5qhE8-67qgcUsp0BVPHP0';

const SUPABASE_URL = window.SPACE_FLIX_CONFIG?.SUPABASE_URL || localStorage.getItem('SPACE_FLIX_SUPABASE_URL') || DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SPACE_FLIX_CONFIG?.SUPABASE_ANON_KEY || localStorage.getItem('SPACE_FLIX_SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY;

let supabase = null;

// Initialisation dynamique du SDK Supabase si les clés sont présentes
if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("🚀 Connecté avec succès au backend Supabase !");
  } catch (err) {
    console.warn("⚠️ Impossible d'initialiser Supabase client, basculement en mode démo local:", err);
  }
}

export const supabaseClient = supabase;

// Gestion des favoris en stockage local si Supabase non connecté
const LOCAL_FAVORITES_KEY = 'space_flix_my_list';

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

  async saveConfig(url, key) {
    localStorage.setItem('SPACE_FLIX_SUPABASE_URL', url.trim());
    localStorage.setItem('SPACE_FLIX_SUPABASE_ANON_KEY', key.trim());
    window.location.reload();
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
            results = results.filter(item => item.genres && Array.isArray(item.genres) && item.genres.includes(genre));
          }
          return results;
        }
      } catch (err) {
        console.warn("Erreur Supabase fetch, utilisation des données locales:", err);
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
      list = list.filter(item => item.genres && Array.isArray(item.genres) && item.genres.includes(genre));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(item => (item.title && item.title.toLowerCase().includes(q)) || (item.synopsis && item.synopsis.toLowerCase().includes(q)));
    }
    return list;
  },

  async getFeaturedMedia() {
    const list = await this.getMediaList();
    return list.find(m => m.is_featured) || list[0];
  },

  async getMediaById(id) {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('media').select('*, episodes(*)').eq('id', id).single();
        if (!error && data) return data;
      } catch (e) {
        console.warn("Supabase fetch single error:", e);
      }
    }
    return INITIAL_MEDIA.find(m => m.id === id || m.slug === id) || null;
  },

  // --- GESTION DE "MA LISTE" (FAVORIS) ---
  async getFavorites() {
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase.from('favorites').select('media_id, media(*)').eq('user_id', user.id);
        if (!error && data) return data.map(item => item.media);
      }
    }

    // Local fallback
    const favIds = getLocalFavorites();
    return INITIAL_MEDIA.filter(m => favIds.includes(m.id));
  },

  async isFavorite(mediaId) {
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('favorites').select('id').eq('user_id', user.id).eq('media_id', mediaId).single();
        return !!data;
      }
    }
    const favs = getLocalFavorites();
    return favs.includes(mediaId);
  },

  async toggleFavorite(mediaId) {
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const isFav = await this.isFavorite(mediaId);
        if (isFav) {
          await supabase.from('favorites').delete().eq('user_id', user.id).eq('media_id', mediaId);
          return false;
        } else {
          await supabase.from('favorites').insert([{ user_id: user.id, media_id: mediaId }]);
          return true;
        }
      }
    }

    // Local Storage toggle
    let favs = getLocalFavorites();
    let isFav = false;
    if (favs.includes(mediaId)) {
      favs = favs.filter(id => id !== mediaId);
      isFav = false;
    } else {
      favs.push(mediaId);
      isFav = true;
    }
    setLocalFavorites(favs);
    return isFav;
  },

  // --- AUTHENTIFICATION ---
  async getCurrentUser() {
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    }
    const localUser = localStorage.getItem('space_flix_user');
    return localUser ? JSON.parse(localUser) : null;
  },

  async signUp(email, password, fullName = '') {
    if (supabase) {
      return await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || email.split('@')[0] }
        }
      });
    }
    // Simulation d'inscription locale
    const mockUser = {
      id: 'user-' + Date.now(),
      email,
      created_at: new Date().toISOString(),
      user_metadata: { full_name: fullName || email.split('@')[0] }
    };
    localStorage.setItem('space_flix_user', JSON.stringify(mockUser));
    return { data: { user: mockUser }, error: null };
  },

  async signIn(email, password) {
    if (supabase) {
      return await supabase.auth.signInWithPassword({ email, password });
    }
    // Simulation de connexion locale
    const mockUser = {
      id: 'user-demo',
      email,
      created_at: new Date().toISOString(),
      user_metadata: { full_name: email.split('@')[0] }
    };
    localStorage.setItem('space_flix_user', JSON.stringify(mockUser));
    return { data: { user: mockUser }, error: null };
  },

  async signInWithGoogle() {
    if (supabase) {
      return await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href }
      });
    }
    // Simulation locale (aucun fournisseur OAuth configuré)
    const mockUser = {
      id: 'google_user_' + Date.now(),
      email: 'demo.google@spaceflix.local',
      created_at: new Date().toISOString(),
      user_metadata: { full_name: 'Utilisateur Google' }
    };
    localStorage.setItem('space_flix_user', JSON.stringify(mockUser));
    return { data: { user: mockUser }, error: null };
  },

  async signOut() {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('space_flix_user');
  },

  // Prévient l'appelant à chaque connexion/déconnexion (no-op en mode démo local)
  onAuthStateChange(callback) {
    if (supabase) {
      return supabase.auth.onAuthStateChange((_event, session) => {
        callback(session?.user || null);
      });
    }
    return { data: { subscription: { unsubscribe() {} } } };
  }
};
