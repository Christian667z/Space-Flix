/**
 * Space Flix - Service TMDB (The Movie Database)
 * Interagit avec l'API TMDB pour charger les données réelles de films et séries.
 */

const TMDB_API_KEY = window.SPACE_FLIX_CONFIG?.TMDB_API_KEY || '99b995150ed16f5fc8a3fff320ca41df';
const TMDB_BASE_URL = window.SPACE_FLIX_CONFIG?.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const TMDB_READ_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI5OWI5OTUxNTBlZDE2ZjVmYzhhM2ZmZjMyMGNhNDFkZiIsIm5iZiI6MTc3Nzg2NTQyOS4xOTUwMDAyLCJzdWIiOiI2OWY4MTJkNTIwZjE5YmM2NzUzYjMzOWMiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.CLkjqGqe7uu9v_X2GlImzHtZ1jJ9adfSnGZnhDOw8EI';

const headers = {
  'Accept': 'application/json'
};

/**
  * Génère un poster SVG de secours élégant avec le titre et l'année du film
  */
export function getFallbackPoster(title = 'Film SpaceFlix', year = '2026') {
  const safeTitle = String(title || 'Film HD').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 24);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#180406"/>
        <stop offset="50%" stop-color="#09090e"/>
        <stop offset="100%" stop-color="#040404"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="35%" r="55%">
        <stop offset="0%" stop-color="#f20d22" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#f20d22" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="500" height="750" fill="url(#bg)"/>
    <circle cx="250" cy="270" r="180" fill="url(#glow)"/>
    <path d="M220 220 L310 270 L220 320 Z" fill="#f20d22" opacity="0.9"/>
    <text x="250" y="470" font-family="system-ui, sans-serif" font-weight="800" font-size="32" fill="#ffffff" text-anchor="middle">${safeTitle}</text>
    <text x="250" y="515" font-family="system-ui, sans-serif" font-weight="600" font-size="20" fill="#f20d22" text-anchor="middle">${year} • SPACEFLIX HD</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Normalise un objet TMDB en format média SpaceFlix
 */
export function formatTMDBMedia(item, mediaType = 'movie') {
  const isMovie = (item.media_type === 'movie') || mediaType === 'movie' || !!item.title;
  const type = isMovie ? 'movie' : 'tv';
  const id = item.id;
  const title = item.title || item.name || item.original_title || item.original_name || 'Titre Indisponible';
  const year = (item.release_date || item.first_air_date || '').split('-')[0] || new Date().getFullYear();
  const fallbackSvg = getFallbackPoster(title, year);

  let poster_url = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : fallbackSvg;
  if (poster_url.includes('/null') || poster_url.includes('/undefined')) {
    poster_url = fallbackSvg;
  }

  let backdrop_url = item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : (item.poster_path ? `https://image.tmdb.org/t/p/original${item.poster_path}` : poster_url);
  if (backdrop_url.includes('/null') || backdrop_url.includes('/undefined')) {
    backdrop_url = poster_url;
  }

  return {
    id: `${type}-${id}`,
    tmdb_id: id,
    title: title,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    type: type,
    synopsis: item.overview || 'Aucun synopsis disponible.',
    poster_url: poster_url,
    backdrop_url: backdrop_url,
    rating: item.vote_average ? Number(item.vote_average).toFixed(1) : 8.0,
    release_year: year,
    duration: isMovie ? '2h' : '1 Saison',
    genres: item.genre_ids ? getGenreNamesByIds(item.genre_ids) : ['Action', 'Drame'],
    languages: ['VF', 'VOSTFR'],
    is_trending: item.popularity > 50,
    is_featured: false,
    video_servers: isMovie ? [
      { name: 'Serveur VF 1 (HD)', url: `https://vidsrc.to/embed/movie/${id}`, quality: '1080p', lang: 'VF' },
      { name: 'Serveur VF 2 (Fast)', url: `https://vidsrc.me/embed/movie?tmdb=${id}`, quality: '1080p', lang: 'VF' },
      { name: 'Serveur VOSTFR', url: `https://vidsrc.cc/v2/embed/movie/${id}`, quality: '1080p', lang: 'VOSTFR' }
    ] : [],
    seasons: !isMovie ? [
      {
        season_number: 1,
        episodes: [
          {
            episode_number: 1,
            title: 'Épisode 1',
            video_servers: [
              { name: 'Serveur VF 1', url: `https://vidsrc.to/embed/tv/${id}/1/1`, quality: '1080p', lang: 'VF' },
              { name: 'Serveur VOSTFR', url: `https://vidsrc.me/embed/tv?tmdb=${id}&season=1&episode=1`, quality: '1080p', lang: 'VOSTFR' }
            ]
          }
        ]
      }
    ] : []
  };
}

