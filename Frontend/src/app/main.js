/**
 * Space Flix — Application JavaScript Principale
 * Gère le catalogue, la navigation, le moteur de recherche, le lecteur de streaming vidéo HD,
 * les cartes d'accès rapide, la FAQ et la sauvegarde locale de "Ma Liste" (Favoris).
 */

import { SupabaseService, supabaseClient } from '../lib/supabaseClient.js';
import { TMDBService, getFallbackPoster } from '../lib/tmdbClient.js';
import { GENRES_LIST, INITIAL_MEDIA } from '../lib/data.js';

// État de l'application
const state = {
  currentNav: 'home',
  currentGenre: 'Tous',
  currentSearch: '',
  mediaList: [...INITIAL_MEDIA],
  favorites: [],
  heroMedia: null,
  activeMedia: null,
  activeServerIndex: 0,
  activeSeason: 1,
  activeEpisodeNumber: 1
};

// Sélecteurs DOM
const DOM = {
  navbar: document.getElementById('navbar'),
  announcementBar: document.getElementById('announcement-bar'),
  closeAnnouncementBtn: document.getElementById('close-announcement-btn'),
  searchInput: document.getElementById('search-input'),
  navLinks: document.querySelectorAll('.nav-link'),
  genresBar: document.getElementById('genres-bar'),
  categoryHub: document.getElementById('category-hub'),
  aboutHero: document.getElementById('about-hero'),
  hubSearchCard: document.getElementById('hub-search-card'),
  faqSection: document.getElementById('faq-section'),
  
  // Sections
  heroSection: document.getElementById('hero-section'),
  heroBackdrop: document.getElementById('hero-backdrop'),
  heroTitle: document.getElementById('hero-title'),
  heroSynopsis: document.getElementById('hero-synopsis'),
  heroQuality: document.getElementById('hero-quality'),
  heroLang: document.getElementById('hero-lang'),
  heroPlayBtn: document.getElementById('hero-play-btn'),
  heroFavBtn: document.getElementById('hero-fav-btn'),
  heroFavText: document.getElementById('hero-fav-text'),

  trendingSection: document.getElementById('trending-section'),
  trendingGrid: document.getElementById('trending-grid'),
  moviesSection: document.getElementById('movies-section'),
  moviesGrid: document.getElementById('movies-grid'),
  tvSection: document.getElementById('tv-section'),
  tvGrid: document.getElementById('tv-grid'),
  favoritesSection: document.getElementById('favorites-section'),
  favoritesGrid: document.getElementById('favorites-grid'),

  // Player Modal
  playerModal: document.getElementById('player-modal'),
  closePlayerBtn: document.getElementById('close-player-btn'),
  videoIframe: document.getElementById('video-iframe'),
  serverButtonsContainer: document.getElementById('server-buttons-container'),
  modalTitle: document.getElementById('modal-title'),
  modalYear: document.getElementById('modal-year'),
  modalRating: document.getElementById('modal-rating'),
  modalDuration: document.getElementById('modal-duration'),
  modalGenresTags: document.getElementById('modal-genres-tags'),
  modalSynopsis: document.getElementById('modal-synopsis'),
  modalFavBtn: document.getElementById('modal-fav-btn'),
  modalFavText: document.getElementById('modal-fav-text'),
  seriesEpisodesWrapper: document.getElementById('series-episodes-wrapper'),
  seasonSelect: document.getElementById('season-select'),
  episodesContainer: document.getElementById('episodes-container')
};

// --- AUTH SERVICE (CONNECTÉ 100% SUR SUPABASE AUTH) ---
const AUTH_ERROR_MESSAGES = {
  'Invalid login credentials': 'E-mail ou mot de passe incorrect.',
  'User already registered': 'Un compte existe déjà avec cet e-mail.',
  'Email not confirmed': "Veuillez confirmer votre e-mail avant de vous connecter.",
  'Password should be at least 6 characters': 'Le mot de passe doit contenir au moins 6 caractères.',
  'Unsupported provider: provider is not enabled': "La connexion Google n'est pas encore activée sur ce projet Supabase."
};

function translateAuthError(message) {
  if (!message) return 'Une erreur est survenue.';
  for (const [key, translation] of Object.entries(AUTH_ERROR_MESSAGES)) {
    if (message.includes(key)) return translation;
  }
  return message;
}

