/**
 * Space Flix - Service TMDB (The Movie Database)
 * Interagit avec l'API TMDB pour charger les données en temps réel (VF/VOSTFR).
 */

const TMDB_API_KEY = window.SPACE_FLIX_CONFIG?.TMDB_API_KEY || '99b995150ed16f5fc8a3fff320ca41df';
const TMDB_BASE_URL = window.SPACE_FLIX_CONFIG?.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_READ_ACCESS_TOKEN = window.SPACE_FLIX_CONFIG?.TMDB_READ_ACCESS_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI5OWI5OTUxNTBlZDE2ZjVmYzhhM2ZmZjMyMGNhNDFkZiIsIm5iZiI6MTc3Nzg2NTQyOS4xOTUwMDAyLCJzdWIiOiI2OWY4MTJkNTIwZjE5YmM2NzUzYjMzOWMiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.CLkjqGqe7uu9v_X2GlImzHtZ1jJ9adfSnGZnhDOw8EI';

const headers = {
  'Accept': 'application/json',
  'Authorization': `Bearer ${TMDB_READ_ACCESS_TOKEN}`
};

/**
 * Fonction de requête TMDB résiliente : tente le proxy serveur /api/tmdb/ en priorité, avec fallback direct
 */
async function fetchFromTMDB(path, queryParams = {}) {
  const cleanPath = path.replace(/^\//, '');
  
  // 1. Essai via le proxy sécurisé du serveur
  try {
    const proxyUrl = new URL(`/api/tmdb/${cleanPath}`, window.location.origin);
    for (const [k, v] of Object.entries(queryParams)) {
      if (v !== undefined && v !== null && v !== '') {
        proxyUrl.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(proxyUrl.toString(), { headers });
    if (res.ok) return await res.json();
  } catch (err) {
    // Si proxy indisponible (client-only), fallback direct
  }

  // 2. Fallback direct vers api.themoviedb.org
  const directUrl = new URL(`${TMDB_BASE_URL}/${cleanPath}`);
  directUrl.searchParams.set('api_key', TMDB_API_KEY);
  if (!queryParams.language) directUrl.searchParams.set('language', 'fr-FR');
  for (const [k, v] of Object.entries(queryParams)) {
    if (v !== undefined && v !== null && v !== '') {
      directUrl.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(directUrl.toString(), { headers });
  if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
  return await res.json();
}

/**
 * Génère un poster SVG de secours élégant au style cinéma Rouge & Noir SpaceFlix
 */
export function getFallbackPoster(title = 'Film SpaceFlix', year = '2026') {
  const safeTitle = String(title || 'Film HD').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 26);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#140406"/>
        <stop offset="50%" stop-color="#0a0304"/>
        <stop offset="100%" stop-color="#000000"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="35%" r="55%">
        <stop offset="0%" stop-color="#E50914" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="500" height="750" fill="url(#bg)"/>
    <circle cx="250" cy="270" r="180" fill="url(#glow)"/>
    <rect x="200" y="220" width="100" height="100" rx="20" fill="rgba(229,9,20,0.2)" stroke="#E50914" stroke-width="2"/>
    <path d="M240 250 L275 270 L240 290 Z" fill="#ffffff"/>
    <text x="250" y="470" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="28" fill="#ffffff" text-anchor="middle">${safeTitle}</text>
    <text x="250" y="515" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="18" fill="#E50914" text-anchor="middle">${year} • SPACEFLIX HD</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const TMDB_GENRES_MAP = {
  28: 'Action', 12: 'Aventure', 16: 'Animation', 35: 'Comédie', 80: 'Crime',
  99: 'Documentaire', 18: 'Drame', 10751: 'Famille', 14: 'Fantastique', 36: 'Histoire',
  27: 'Horreur', 10402: 'Musique', 9648: 'Mystère', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'Téléfilm', 53: 'Thriller', 10752: 'Guerre', 37: 'Western',
  10759: 'Action', 10765: 'Sci-Fi'
};

export function getGenreNamesByIds(ids = []) {
  if (!Array.isArray(ids)) return ['Action', 'Drame'];
  const names = ids.map(id => TMDB_GENRES_MAP[id] || 'Autre').filter(v => v !== 'Autre');
  return names.length > 0 ? names.slice(0, 3) : ['Action', 'Drame'];
}

/**
 * Normalise un objet TMDB en format média SpaceFlix complet
 */
export function formatTMDBMedia(item, mediaType = 'movie') {
  if (!item) return null;
  const isMovie = (item.media_type === 'movie') || mediaType === 'movie' || !!item.title;
  const type = isMovie ? 'movie' : 'tv';
  const id = item.id;
  const title = item.title || item.name || item.original_title || item.original_name || 'Titre Indisponible';
  const year = (item.release_date || item.first_air_date || '').split('-')[0] || new Date().getFullYear();
  const fallbackSvg = getFallbackPoster(title, year);

  let poster_url = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : fallbackSvg;
  if (!item.poster_path || poster_url.includes('/null') || poster_url.includes('/undefined')) {
    poster_url = fallbackSvg;
  }

  let backdrop_url = item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : (item.poster_path ? `https://image.tmdb.org/t/p/original${item.poster_path}` : poster_url);
  if (!item.backdrop_path && !item.poster_path) {
    backdrop_url = 'https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fKSuV0vqv.jpg';
  }

  return {
    id: `${type}-${id}`,
    tmdb_id: id,
    title: title,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    type: type,
    synopsis: item.overview || 'Synopsis non disponible en français. Profitez de ce titre en streaming HD sur SpaceFlix.',
    poster_url: poster_url,
    backdrop_url: backdrop_url,
    rating: item.vote_average ? Number(item.vote_average).toFixed(1) : '8.0',
    release_year: year,
    duration: isMovie ? '2h 05m' : '1 Saison',
    genres: item.genre_ids ? getGenreNamesByIds(item.genre_ids) : ['Action', 'Drame'],
    languages: ['VF', 'VOSTFR'],
    is_trending: (item.popularity || 0) > 40,
    is_featured: false,
    video_servers: isMovie ? [
      { name: 'Serveur 1 (MultiEmbed VF / Multi)', url: `https://multiembed.mov/?video_id=${id}&tmdb=1`, quality: '1080p', lang: 'VF / Multi' },
      { name: 'Serveur 2 (VidLink VF / STFR)', url: `https://vidlink.pro/movie/${id}?primaryColor=e50914&subtitles=fre,fra,fr`, quality: '1080p', lang: 'VF / VOSTFR' },
      { name: 'Serveur 3 (VidSrc CC HD)', url: `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=false`, quality: '1080p', lang: 'Multi HD' },
      { name: 'Serveur 4 (AutoEmbed Rapide)', url: `https://player.autoembed.cc/embed/movie/${id}`, quality: '1080p', lang: 'VF / Multi' }
    ] : [],
    seasons: !isMovie ? [
      {
        season_number: 1,
        episodes: [
          {
            episode_number: 1,
            title: 'Épisode 1',
            synopsis: item.overview || 'Début de la saison.',
            still_path: backdrop_url,
            video_servers: [
              { name: 'Serveur 1 (MultiEmbed VF / Multi)', url: `https://multiembed.mov/?video_id=${id}&tmdb=1&s=1&e=1`, quality: '1080p', lang: 'VF / Multi' },
              { name: 'Serveur 2 (VidLink VF / STFR)', url: `https://vidlink.pro/tv/${id}/1/1?primaryColor=e50914&subtitles=fre,fra,fr`, quality: '1080p', lang: 'VF / VOSTFR' },
              { name: 'Serveur 3 (VidSrc CC HD)', url: `https://vidsrc.cc/v2/embed/tv/${id}/1/1`, quality: '1080p', lang: 'Multi HD' },
              { name: 'Serveur 4 (AutoEmbed)', url: `https://player.autoembed.cc/embed/tv/${id}/1/1`, quality: '1080p', lang: 'VF / Multi' }
            ]
          },
          {
            episode_number: 2,
            title: 'Épisode 2',
            synopsis: 'La suite palpitante des aventures.',
            still_path: backdrop_url,
            video_servers: [
              { name: 'Serveur 1 (MultiEmbed VF / Multi)', url: `https://multiembed.mov/?video_id=${id}&tmdb=1&s=1&e=2`, quality: '1080p', lang: 'VF / Multi' },
              { name: 'Serveur 2 (VidLink VF / STFR)', url: `https://vidlink.pro/tv/${id}/1/2?primaryColor=e50914&subtitles=fre,fra,fr`, quality: '1080p', lang: 'VF / VOSTFR' },
              { name: 'Serveur 3 (VidSrc CC HD)', url: `https://vidsrc.cc/v2/embed/tv/${id}/1/2`, quality: '1080p', lang: 'Multi HD' }
            ]
          },
          {
            episode_number: 3,
            title: 'Épisode 3',
            synopsis: 'Le dénouement se prépare.',
            still_path: backdrop_url,
            video_servers: [
              { name: 'Serveur 1 (MultiEmbed VF / Multi)', url: `https://multiembed.mov/?video_id=${id}&tmdb=1&s=1&e=3`, quality: '1080p', lang: 'VF / Multi' },
              { name: 'Serveur 2 (VidLink VF / STFR)', url: `https://vidlink.pro/tv/${id}/1/3?primaryColor=e50914&subtitles=fre,fra,fr`, quality: '1080p', lang: 'VF / VOSTFR' },
              { name: 'Serveur 3 (VidSrc CC HD)', url: `https://vidsrc.cc/v2/embed/tv/${id}/1/3`, quality: '1080p', lang: 'Multi HD' }
            ]
          }
        ]
      }
    ] : []
  };
}

export const TMDBService = {
  async getCatalog({ genre = null, search = null, page = 1 } = {}) {
    try {
      if (search && search.trim()) {
        return await this.searchMedia(search.trim());
      }
      if (genre && genre !== 'Tous') {
        return await this.getMediaByGenre(genre);
      }
      const [trending, movies, tvs] = await Promise.allSettled([
        this.getTrending('all', 'week'),
        this.getPopularMovies(page),
        this.getPopularTVShows(page)
      ]);
      const resTrending = trending.status === 'fulfilled' ? trending.value : [];
      const resMovies = movies.status === 'fulfilled' ? movies.value : [];
      const resTV = tvs.status === 'fulfilled' ? tvs.value : [];
      
      const combined = [...resTrending, ...resMovies, ...resTV];
      const seen = new Set();
      return combined.filter(item => {
        if (!item || !item.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    } catch (err) {
      console.warn("Info TMDB getCatalog:", err.message);
      return [];
    }
  },

  async getTrending(mediaType = 'all', timeWindow = 'week') {
    try {
      const data = await fetchFromTMDB(`trending/${mediaType}/${timeWindow}`, { language: 'fr-FR' });
      return (data.results || []).map(item => formatTMDBMedia(item, item.media_type || mediaType)).filter(Boolean);
    } catch (err) {
      console.warn("Info TMDB getTrending:", err.message);
      return [];
    }
  },

  async getPopularMovies(page = 1) {
    try {
      const data = await fetchFromTMDB('movie/popular', { language: 'fr-FR', page: String(page) });
      return (data.results || []).map(item => formatTMDBMedia(item, 'movie')).filter(Boolean);
    } catch (err) {
      console.warn("Info TMDB getPopularMovies:", err.message);
      return [];
    }
  },

  async getPopularTVShows(page = 1) {
    try {
      const data = await fetchFromTMDB('tv/popular', { language: 'fr-FR', page: String(page) });
      return (data.results || []).map(item => formatTMDBMedia(item, 'tv')).filter(Boolean);
    } catch (err) {
      console.warn("Info TMDB getPopularTVShows:", err.message);
      return [];
    }
  },

  async searchMedia(query) {
    if (!query) return [];
    try {
      const data = await fetchFromTMDB('search/multi', { language: 'fr-FR', query: query });
      return (data.results || [])
        .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
        .map(item => formatTMDBMedia(item, item.media_type))
        .filter(Boolean);
    } catch (err) {
      console.warn("Info TMDB searchMedia:", err.message);
      return [];
    }
  },

  async getMediaByGenre(genreName) {
    if (!genreName || genreName === 'Tous') return [];
    const genreMap = {
      'Action': 28,
      'Aventure': 12,
      'Animation': 16,
      'Comédie': 35,
      'Crime': 80,
      'Drame': 18,
      'Fantastique': 14,
      'Histoire': 36,
      'Horreur': 27,
      'Médical': 18,
      'Mystère': 9648,
      'Romance': 10749,
      'Sci-Fi': 878,
      'Science-Fiction': 878,
      'Thriller': 53,
      'Biopic': 36
    };
    const genreId = genreMap[genreName];
    if (!genreId) return [];

    try {
      const [resMovie, resTV] = await Promise.allSettled([
        fetchFromTMDB('discover/movie', { language: 'fr-FR', with_genres: String(genreId), sort_by: 'popularity.desc' }),
        fetchFromTMDB('discover/tv', { language: 'fr-FR', with_genres: String(genreId), sort_by: 'popularity.desc' })
      ]);

      const movieResults = resMovie.status === 'fulfilled' ? (resMovie.value?.results || []) : [];
      const tvResults = resTV.status === 'fulfilled' ? (resTV.value?.results || []) : [];

      const movies = movieResults.map(item => formatTMDBMedia(item, 'movie')).filter(Boolean);
      const tvs = tvResults.map(item => formatTMDBMedia(item, 'tv')).filter(Boolean);

      return [...movies, ...tvs];
    } catch (err) {
      console.warn(`Info TMDB genre (${genreName}):`, err.message);
      return [];
    }
  },

  /**
   * Découverte avancée avec filtres multiples : Type, Genre, Année, Langue, Tri & Pagination
   */
  async discoverMedia({ type = 'all', genre = null, year = null, lang = null, sortBy = 'popularity.desc', page = 1 } = {}) {
    const genreMap = {
      'Action': 28, 'Aventure': 12, 'Animation': 16, 'Comédie': 35,
      'Crime': 80, 'Drame': 18, 'Fantastique': 14, 'Histoire': 36,
      'Horreur': 27, 'Médical': 18, 'Mystère': 9648, 'Romance': 10749,
      'Sci-Fi': 878, 'Science-Fiction': 878, 'Thriller': 53, 'Biopic': 36
    };

    const providerMap = {
      'netflix': 8,
      'disney': 337,
      'prime': 119,
      'max': 1899,
      'appletv': 350,
      'canal': 381,
      'paramount': 531,
      'crunchyroll': 283
    };

    const genreId = genre && genre !== 'Tous' ? genreMap[genre] : null;
    const providerId = provider && provider !== 'all' ? (providerMap[provider.toLowerCase()] || provider) : null;

    const sortParam = sortBy || 'popularity.desc';
    const minVotes = sortParam.includes('vote_average') ? 50 : undefined;

    // Ne restreindre with_original_language que si explicitement demandé (ex. cinéma purement francophone)
    let withOriginalLang = undefined;
    if (lang === 'vo_fr') withOriginalLang = 'fr';
    else if (lang === 'en') withOriginalLang = 'en';
    else if (lang === 'ht') withOriginalLang = 'ht';

    const commonParams = {
      sort_by: sortParam,
      language: 'fr-FR',
      page: String(page)
    };
    if (minVotes) commonParams['vote_count.gte'] = String(minVotes);
    if (genreId) commonParams['with_genres'] = String(genreId);
    if (providerId) {
      commonParams['with_watch_providers'] = String(providerId);
      commonParams['watch_region'] = 'FR';
    }
    if (withOriginalLang) commonParams['with_original_language'] = withOriginalLang;

    try {
      if (type === 'movie') {
        const movieParams = { ...commonParams };
        if (year && year !== 'all') movieParams['primary_release_year'] = String(year);
        const data = await fetchFromTMDB('discover/movie', movieParams);
        return (data.results || []).map(item => formatTMDBMedia(item, 'movie')).filter(Boolean);
      } else if (type === 'tv') {
        const tvParams = { ...commonParams };
        if (year && year !== 'all') tvParams['first_air_date_year'] = String(year);
        const data = await fetchFromTMDB('discover/tv', tvParams);
        return (data.results || []).map(item => formatTMDBMedia(item, 'tv')).filter(Boolean);
      } else {
        // Combiné Movie + TV
        const movieParams = { ...commonParams };
        if (year && year !== 'all') movieParams['primary_release_year'] = String(year);
        const tvParams = { ...commonParams };
        if (year && year !== 'all') tvParams['first_air_date_year'] = String(year);

        const [resM, resT] = await Promise.allSettled([
          fetchFromTMDB('discover/movie', movieParams),
          fetchFromTMDB('discover/tv', tvParams)
        ]);
        const mList = resM.status === 'fulfilled' ? (resM.value?.results || []).map(i => formatTMDBMedia(i, 'movie')) : [];
        const tList = resT.status === 'fulfilled' ? (resT.value?.results || []).map(i => formatTMDBMedia(i, 'tv')) : [];
        const combined = [...mList, ...tList].filter(Boolean);
        const seen = new Set();
        return combined.filter(item => {
          if (!item || !item.id || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      }
    } catch (err) {
      console.warn("Info TMDB discoverMedia:", err.message);
      return [];
    }
  },

  /**
   * Récupère les vidéos et bandes-annonces officielles TMDB (YouTube)
   */
  async getMediaVideos(tmdbId, mediaType = 'movie') {
    if (!tmdbId) return [];
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    const cleanId = String(tmdbId).replace(/^[a-z]+-/, '');

    try {
      // 1. Essai en français d'abord
      let data = await fetchFromTMDB(`${type}/${cleanId}/videos`, { language: 'fr-FR' }).catch(() => null);
      let results = data?.results || [];

      // 2. Si aucune vidéo trouvée en FR, récupérer les vidéos en VO (en-US)
      if (results.length === 0) {
        const dataEn = await fetchFromTMDB(`${type}/${cleanId}/videos`, { language: 'en-US' }).catch(() => null);
        results = dataEn?.results || [];
      }

      // Filtrer les vidéos YouTube valides
      return results
        .filter(v => v.site === 'YouTube' && v.key)
        .map(v => ({
          id: v.id,
          key: v.key,
          name: v.name || 'Bande-annonce officielle',
          type: v.type || 'Trailer',
          official: !!v.official,
          embedUrl: `https://www.youtube-nocookie.com/embed/${v.key}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`
        }));
    } catch (err) {
      console.warn(`Info TMDB videos (${cleanId}):`, err.message);
      return [];
    }
  },

  /**
   * Récupère les détails d'un film
   */
  async getMovieDetails(tmdbId) {
    if (!tmdbId) return null;
    const cleanId = String(tmdbId).replace(/^[a-z]+-/, '');
    try {
      return await fetchFromTMDB(`movie/${cleanId}`, { language: 'fr-FR' });
    } catch (err) {
      console.warn(`Info Movie Details (${cleanId}):`, err.message);
      return null;
    }
  },

  /**
   * Récupère les détails d'une série TV (nombre de saisons, épisodes)
   */
  async getTVShowDetails(tmdbId) {
    if (!tmdbId) return null;
    const cleanId = String(tmdbId).replace(/^[a-z]+-/, '');
    try {
      let data = await fetchFromTMDB(`tv/${cleanId}`, { language: 'fr-FR' }).catch(() => null);
      if (!data) {
        data = await fetchFromTMDB(`tv/${cleanId}`, { language: 'en-US' }).catch(() => null);
      }
      return data;
    } catch (err) {
      console.warn(`Info TV Details (${cleanId}):`, err.message);
      return null;
    }
  },

  /**
   * Récupère les épisodes réels d'une saison de série TV
   */
  async getTVSeasonDetails(tmdbId, seasonNumber = 1) {
    if (!tmdbId) return [];
    const cleanId = String(tmdbId).replace(/^[a-z]+-/, '');
    try {
      let data = await fetchFromTMDB(`tv/${cleanId}/season/${seasonNumber}`, { language: 'fr-FR' }).catch(() => null);
      if (!data) {
        data = await fetchFromTMDB(`tv/${cleanId}/season/${seasonNumber}`, { language: 'en-US' }).catch(() => null);
      }
      return (data?.episodes || []).map(ep => ({
        episode_number: ep.episode_number,
        name: ep.name || `Épisode ${ep.episode_number}`,
        title: ep.name || `Épisode ${ep.episode_number}`,
        synopsis: ep.overview || 'Épisode complet disponible en streaming HD.',
        overview: ep.overview || 'Épisode complet disponible en streaming HD.',
        still_path: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : null,
        vote_average: ep.vote_average ? Number(ep.vote_average).toFixed(1) : '8.0',
        air_date: ep.air_date
      }));
    } catch (err) {
      console.warn(`Info TV Season (${cleanId} S${seasonNumber}):`, err.message);
      return [];
    }
  },

  /**
   * Récupère les recommandations et titres similaires pour un média donné
   */
  async getMediaRecommendations(tmdbId, mediaType = 'movie') {
    if (!tmdbId) return [];
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    const cleanId = String(tmdbId).replace(/^[a-z]+-/, '');

    try {
      const [resRec, resSim] = await Promise.allSettled([
        fetchFromTMDB(`${type}/${cleanId}/recommendations`, { language: 'fr-FR' }),
        fetchFromTMDB(`${type}/${cleanId}/similar`, { language: 'fr-FR' })
      ]);

      const recs = resRec.status === 'fulfilled' ? (resRec.value?.results || []) : [];
      const sims = resSim.status === 'fulfilled' ? (resSim.value?.results || []) : [];
      const combined = [...recs, ...sims]
        .map(item => formatTMDBMedia(item, type))
        .filter(Boolean);

      const seen = new Set();
      return combined.filter(item => {
        if (!item || !item.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    } catch (err) {
      console.warn(`Info TMDB recommendations (${cleanId}):`, err.message);
      return [];
    }
  },

  /**
   * Génère des recommandations personnalisées basées sur l'historique et les favoris de l'utilisateur
   */
  async getPersonalizedRecommendations(historyList = [], favoritesList = []) {
    try {
      const sourceItems = [...(historyList || []), ...(favoritesList || [])];
      
      if (sourceItems.length === 0) {
        // Fallback si l'utilisateur n'a pas encore d'historique : Top pépites et tendances
        return await this.getTrending('all', 'week');
      }

      // Prendre les 4 derniers médias consultés ou ajoutés
      const sampleItems = sourceItems.slice(0, 4);
      const recPromises = sampleItems.map(item => 
        this.getMediaRecommendations(item.media_id || item.id, item.type || (item.season_number ? 'tv' : 'movie'))
      );

      const results = await Promise.allSettled(recPromises);
      const combined = [];
      results.forEach(res => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          combined.push(...res.value);
        }
      });

      // Si pas assez de résultats, compléter avec des nouveautés populaires
      if (combined.length < 6) {
        const topMovies = await this.getPopularMovies(1);
        combined.push(...topMovies);
      }

      // Déduplication
      const seen = new Set(sourceItems.map(i => String(i.media_id || i.id)));
      return combined.filter(item => {
        if (!item || !item.id || seen.has(String(item.id))) return false;
        seen.add(String(item.id));
        return true;
      });
    } catch (err) {
      console.warn("Info personalized recommendations:", err.message);
      return await this.getTrending('all', 'week');
    }
  }
};

