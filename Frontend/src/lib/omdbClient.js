/**
 * SpaceFlix - Client OMDb API
 * Permet de récupérer les notes Rotten Tomatoes, IMDb, Metacritic, récompenses et réalisateurs
 */

const OMDB_PROXY_BASE = '/api/omdb';

/**
 * Récupérer les données OMDb pour un titre ou identifiant IMDb
 * @param {Object} options - { title, imdb_id, year, type }
 */
export async function fetchOmdbDetails(options = {}) {
  try {
    const params = new URLSearchParams();
    if (options.imdb_id) params.set('i', options.imdb_id);
    else if (options.title) params.set('t', options.title);
    else return null;

    if (options.year) params.set('y', options.year);
    if (options.type) params.set('type', options.type);

    const res = await fetch(`${OMDB_PROXY_BASE}?${params.toString()}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.Response === 'True') {
      return data;
    }
    return null;
  } catch (err) {
    console.warn('OMDb client error:', err.message);
    return null;
  }
}

/**
 * Recherche générale OMDb
 */
export async function searchOmdb(query, page = 1) {
  try {
    const params = new URLSearchParams({ s: query, page });
    const res = await fetch(`${OMDB_PROXY_BASE}/search?${params.toString()}`);
    if (!res.ok) return { Response: 'False', Search: [] };
    return await res.json();
  } catch (err) {
    console.warn('OMDb search error:', err.message);
    return { Response: 'False', Search: [] };
  }
}

export const OMDb = {
  fetchOmdbDetails,
  searchOmdb
};

if (typeof window !== 'undefined') {
  window.SpaceFlixOmdb = OMDb;
}