const TMDB_GENRES_MAP = {
  28: 'Action', 12: 'Aventure', 16: 'Animation', 35: 'Comédie', 80: 'Crime',
  99: 'Documentaire', 18: 'Drame', 10751: 'Famille', 14: 'Fantastique', 36: 'Histoire',
  27: 'Horreur', 10402: 'Musique', 9648: 'Mystère', 10749: 'Romance', 878: 'Sci-Fi',
  10770: 'Téléfilm', 53: 'Thriller', 10752: 'Guerre', 37: 'Western',
  10759: 'Action', 10765: 'Sci-Fi'
};

function getGenreNamesByIds(ids = []) {
  return ids.map(id => TMDB_GENRES_MAP[id] || 'Autre').filter((v, i, a) => a.indexOf(v) === i);
}

export const TMDBService = {
  async getTrending(mediaType = 'all', timeWindow = 'week') {
    try {
      const res = await fetch(`${TMDB_BASE_URL}/trending/${mediaType}/${timeWindow}?api_key=${TMDB_API_KEY}&language=fr-FR`, { headers });
      if (!res.ok) throw new Error(`TMDB HTTP error ${res.status}`);
      const data = await res.json();
      return (data.results || []).map(item => formatTMDBMedia(item, item.media_type || mediaType));
    } catch (err) {
      console.warn("⚠️ Impossible de charger les tendances TMDB:", err);
      return [];
    }
  },

  async getPopularMovies(page = 1) {
    try {
      const res = await fetch(`${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=fr-FR&page=${page}`, { headers });
      if (!res.ok) throw new Error(`TMDB HTTP error ${res.status}`);
      const data = await res.json();
      return (data.results || []).map(item => formatTMDBMedia(item, 'movie'));
    } catch (err) {
      console.warn("⚠️ Impossible de charger les films populaires TMDB:", err);
      return [];
    }
  },

  async getPopularTVShows(page = 1) {
    try {
      const res = await fetch(`${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}&language=fr-FR&page=${page}`, { headers });
      if (!res.ok) throw new Error(`TMDB HTTP error ${res.status}`);
      const data = await res.json();
      return (data.results || []).map(item => formatTMDBMedia(item, 'tv'));
    } catch (err) {
      console.warn("⚠️ Impossible de charger les séries populaires TMDB:", err);
      return [];
    }
  },

  async searchMedia(query) {
    if (!query) return [];
    try {
      const res = await fetch(`${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}`, { headers });
      if (!res.ok) throw new Error(`TMDB HTTP error ${res.status}`);
      const data = await res.json();
      return (data.results || [])
        .filter(item => item.media_type === 'movie' || item.media_type === 'tv')
        .map(item => formatTMDBMedia(item, item.media_type));
    } catch (err) {
      console.warn("⚠️ Erreur lors de la recherche TMDB:", err);
      return [];
    }
  },

  async getMediaByGenre(genreName) {
    if (!genreName || genreName === 'Tous') return [];
    const genreMap = {
      'Action': 28, 'Aventure': 12, 'Animation': 16, 'Comédie': 35,
      'Crime': 80, 'Drame': 18, 'Fantastique': 14, 'Histoire': 36,
      'Horreur': 27, 'Mystère': 9648, 'Romance': 10749, 'Sci-Fi': 878,
      'Thriller': 53, 'Biopic': 36
    };
    const genreId = genreMap[genreName];
    if (!genreId) return [];

    try {
      const [resMovie, resTV] = await Promise.all([
        fetch(`${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&language=fr-FR&with_genres=${genreId}&sort_by=popularity.desc`, { headers }),
        fetch(`${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&language=fr-FR&with_genres=${genreId}&sort_by=popularity.desc`, { headers })
      ]);

      const dataMovie = await resMovie.json();
      const dataTV = await resTV.json();

      const movies = (dataMovie.results || []).map(item => formatTMDBMedia(item, 'movie'));
      const tvs = (dataTV.results || []).map(item => formatTMDBMedia(item, 'tv'));

      return [...movies, ...tvs];
    } catch (err) {
      console.warn(`⚠️ Erreur fetch genre TMDB (${genreName}):`, err);
      return [];
    }
  }
};
