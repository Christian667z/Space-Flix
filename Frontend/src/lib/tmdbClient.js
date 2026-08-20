/**
 * Space Flix - TMDB Client API
 * Intègre l'API TMDB avec proxy backend sécurisé et fallback de secours
 */

import { INITIAL_MEDIA } from './data.js';

export const AUTHORIZED_EMBED_PROVIDERS = [
  {
    name: 'Serveur 1 (VidLink - recommandé)',
    movie: 'https://vidlink.pro/movie/{tmdb_id}?primaryColor=e50914',
    tv: 'https://vidlink.pro/tv/{tmdb_id}/{season}/{episode}?primaryColor=e50914'
  },
  {
    name: 'Serveur 2 (VidSrc XYZ)',
    movie: 'https://vidsrc.xyz/embed/movie/{tmdb_id}',
    tv: 'https://vidsrc.xyz/embed/tv/{tmdb_id}/{season}/{episode}'
  },
  {
    name: 'Serveur 3 (SmashyStream)',
    movie: 'https://embed.smashystream.com/playere.php?tmdb={tmdb_id}',
    tv: 'https://embed.smashystream.com/playere.php?tmdb={tmdb_id}&s={season}&e={episode}'
  },
  {
    name: 'Serveur 4 (MultiEmbed)',
    movie: 'https://multiembed.net/?video_id={tmdb_id}&tmdb=1',
    tv: 'https://multiembed.net/?video_id={tmdb_id}&tmdb=1&s={season}&e={episode}'
  }
];

export function getApiBaseUrl() {
  if (window.SPACE_FLIX_CONFIG?.API_BASE_URL) {
    return window.SPACE_FLIX_CONFIG.API_BASE_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname, port } = window.location;
    if (protocol === 'file:' || (hostname === 'localhost' && port && port !== '3000') || (hostname === '127.0.0.1' && port && port !== '3000')) {
      return 'http://localhost:3000';
    }
  }
  return '';
}

async function fetchFromTMDB(endpoint, params = {}) {
  try {
    const cleanEndpoint = String(endpoint).replace(/^\/+/, '');
    const queryParams = new URLSearchParams();
    
    // Langue par défaut
    queryParams.set('language', 'fr-FR');

    // Injection des paramètres de requête sans clé api_key (gérée côté backend)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && key !== 'api_key') {
        queryParams.set(key, String(value));
      }
    }

    const baseUrl = getApiBaseUrl();
    const proxyUrl = `${baseUrl}/api/tmdb/${cleanEndpoint}?${queryParams.toString()}`;

    const res = await fetch(proxyUrl);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn(`[TMDB Client] Erreur lors de l'appel au proxy /api/tmdb/${endpoint}:`, err.message);
  }
  return null;
}