const AuthService = {
  currentUser: null,

  toDisplayUser(supabaseUser) {
    if (!supabaseUser) return null;
    const rawName = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email.split('@')[0];
    const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    return {
      id: supabaseUser.id,
      name: displayName,
      email: supabaseUser.email,
      initials: displayName.substring(0, 2).toUpperCase(),
      provider: supabaseUser.app_metadata?.provider || 'email'
    };
  },

  getUser() {
    return this.currentUser;
  },

  async init(onChange) {
    if (supabaseClient) {
      try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        this.currentUser = this.toDisplayUser(user);
      } catch (e) {
        console.warn("User get error:", e);
      }

      supabaseClient.auth.onAuthStateChange(async (event, session) => {
        this.currentUser = this.toDisplayUser(session?.user);
        if (onChange) await onChange(this.currentUser, event);
      });
    }
    return this.currentUser;
  },

  async login(email, password) {
    if (!email || !password) throw new Error('Veuillez remplir tous les champs.');
    if (!supabaseClient) throw new Error('Client Supabase non initialisé.');

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw new Error(translateAuthError(error.message));
    this.currentUser = this.toDisplayUser(data.user);
    return this.currentUser;
  },

  async signup(name, email, password) {
    if (!email || !password) throw new Error('Veuillez remplir tous les champs.');
    if (password.length < 6) throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
    if (!supabaseClient) throw new Error('Client Supabase non initialisé.');

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() }
      }
    });
    if (error) throw new Error(translateAuthError(error.message));
    this.currentUser = this.toDisplayUser(data.user);
    return this.currentUser;
  },

  async loginWithGoogle() {
    if (!supabaseClient) throw new Error('Client Supabase non initialisé.');
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw new Error(translateAuthError(error.message));
    return data;
  },

  async logout() {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    this.currentUser = null;
  }
};

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', async () => {
  initNavbarScroll();
  renderGenresBar();

  // Rendu immédiat des médias locaux avant tout appel réseau
  renderAllSections();
  if (state.mediaList.length > 0) {
    const featured = state.mediaList.find(m => m.is_featured) || state.mediaList[0];
    renderHero(featured);
  }

  // Écoute non-bloquante de la session Supabase Auth
  AuthService.init(async (user) => {
    updateAuthHeaderUI();
    if (user) {
      closeAuthModal();
    }
    state.favorites = await SupabaseService.getFavorites();
    renderAllSections();
  }).catch(err => console.warn("Attention initialisation Auth:", err));

  await loadUserData();
  await refreshCatalog();
  setupEventListeners();
});

// Gère le scroll de la barre de navigation
function initNavbarScroll() {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      if (DOM.navbar) DOM.navbar.classList.add('scrolled');
    } else {
      if (DOM.navbar) DOM.navbar.classList.remove('scrolled');
    }
  });
}

// Rend la barre de filtres par genre (Pill Badges)
function renderGenresBar() {
  if (!DOM.genresBar) return;
  DOM.genresBar.innerHTML = GENRES_LIST.map(genre => `
    <button class="genre-btn ${genre === state.currentGenre ? 'active' : ''}" data-genre="${genre}">
      ${genre}
    </button>
  `).join('');

  DOM.genresBar.querySelectorAll('.genre-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const selectedGenre = e.currentTarget.getAttribute('data-genre');
      state.currentGenre = selectedGenre;
      renderGenresBar();
      await refreshCatalog();
    });
  });
}

// Charge la liste des favoris de l'utilisateur (Local Storage / Supabase)
async function loadUserData() {
  state.favorites = await SupabaseService.getFavorites();
}

// Recharge et filtre le catalogue selon l'état actuel (Supabase + TMDB API)
async function refreshCatalog() {
  try {
    // 1. Rendu d'urgence immédiat pour garantir qu'aucun écran noir n'apparaît
    let list = [...INITIAL_MEDIA];
    state.mediaList = list;
    renderAllSections();
    const initialFeatured = list.find(m => m.is_featured) || list[0];
    if (initialFeatured) {
      renderHero(initialFeatured);
    }

    // 2. Récupération dynamique depuis Supabase si configuré
    const dbList = await SupabaseService.getMediaList({
      search: state.currentSearch,
      genre: state.currentGenre
    });

    if (dbList && dbList.length > 0) {
      const existingIds = new Set(list.map(m => m.id));
      const newItems = dbList.filter(m => !existingIds.has(m.id));
      list = [...list, ...newItems];
    }

    // 3. Si recherche active, interroger l'API TMDB
    if (state.currentSearch) {
      try {
        const tmdbResults = await TMDBService.searchMedia(state.currentSearch);
        if (tmdbResults && tmdbResults.length > 0) {
          const existingIds = new Set(list.map(m => m.id));
          const newItems = tmdbResults.filter(m => !existingIds.has(m.id));
          list = [...list, ...newItems];
        }
      } catch (e) {
        console.warn("Recherche TMDB non disponible:", e);
      }
    } else if (state.currentGenre && state.currentGenre !== 'Tous') {
      // Si un genre spécifique est sélectionné (Action, Sci-Fi, Comédie, etc.)
      try {
        const genreMedia = await TMDBService.getMediaByGenre(state.currentGenre);
        if (genreMedia && genreMedia.length > 0) {
          const existingIds = new Set(list.map(m => m.id));
          const newItems = genreMedia.filter(m => !existingIds.has(m.id));
          list = [...list, ...newItems];
        }
      } catch (e) {
        console.warn(`Erreur TMDB genre ${state.currentGenre}:`, e);
      }
    } else {
      // Mode Accueil (Tous) : charger les films populaires, séries populaires et tendances de TMDB sans bloquer
      try {
        const results = await Promise.allSettled([
          TMDBService.getTrending('all', 'week'),
          TMDBService.getPopularMovies(1),
          TMDBService.getPopularTVShows(1)
        ]);
        const tmdbCombined = results
          .filter(r => r.status === 'fulfilled' && Array.isArray(r.value))
          .flatMap(r => r.value);

        if (tmdbCombined.length > 0) {
          const existingIds = new Set(list.map(m => m.id));
          const newItems = tmdbCombined.filter(m => !existingIds.has(m.id));
          list = [...list, ...newItems];
        }
      } catch (e) {
        console.warn("Tendances TMDB non disponibles:", e);
      }
    }

    state.mediaList = list;

    const featured = state.mediaList.find(m => m.is_featured) || state.mediaList[0];
    if (featured) {
      renderHero(featured);
    }

    renderAllSections();
  } catch (err) {
    console.error("Erreur lors de l'actualisation du catalogue:", err);
  }
}