export const TMDB = {
  // Obtenir les tendances (films & séries)
  async getTrending(timeWindow = 'day') {
    const data = await fetchFromTMDB(`trending/all/${timeWindow}`);
    if (data && data.results && data.results.length > 0) {
      return data.results.map(formatTMDBItem);
    }
    return INITIAL_MEDIA.filter(m => m.is_trending);
  },

  // Obtenir les films populaires
  async getPopularMovies(page = 1) {
    const data = await fetchFromTMDB('movie/popular', { page });
    if (data && data.results && data.results.length > 0) {
      return data.results.map(item => formatTMDBItem({ ...item, media_type: 'movie' }));
    }
    return INITIAL_MEDIA.filter(m => m.type === 'movie');
  },

  // Obtenir les séries populaires
  async getPopularTV(page = 1) {
    const data = await fetchFromTMDB('tv/popular', { page });
    if (data && data.results && data.results.length > 0) {
      return data.results.map(item => formatTMDBItem({ ...item, media_type: 'tv' }));
    }
    return INITIAL_MEDIA.filter(m => m.type === 'tv');
  },

  // Obtenir les sorties récentes (now_playing)
  async getNowPlayingMovies(page = 1) {
    const data = await fetchFromTMDB('movie/now_playing', { page });
    if (data && data.results && data.results.length > 0) {
      return data.results.map(item => formatTMDBItem({ ...item, media_type: 'movie' }));
    }
    return INITIAL_MEDIA.filter(m => m.release_year >= 2024);
  },

  // Obtenir les mieux notés
  async getTopRated(mediaType = 'movie', page = 1) {
    const data = await fetchFromTMDB(`${mediaType}/top_rated`, { page });
    if (data && data.results && data.results.length > 0) {
      return data.results.map(item => formatTMDBItem({ ...item, media_type: mediaType }));
    }
    return [];
  },

  // Flux de découverte paginé infini
  async getDiscoverFeed(page = 1, mediaType = 'all') {
    if (mediaType === 'tv') {
      const data = await fetchFromTMDB('discover/tv', { page, sort_by: 'popularity.desc', 'vote_count.gte': 50 });
      if (data && data.results) return data.results.map(i => formatTMDBItem({ ...i, media_type: 'tv' }));
    } else if (mediaType === 'movie') {
      const data = await fetchFromTMDB('discover/movie', { page, sort_by: 'popularity.desc', 'vote_count.gte': 50 });
      if (data && data.results) return data.results.map(i => formatTMDBItem({ ...i, media_type: 'movie' }));
    } else {
      // Mix films et séries
      const [movies, tv] = await Promise.allSettled([
        fetchFromTMDB('discover/movie', { page, sort_by: 'popularity.desc', 'vote_count.gte': 40 }),
        fetchFromTMDB('discover/tv', { page, sort_by: 'popularity.desc', 'vote_count.gte': 40 })
      ]);
      const mList = movies.status === 'fulfilled' && movies.value?.results ? movies.value.results.map(i => formatTMDBItem({ ...i, media_type: 'movie' })) : [];
      const tList = tv.status === 'fulfilled' && tv.value?.results ? tv.value.results.map(i => formatTMDBItem({ ...i, media_type: 'tv' })) : [];
      
      const mixed = [];
      const maxLen = Math.max(mList.length, tList.length);
      for (let i = 0; i < maxLen; i++) {
        if (mList[i]) mixed.push(mList[i]);
        if (tList[i]) mixed.push(tList[i]);
      }
      return mixed;
    }
    return [];
  },

  // Obtenir les séries diffusées récemment
  async getOnTheAirTV(page = 1) {
    const data = await fetchFromTMDB('tv/on_the_air', { page });
    if (data && data.results && data.results.length > 0) {
      return data.results.map(item => formatTMDBItem({ ...item, media_type: 'tv' }));
    }
    return INITIAL_MEDIA.filter(m => m.type === 'tv');
  },

  // Recherche globale (Films et Séries)
  async searchMulti(query, page = 1) {
    if (!query || query.trim().length === 0) return [];
    const data = await fetchFromTMDB('search/multi', { query: query.trim(), page });
    if (data && data.results) {
      return data.results
        .filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && (item.poster_path || item.backdrop_path))
        .map(formatTMDBItem);
    }
    const qLower = query.toLowerCase();
    return INITIAL_MEDIA.filter(m => m.title.toLowerCase().includes(qLower));
  },

  // Obtenir les détails complets d'un média (genres, trailers, casting)
  async getDetails(id, mediaType = 'movie') {
    const data = await fetchFromTMDB(`${mediaType}/${id}`, {
      append_to_response: 'videos,credits,similar,recommendations'
    });
    if (data) {
      return formatTMDBDetails(data, mediaType);
    }
    return INITIAL_MEDIA.find(m => m.tmdb_id === Number(id) || m.id === id) || null;
  },

  // Obtenir les épisodes d'une saison pour une série TV
  async getSeasonEpisodes(tvId, seasonNumber) {
    const data = await fetchFromTMDB(`tv/${tvId}/season/${seasonNumber}`);
    if (data && data.episodes) {
      return data.episodes.map(ep => ({
        id: ep.id,
        episode_number: ep.episode_number,
        season_number: ep.season_number,
        name: ep.name || `Épisode ${ep.episode_number}`,
        overview: ep.overview || 'Aucune description disponible pour cet épisode.',
        still_path: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : null,
        vote_average: ep.vote_average ? ep.vote_average.toFixed(1) : '8.0',
        air_date: ep.air_date || ''
      }));
    }
    return [];
  },

  // Obtenir les films ou séries par genre
  async discoverByGenre(genreId, mediaType = 'movie', page = 1) {
    const data = await fetchFromTMDB(`discover/${mediaType}`, {
      with_genres: genreId,
      sort_by: 'popularity.desc',
      page
    });
    if (data && data.results) {
      return data.results.map(item => formatTMDBItem({ ...item, media_type: mediaType }));
    }
    return [];
  },

  // Obtenir les médias par plateforme (Netflix: 8, Disney+: 337, Prime: 119, etc.)
  async discoverByProvider(providerId, mediaType = 'movie', page = 1) {
    const data = await fetchFromTMDB(`discover/${mediaType}`, {
      with_watch_providers: providerId,
      watch_region: 'FR',
      sort_by: 'popularity.desc',
      page
    });
    if (data && data.results) {
      return data.results.map(item => formatTMDBItem({ ...item, media_type: mediaType }));
    }
    return [];
  }
};

// Dictionnaire des genres TMDB
const GENRE_MAP = {
  28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie", 80: "Crime",
  99: "Documentaire", 18: "Drame", 10751: "Famille", 14: "Fantastique",
  36: "Histoire", 27: "Horreur", 10402: "Musique", 9648: "Mystère",
  10749: "Romance", 878: "Sci-Fi", 10770: "Téléfilm", 53: "Thriller",
  10752: "Guerre", 37: "Western", 10759: "Action & Aventure",
  10762: "Kids", 10763: "Actualités", 10764: "Télé-réalité",
  10765: "Sci-Fi & Fantastique", 10766: "Feuilleton", 10767: "Talk-show",
  10768: "Guerre & Politique"
};

function formatTMDBItem(item) {
  const isMovie = item.media_type === 'movie' || (!item.media_type && item.title);
  const type = isMovie ? 'movie' : 'tv';
  const tmdbId = item.id;
  const title = item.title || item.name || 'Titre inconnu';
  const releaseDate = item.release_date || item.first_air_date || '';
  const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : (new Date().getFullYear());
  
  const genres = item.genre_ids ? item.genre_ids.map(id => GENRE_MAP[id]).filter(Boolean) : (item.genres ? item.genres.map(g => g.name) : []);

  const posterPath = item.poster_path 
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}` 
    : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=500&q=80';

  const backdropPath = item.backdrop_path 
    ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` 
    : posterPath;

  const rating = item.vote_average ? Number(item.vote_average).toFixed(1) : '8.0';

  return {
    id: `${type[0]}-${tmdbId}`,
    tmdb_id: tmdbId,
    title,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    type,
    synopsis: item.overview || 'Plongez dans cette production captivante en streaming haute définition gratuit VF et VOSTFR sur SpaceFlix.',
    poster_url: posterPath,
    backdrop_url: backdropPath,
    rating,
    release_year: releaseYear,
    duration: isMovie ? "1h 55m" : "Série TV",
    genres: genres.length > 0 ? genres.slice(0, 3) : ["Action", "Drame"],
    languages: ["VF", "VOSTFR"],
    is_trending: true,
    is_featured: false,
    popularity: item.popularity || 0
  };
}

function formatTMDBDetails(data, type) {
  const isMovie = type === 'movie';
  const tmdbId = data.id;
  const title = data.title || data.name || 'Titre inconnu';
  const releaseDate = data.release_date || data.first_air_date || '';
  const releaseYear = releaseDate ? new Date(releaseDate).getFullYear() : (new Date().getFullYear());
  const genres = data.genres ? data.genres.map(g => g.name) : [];
  
  let duration = "HD";
  if (isMovie && data.runtime) {
    const hours = Math.floor(data.runtime / 60);
    const mins = data.runtime % 60;
    duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  } else if (!isMovie && data.number_of_seasons) {
    duration = `${data.number_of_seasons} Saison${data.number_of_seasons > 1 ? 's' : ''}`;
  }

  // Chercher un trailer YouTube VF ou VOST
  let trailerKey = null;
  if (data.videos && data.videos.results && data.videos.results.length > 0) {
    const trailer = data.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube') || data.videos.results[0];
    if (trailer) trailerKey = trailer.key;
  }

  const posterPath = data.poster_path 
    ? `https://image.tmdb.org/t/p/w500${data.poster_path}` 
    : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=500&q=80';

  const backdropPath = data.backdrop_path 
    ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` 
    : posterPath;

  const rating = data.vote_average ? Number(data.vote_average).toFixed(1) : '8.2';

  const seasons = data.seasons ? data.seasons.filter(s => s.season_number > 0).map(s => ({
    season_number: s.season_number,
    name: s.name || `Saison ${s.season_number}`,
    episode_count: s.episode_count || 10,
    poster_path: s.poster_path ? `https://image.tmdb.org/t/p/w300${s.poster_path}` : posterPath
  })) : [];

  return {
    id: `${type[0]}-${tmdbId}`,
    tmdb_id: tmdbId,
    title,
    slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    type,
    synopsis: data.overview || 'Plongez dans cette production captivante en streaming haute définition gratuit VF et VOSTFR sur SpaceFlix.',
    poster_url: posterPath,
    backdrop_url: backdropPath,
    rating,
    release_year: releaseYear,
    duration,
    genres: genres.length > 0 ? genres : ["Cinéma", "HD"],
    languages: ["VF", "VOSTFR", "Multi"],
    trailer_key: trailerKey,
    seasons,
    number_of_seasons: data.number_of_seasons || 1,
    cast: data.credits?.cast?.slice(0, 8).map(c => ({ name: c.name, character: c.character, profile: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null })) || [],
    similar: data.similar?.results?.slice(0, 10).map(formatTMDBItem) || []
  };
}