// Global window image error handler for cards
window.handleCardImageError = function(imgEl, title, year) {
  imgEl.onerror = null;
  imgEl.src = getFallbackPoster(title, year);
};

// Rend la bannière Hero (Compatible API & TMDB)
async function renderHero(media) {
  if (!media) return;
  state.heroMedia = media;
  
  // Dynamic Image URL resolver (TMDB or direct URL)
  const getImageUrl = (path, size = 'w1280') => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
    return `https://image.tmdb.org/t/p/${size}${path}`;
  };

  const titleVal = media.title || media.name || 'Dune: Deuxième Partie';
  const yearVal = media.release_year || '2024';

  const backdropSrc = getImageUrl(media.backdrop_url || media.backdrop_path || media.poster_url || media.poster_path, 'w1280') || 'https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fKSuV0vqv.jpg';
  const posterSrc = getImageUrl(media.poster_url || media.poster_path || media.backdrop_url || media.backdrop_path, 'w500') || getFallbackPoster(titleVal, yearVal);

  if (DOM.heroBackdrop) {
    DOM.heroBackdrop.style.display = 'block';
    DOM.heroBackdrop.onerror = () => {
      DOM.heroBackdrop.onerror = null;
      DOM.heroBackdrop.src = 'https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fKSuV0vqv.jpg';
    };
    DOM.heroBackdrop.src = backdropSrc;
  }

  const heroPosterEl = document.getElementById('hero-poster');
  const heroPosterWrapper = document.getElementById('hero-poster-wrapper');
  if (heroPosterEl) {
    heroPosterEl.onerror = () => {
      heroPosterEl.onerror = null;
      heroPosterEl.src = getFallbackPoster(titleVal, yearVal);
    };
    heroPosterEl.src = posterSrc;
    if (heroPosterWrapper) heroPosterWrapper.style.display = 'flex';
  }

  if (DOM.heroTitle) DOM.heroTitle.textContent = titleVal;
  if (DOM.heroSynopsis) DOM.heroSynopsis.textContent = media.synopsis || media.overview || 'Aucun synopsis disponible.';
  if (DOM.heroQuality) DOM.heroQuality.textContent = '4K UHD';
  if (DOM.heroLang) DOM.heroLang.textContent = (media.languages || ['VF', 'VOSTFR']).join(' • ');

  const ratingEl = document.getElementById('hero-rating');
  const yearEl = document.getElementById('hero-year');
  const typeEl = document.getElementById('hero-type');
  const genresEl = document.getElementById('hero-genres');

  if (ratingEl) ratingEl.innerHTML = `<i class="fa-solid fa-star" style="color:#ffc107;"></i> ${media.rating || '8.5'}`;
  if (yearEl) yearEl.textContent = yearVal;
  if (typeEl) typeEl.textContent = media.type === 'movie' ? 'FILM' : 'SÉRIE';
  if (genresEl) genresEl.textContent = (media.genres || ['Action', 'Sci-Fi']).join(' • ');

  updateHeroFavButtonState(media.id);
}

// Rend toutes les sections du catalogue selon le filtre actif
function renderAllSections() {
  const latestList = [...state.mediaList].sort((a, b) => b.release_year - a.release_year);
  const trendingList = state.mediaList.filter(m => m.is_trending);
  const displayTrending = trendingList.length > 0 ? trendingList : state.mediaList.slice(0, 10);
  const moviesList = state.mediaList.filter(m => m.type === 'movie' || m.type === 'film');
  const displayMovies = moviesList.length > 0 ? moviesList : state.mediaList.filter(m => m.type !== 'tv');
  const tvList = state.mediaList.filter(m => m.type === 'tv' || m.type === 'series');
  const displayTV = tvList.length > 0 ? tvList : state.mediaList.filter(m => m.type === 'tv');

  const latestSection = document.getElementById('latest-section');
  const latestGrid = document.getElementById('latest-grid');

  if (state.currentNav === 'favorites') {
    if (DOM.heroSection && DOM.heroSection.parentElement) DOM.heroSection.parentElement.style.display = 'none';
    if (DOM.aboutHero) DOM.aboutHero.style.display = 'none';
    if (latestSection) latestSection.style.display = 'none';
    if (DOM.genresBar && DOM.genresBar.parentElement) DOM.genresBar.parentElement.style.display = 'none';
    if (DOM.trendingSection) DOM.trendingSection.style.display = 'none';
    if (DOM.moviesSection) DOM.moviesSection.style.display = 'none';
    if (DOM.tvSection) DOM.tvSection.style.display = 'none';
    if (DOM.faqSection) DOM.faqSection.style.display = 'none';
    if (DOM.favoritesSection) DOM.favoritesSection.style.display = 'block';

    renderMediaGrid(DOM.favoritesGrid, state.favorites);
    return;
  }

  if (DOM.heroSection && DOM.heroSection.parentElement) DOM.heroSection.parentElement.style.display = 'block';
  if (DOM.aboutHero) DOM.aboutHero.style.display = 'block';
  if (latestSection) latestSection.style.display = 'block';
  if (DOM.genresBar && DOM.genresBar.parentElement) DOM.genresBar.parentElement.style.display = 'block';
  if (DOM.favoritesSection) DOM.favoritesSection.style.display = 'none';
  if (DOM.faqSection) DOM.faqSection.style.display = 'block';

  if (latestGrid) renderMediaGrid(latestGrid, latestList.slice(0, 7));

  if (state.currentNav === 'movies') {
    if (DOM.trendingSection) DOM.trendingSection.style.display = 'none';
    if (latestSection) latestSection.style.display = 'none';
    if (DOM.moviesSection) DOM.moviesSection.style.display = 'block';
    if (DOM.tvSection) DOM.tvSection.style.display = 'none';
    renderMediaGrid(DOM.moviesGrid, displayMovies);
  } else if (state.currentNav === 'tv') {
    if (DOM.trendingSection) DOM.trendingSection.style.display = 'none';
    if (latestSection) latestSection.style.display = 'none';
    if (DOM.moviesSection) DOM.moviesSection.style.display = 'none';
    if (DOM.tvSection) DOM.tvSection.style.display = 'block';
    renderMediaGrid(DOM.tvGrid, displayTV);
  } else if (state.currentNav === 'trending') {
    if (DOM.trendingSection) DOM.trendingSection.style.display = 'block';
    if (latestSection) latestSection.style.display = 'none';
    if (DOM.moviesSection) DOM.moviesSection.style.display = 'none';
    if (DOM.tvSection) DOM.tvSection.style.display = 'none';
    renderMediaGrid(DOM.trendingGrid, displayTrending);
  } else {
    // Mode Accueil (Découvrir)
    if (DOM.trendingSection) DOM.trendingSection.style.display = 'block';
    if (DOM.moviesSection) DOM.moviesSection.style.display = 'block';
    if (DOM.tvSection) DOM.tvSection.style.display = 'block';

    renderMediaGrid(DOM.trendingGrid, displayTrending);
    renderMediaGrid(DOM.moviesGrid, displayMovies);
    renderMediaGrid(DOM.tvGrid, displayTV);
  }
}

// Rend une grille de cartes de médias (HANDYFLIX EXACT MATCH)
function renderMediaGrid(containerEl, list) {
  if (!containerEl) return;
  if (!list || list.length === 0) {
    containerEl.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: #7f7f7f;">
        <i class="fa-solid fa-film" style="font-size: 2.5rem; margin-bottom: 0.8rem; opacity: 0.4;"></i>
        <p>Aucun titre trouvé dans cette catégorie.</p>
      </div>
    `;
    return;
  }

  containerEl.innerHTML = list.map(media => {
    const title = (media.title || 'Titre').replace(/"/g, '&quot;');
    const year = media.release_year || '2026';
    
    let posterSrc = media.poster_url;
    if (!posterSrc || posterSrc.includes('/null') || posterSrc.includes('via.placeholder.com')) {
      posterSrc = getFallbackPoster(title, year);
    }

    return `
    <div class="handy-media-card" data-id="${media.id}">
      <div class="handy-poster-wrap">
        <img src="${posterSrc}" alt="${title}" class="handy-poster" loading="lazy" onerror="window.handleCardImageError(this, '${title}', '${year}')">
      </div>
      <div class="handy-card-details">
        <h4 class="handy-card-title">${title}</h4>
        <div class="handy-card-sub">
          <span>${year}</span>
          <span class="handy-star"><i class="fa-solid fa-star"></i> ${media.rating || '8.0'}</span>
          <span class="handy-type">${media.type === 'movie' ? 'FILM' : 'SÉRIE'}</span>
        </div>
      </div>
    </div>
    `;
  }).join('');

  containerEl.querySelectorAll('.handy-media-card').forEach(card => {
    card.addEventListener('click', async () => {
      const mediaId = card.getAttribute('data-id');
      let media = state.mediaList.find(m => String(m.id) === String(mediaId));
      if (!media) {
        media = await SupabaseService.getMediaById(mediaId);
      }
      if (media) {
        openPlayerModal(media);
      }
    });
  });
}

// --- STREAM PLAYER MODAL LOGIC ---
async function openPlayerModal(media, episodeNumber = 1) {
  state.activeMedia = media;
  state.activeServerIndex = 0;
  state.activeSeason = 1;
  state.activeEpisodeNumber = episodeNumber;

  DOM.modalTitle.textContent = media.title;
  DOM.modalYear.textContent = media.release_year;
  DOM.modalRating.innerHTML = `<i class="fa-solid fa-star"></i> ${media.rating || '8.0'}`;
  DOM.modalDuration.textContent = media.duration || '';
  DOM.modalSynopsis.textContent = media.synopsis;

  DOM.modalGenresTags.innerHTML = (media.genres || []).map(g => `
    <span class="badge badge-lang" style="font-size: 0.7rem;">${g}</span>
  `).join('');

  const isFav = await SupabaseService.isFavorite(media.id);
  updateFavButtonUI(DOM.modalFavBtn, DOM.modalFavText, isFav);

  // Configuration du lecteur pour les séries vs films
  if (media.type === 'tv' && media.seasons && media.seasons.length > 0) {
    DOM.seriesEpisodesWrapper.style.display = 'block';
    setupSeriesSelector(media);
  } else {
    DOM.seriesEpisodesWrapper.style.display = 'none';
    setupVideoServers(media.video_servers || []);
  }

  DOM.playerModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function setupVideoServers(servers) {
  if (!servers || servers.length === 0) {
    servers = [{ name: "Serveur HD 1 (VF)", url: `https://vidsrc.to/embed/${state.activeMedia.type}/${state.activeMedia.id}`, lang: "VF" }];
  }

  DOM.serverButtonsContainer.innerHTML = servers.map((srv, idx) => `
    <button class="server-btn ${idx === state.activeServerIndex ? 'active' : ''}" data-idx="${idx}">
      <i class="fa-solid fa-play" style="font-size: 0.75rem; margin-right: 4px;"></i> ${srv.name} (${srv.lang || 'VF'})
    </button>
  `).join('');

  DOM.serverButtonsContainer.querySelectorAll('.server-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
      state.activeServerIndex = idx;
      setupVideoServers(servers);
      loadVideoIframe(servers[idx].url);
    });
  });

  loadVideoIframe(servers[state.activeServerIndex]?.url || servers[0].url);
}

function loadVideoIframe(url) {
  if (url) {
    DOM.videoIframe.src = url;
  }
}

function setupSeriesSelector(media) {
  DOM.seasonSelect.innerHTML = media.seasons.map(s => `
    <option value="${s.season_number}">Saison ${s.season_number}</option>
  `).join('');

  DOM.seasonSelect.value = state.activeSeason;
  DOM.seasonSelect.onchange = (e) => {
    state.activeSeason = parseInt(e.target.value);
    renderEpisodes(media);
  };

  renderEpisodes(media);
}

function renderEpisodes(media) {
  const seasonData = media.seasons.find(s => s.season_number === state.activeSeason) || media.seasons[0];
  const episodes = seasonData ? seasonData.episodes : [];

  DOM.episodesContainer.innerHTML = episodes.map(ep => `
    <div class="episode-card ${ep.episode_number === state.activeEpisodeNumber ? 'active' : ''}" data-ep="${ep.episode_number}">
      <div style="font-weight: 700; font-size: 0.9rem; color: var(--primary); margin-bottom: 0.2rem;">
        Épisode ${ep.episode_number}
      </div>
      <div style="font-size: 0.85rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${ep.title}
      </div>
    </div>
  `).join('');

  DOM.episodesContainer.querySelectorAll('.episode-card').forEach(card => {
    card.addEventListener('click', () => {
      const epNum = parseInt(card.getAttribute('data-ep'));
      state.activeEpisodeNumber = epNum;
      const selectedEp = episodes.find(e => e.episode_number === epNum);
      if (selectedEp && selectedEp.video_servers) {
        setupVideoServers(selectedEp.video_servers);
      } else {
        setupVideoServers([{ name: `Épisode ${epNum} VF`, url: `https://vidsrc.to/embed/tv/${media.id}/${state.activeSeason}/${epNum}` }]);
      }
      renderEpisodes(media);
    });
  });

  const activeEp = episodes.find(e => e.episode_number === state.activeEpisodeNumber) || episodes[0];
  if (activeEp) {
    setupVideoServers(activeEp.video_servers);
  }
}

function closePlayerModal() {
  DOM.playerModal.classList.remove('active');
  DOM.videoIframe.src = '';
  document.body.style.overflow = 'auto';
}

// MISE À JOUR BOUTON FAVORIS
function updateFavButtonUI(btnEl, textEl, isFav) {
  if (!btnEl) return;
  if (isFav) {
    btnEl.classList.add('active');
    btnEl.style.borderColor = 'var(--primary)';
    if (textEl) textEl.textContent = 'Dans Ma Liste';
    const icon = btnEl.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-check';
  } else {
    btnEl.classList.remove('active');
    if (textEl) textEl.textContent = 'Ajouter à Ma Liste';
    const icon = btnEl.querySelector('i');
    if (icon) icon.className = 'fa-regular fa-plus';
  }
}

// --- SETUP EVENT LISTENERS ---
function setupEventListeners() {
  // Navigation links
  DOM.navLinks.forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      DOM.navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      state.currentNav = link.getAttribute('data-nav');
      if (state.currentNav === 'favorites') {
        state.favorites = await SupabaseService.getFavorites();
      }
      renderAllSections();
    });
  });

  document.querySelectorAll('[data-nav]').forEach(el => {
    if (!el.classList.contains('nav-link')) {
      el.addEventListener('click', async (e) => {
        e.preventDefault();
        const targetNav = el.getAttribute('data-nav');
        state.currentNav = targetNav;
        const matchedLink = Array.from(DOM.navLinks).find(l => l.getAttribute('data-nav') === targetNav);
        if (matchedLink) {
          DOM.navLinks.forEach(l => l.classList.remove('active'));
          matchedLink.classList.add('active');
        }
        if (state.currentNav === 'favorites') {
          state.favorites = await SupabaseService.getFavorites();
        }
        renderAllSections();
      });
    }
  });

  // Hub Card Search Focus
  if (DOM.hubSearchCard) {
    DOM.hubSearchCard.addEventListener('click', () => {
      DOM.searchInput.focus();
      DOM.searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // Announcement Bar Close
  if (DOM.closeAnnouncementBtn && DOM.announcementBar) {
    DOM.closeAnnouncementBtn.addEventListener('click', () => {
      DOM.announcementBar.classList.add('hidden');
      const heroContainer = document.querySelector('.hero-container-outer');
      if (heroContainer) heroContainer.style.marginTop = '85px';
    });
  }

  // Search input
  DOM.searchInput.addEventListener('input', (e) => {
    state.currentSearch = e.target.value.trim();
    refreshCatalog();
  });

  // Hero Actions
  DOM.heroPlayBtn.addEventListener('click', () => {
    if (state.heroMedia) openPlayerModal(state.heroMedia);
  });

  DOM.heroFavBtn.addEventListener('click', async () => {
    if (state.heroMedia) {
      const isFav = await SupabaseService.toggleFavorite(state.heroMedia.id);
      updateFavButtonUI(DOM.heroFavBtn, DOM.heroFavText, isFav);
      state.favorites = await SupabaseService.getFavorites();
    }
  });

  // Modal Fav Action
  DOM.modalFavBtn.addEventListener('click', async () => {
    if (state.activeMedia) {
      const isFav = await SupabaseService.toggleFavorite(state.activeMedia.id);
      updateFavButtonUI(DOM.modalFavBtn, DOM.modalFavText, isFav);
      state.favorites = await SupabaseService.getFavorites();
    }
  });

  // Close player modal
  DOM.closePlayerBtn.addEventListener('click', closePlayerModal);
  DOM.playerModal.addEventListener('click', (e) => {
    if (e.target === DOM.playerModal) closePlayerModal();
  });



function updateAuthHeaderUI() {
  const user = AuthService.getUser();
  const headerAvatar = document.getElementById('header-user-avatar');
  const dropdownAvatar = document.getElementById('dropdown-user-avatar');
  const dropdownName = document.getElementById('dropdown-user-name');
  const dropdownEmail = document.getElementById('dropdown-user-email');
  const dropdownLogoutBtn = document.getElementById('dropdown-logout-btn');
  const dropdownLogoutDivider = document.getElementById('dropdown-logout-divider');
  const dropdownActionLabel = document.getElementById('dropdown-action-label');

  if (user) {
    if (headerAvatar) headerAvatar.textContent = user.initials;
    if (dropdownAvatar) dropdownAvatar.textContent = user.initials;
    if (dropdownName) dropdownName.textContent = user.name;
    if (dropdownEmail) dropdownEmail.textContent = user.email;
    if (dropdownActionLabel) dropdownActionLabel.textContent = 'Mon Compte';
    if (dropdownLogoutBtn) dropdownLogoutBtn.style.display = 'flex';
    if (dropdownLogoutDivider) dropdownLogoutDivider.style.display = 'block';
  } else {
    if (headerAvatar) headerAvatar.textContent = 'SF';
    if (dropdownAvatar) dropdownAvatar.textContent = 'SF';
    if (dropdownName) dropdownName.textContent = 'Invité';
    if (dropdownEmail) dropdownEmail.textContent = 'Non connecté';
    if (dropdownActionLabel) dropdownActionLabel.textContent = "Se connecter / S'inscrire";
    if (dropdownLogoutBtn) dropdownLogoutBtn.style.display = 'none';
    if (dropdownLogoutDivider) dropdownLogoutDivider.style.display = 'none';
  }
}

  // Header Scroll Effect (Netflix style)
  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      DOM.navbar.classList.add('scrolled');
    } else {
      DOM.navbar.classList.remove('scrolled');
    }
  });

  // --- AUTH MODAL & PROFILE DROPDOWN LOGIC ---
  const authModal = document.getElementById('auth-modal');
  const closeAuthBtn = document.getElementById('close-auth-btn');
  const profileBtn = document.getElementById('profile-btn');
  const profileDropdown = document.getElementById('profile-dropdown');
  const tabLoginBtn = document.getElementById('tab-login-btn');
  const tabSignupBtn = document.getElementById('tab-signup-btn');
  const nameFieldGroup = document.getElementById('name-field-group');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authModalTitle = document.getElementById('auth-modal-title');
  const authModalSubtitle = document.getElementById('auth-modal-subtitle');
  const googleLoginBtn = document.getElementById('google-login-btn');
  const authForm = document.getElementById('auth-form');
  const authErrorMsg = document.getElementById('auth-error-msg');
  const togglePwdBtn = document.getElementById('toggle-pwd-btn');
  const authPwdInput = document.getElementById('auth-password');
  const dropdownLoginTrigger = document.getElementById('dropdown-login-trigger');
  const dropdownLogoutBtn = document.getElementById('dropdown-logout-btn');

  let currentAuthMode = 'login'; // 'login' | 'signup'

  function openAuthModal(mode = 'login') {
    currentAuthMode = mode;
    if (authErrorMsg) authErrorMsg.classList.add('hidden');
    if (mode === 'login') {
      tabLoginBtn.classList.add('active');
      tabSignupBtn.classList.remove('active');
      nameFieldGroup.style.display = 'none';
      authSubmitBtn.textContent = 'Se connecter';
      authModalTitle.textContent = 'Espace Membre SpaceFlix';
      authModalSubtitle.textContent = 'Connectez-vous pour synchroniser vos favoris et vos préférences.';
    } else {
      tabSignupBtn.classList.add('active');
      tabLoginBtn.classList.remove('active');
      nameFieldGroup.style.display = 'flex';
      authSubmitBtn.textContent = "Créer mon compte";
      authModalTitle.textContent = 'Créer un compte SpaceFlix';
      authModalSubtitle.textContent = 'Rejoignez la communauté et profitez de vos contenus partout.';
    }
    if (authModal) authModal.classList.remove('hidden');
    if (profileDropdown) profileDropdown.classList.add('hidden');
  }

  function closeAuthModal() {
    if (authModal) authModal.classList.add('hidden');
  }

  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!AuthService.getUser()) {
        openAuthModal('login');
      } else {
        if (profileDropdown) profileDropdown.classList.toggle('hidden');
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (profileDropdown && !profileDropdown.contains(e.target) && e.target !== profileBtn) {
      profileDropdown.classList.add('hidden');
    }
  });

  if (dropdownLoginTrigger) {
    dropdownLoginTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal('login');
    });
  }

  if (dropdownLogoutBtn) {
    dropdownLogoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await AuthService.logout();
      updateAuthHeaderUI();
      state.favorites = await SupabaseService.getFavorites();
      renderAllSections();
      if (profileDropdown) profileDropdown.classList.add('hidden');
    });
  }

  if (closeAuthBtn) closeAuthBtn.addEventListener('click', closeAuthModal);
  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) closeAuthModal();
    });
  }

  if (tabLoginBtn) tabLoginBtn.addEventListener('click', () => openAuthModal('login'));
  if (tabSignupBtn) tabSignupBtn.addEventListener('click', () => openAuthModal('signup'));

  if (togglePwdBtn && authPwdInput) {
    togglePwdBtn.addEventListener('click', () => {
      const isPwd = authPwdInput.type === 'password';
      authPwdInput.type = isPwd ? 'text' : 'password';
      togglePwdBtn.innerHTML = isPwd ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
    });
  }

  // Connexion Google OAuth (nécessite que le fournisseur Google soit activé dans Supabase > Authentication > Providers)
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
      try {
        if (authErrorMsg) authErrorMsg.classList.add('hidden');
        await AuthService.loginWithGoogle();
      } catch (err) {
        if (authErrorMsg) {
          authErrorMsg.textContent = err.message || 'Une erreur est survenue.';
          authErrorMsg.classList.remove('hidden');
        }
      }
    });
  }

  // Soumission du Formulaire (E-mail / Password) - branché sur Supabase Auth
  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      const name = document.getElementById('auth-name').value;

      const originalBtnText = authSubmitBtn ? authSubmitBtn.textContent : '';
      try {
        if (authErrorMsg) authErrorMsg.classList.add('hidden');
        if (authSubmitBtn) {
          authSubmitBtn.disabled = true;
          authSubmitBtn.textContent = 'Patientez...';
        }

        if (currentAuthMode === 'login') {
          await AuthService.login(email, password);
        } else {
          await AuthService.signup(name, email, password);
        }

        updateAuthHeaderUI();
        state.favorites = await SupabaseService.getFavorites();
        renderAllSections();
        closeAuthModal();
        authForm.reset();
      } catch (err) {
        if (authErrorMsg) {
          authErrorMsg.textContent = err.message || 'Une erreur est survenue.';
          authErrorMsg.classList.remove('hidden');
        }
      } finally {
        if (authSubmitBtn) {
          authSubmitBtn.disabled = false;
          authSubmitBtn.textContent = originalBtnText;
        }
      }
    });
  }

  // Initialisation UI Auth au démarrage
  updateAuthHeaderUI();

  // --- INFO & LEGAL MODAL LOGIC (À PROPOS, CONFIDENTIALITÉ, CONDITIONS) ---
  const infoModal = document.getElementById('info-modal');
  const closeInfoModalBtn = document.getElementById('close-info-modal-btn');
  const infoModalTitle = document.getElementById('info-modal-title');
  const infoModalBody = document.getElementById('info-modal-body');
  const infoTabAbout = document.getElementById('info-tab-about');
  const infoTabPrivacy = document.getElementById('info-tab-privacy');
  const infoTabTerms = document.getElementById('info-tab-terms');

  const infoContents = {
    about: `
      <div class="about-dev-box">
        <div class="dev-avatar-badge">S</div>
        <div class="dev-bio">
          <h3>Développé avec passion par <span class="highlight-gold">Space</span></h3>
          <p>SpaceFlix est une plateforme de streaming moderne, fluide et ultra-épurée conçue pour offrir la meilleure expérience vidéo sans pub ni inscription obligatoire.</p>
        </div>
      </div>

      <h4 class="info-subtitle"><i class="fa-solid fa-address-card"></i> Coordonnées & Contacts Officiels</h4>
      <div class="contact-cards-grid">
        <a href="https://wa.me/50946966290" target="_blank" class="contact-card whatsapp">
          <div class="contact-icon"><i class="fa-brands fa-whatsapp"></i></div>
          <div class="contact-info">
            <span class="contact-label">WhatsApp Direct</span>
            <span class="contact-value">+509 4696 6290</span>
          </div>
        </a>

        <a href="mailto:ogspacetech@gmail.com" class="contact-card email">
          <div class="contact-icon"><i class="fa-regular fa-envelope"></i></div>
          <div class="contact-info">
            <span class="contact-label">Support E-mail</span>
            <span class="contact-value">ogspacetech@gmail.com</span>
          </div>
        </a>

        <a href="https://github.com/Christian667z" target="_blank" class="contact-card github">
          <div class="contact-icon"><i class="fa-brands fa-github"></i></div>
          <div class="contact-info">
            <span class="contact-label">GitHub Officiel</span>
            <span class="contact-value">Christian667z</span>
          </div>
        </a>
      </div>
    `,
    privacy: `
      <h4 class="info-subtitle"><i class="fa-solid fa-user-shield"></i> Protection de vos Données Personnelles</h4>
      <p class="info-text">Chez SpaceFlix, le respect de la vie privée est une priorité. Voici notre engagement :</p>

      <ul class="info-list">
        <li><strong>Stockage Local Réseau :</strong> Vos favoris ("Ma liste") et vos sessions de compte sont conservés localement sur votre appareil (LocalStorage).</li>
        <li><strong>Zéro Revente de Données :</strong> Nous ne collectons et ne revendons aucune donnée personnelle à des tiers ou régies publicitaires.</li>
        <li><strong>Connexion Google :</strong> Les données récupérées via l'authentification Google (Nom & E-mail) servent exclusivement à vous identifier sur l'interface.</li>
      </ul>

      <p class="info-footer-note">Pour toute question sur la gestion de vos données, contactez le développeur Space à <a href="mailto:ogspacetech@gmail.com">ogspacetech@gmail.com</a>.</p>
    `,
    terms: `
      <h4 class="info-subtitle"><i class="fa-solid fa-file-contract"></i> Conditions Générales d'Utilisation</h4>
      <p class="info-text">En naviguant sur SpaceFlix, vous acceptez les règles suivantes :</p>

      <ul class="info-list">
        <li><strong>Avertissement sur les Contenus :</strong> SpaceFlix n'héberge et ne stocke aucun fichier vidéo sur ses serveurs. Le contenu est agrégé et diffusé à travers des lecteurs tiers publics.</li>
        <li><strong>Accès Libre et Gratuit :</strong> La plateforme est totalement gratuite. Aucun frais ni abonnement ne sera jamais facturé.</li>
        <li><strong>Propriété Intellectuelle :</strong> Le design de l'interface et le nom SpaceFlix sont créés par <strong>Space</strong>.</li>
      </ul>

      <p class="info-footer-note">Pour toute demande d'information ou assistance technique, contactez Space sur WhatsApp au <a href="https://wa.me/50946966290" target="_blank">+509 4696 6290</a> ou par e-mail à <a href="mailto:ogspacetech@gmail.com">ogspacetech@gmail.com</a>.</p>
    `
  };

  function openInfoModal(tab = 'about') {
    if (!infoModal) return;
    [infoTabAbout, infoTabPrivacy, infoTabTerms].forEach(t => t && t.classList.remove('active'));

    if (tab === 'about') {
      if (infoTabAbout) infoTabAbout.classList.add('active');
      if (infoModalTitle) infoModalTitle.textContent = 'À Propos de Space';
      if (infoModalBody) infoModalBody.innerHTML = infoContents.about;
    } else if (tab === 'privacy') {
      if (infoTabPrivacy) infoTabPrivacy.classList.add('active');
      if (infoModalTitle) infoModalTitle.textContent = 'Politique de Confidentialité';
      if (infoModalBody) infoModalBody.innerHTML = infoContents.privacy;
    } else if (tab === 'terms') {
      if (infoTabTerms) infoTabTerms.classList.add('active');
      if (infoModalTitle) infoModalTitle.textContent = "Conditions d'Utilisation";
      if (infoModalBody) infoModalBody.innerHTML = infoContents.terms;
    }

    infoModal.classList.remove('hidden');
    if (profileDropdown) profileDropdown.classList.add('hidden');
  }

  function closeInfoModal() {
    if (infoModal) infoModal.classList.add('hidden');
  }

  if (closeInfoModalBtn) closeInfoModalBtn.addEventListener('click', closeInfoModal);
  if (infoModal) {
    infoModal.addEventListener('click', (e) => {
      if (e.target === infoModal) closeInfoModal();
    });
  }

  if (infoTabAbout) infoTabAbout.addEventListener('click', () => openInfoModal('about'));
  if (infoTabPrivacy) infoTabPrivacy.addEventListener('click', () => openInfoModal('privacy'));
  if (infoTabTerms) infoTabTerms.addEventListener('click', () => openInfoModal('terms'));

  // Note: Legal links (Confidentialité, Conditions, À propos) navigate directly to dedicated full HTML pages (Confidentialité.html, Conditions.html, a_propos.html)
}
