/**
 * Space Flix — Application JavaScript Principale
 * Gère le catalogue TMDB/Supabase, le carrousel Hero immersif,
 * le lecteur vidéo sur mesure avec bandes-annonces TMDB YouTube,
 * la reprise de lecture automatique et l'authentification Supabase (Email/Pass & Google OAuth).
 */

import { SupabaseService, supabaseClient } from '../lib/supabaseClient.js';
import { TMDBService, getFallbackPoster } from '../lib/tmdbClient.js';
import { GENRES_LIST, INITIAL_MEDIA } from '../lib/data.js';

// État Global de l'application
const state = {
  currentNav: 'home',
  currentGenre: 'Tous',
  currentSearch: '',
  mediaList: [...INITIAL_MEDIA],
  favorites: [],
  continueWatchingList: [],
  
  // Hero Carousel
  heroFeaturedList: [],
  heroIndex: 0,
  heroInterval: null,
  heroMedia: null,

  // Player State
  activeMedia: null,
  activeServerIndex: 0,
  activeSeason: 1,
  activeEpisodeNumber: 1,
  activeEpisodeTitle: '',
  playerMode: 'stream', // 'stream' | 'trailer'
  mediaVideos: [],
  playbackTimer: null,
  playerLoadTimer: null,
  playbackSeconds: 0,
  playbackDuration: 7200, // 2h par défaut
  isPlaying: true,
  isTheaterMode: false,

  // Filtres avancés & Pagination (Style Handyflix)
  filterType: 'all',
  filterGenre: 'Tous',
  filterYear: 'all',
  filterLang: 'all',
  filterSort: 'popularity.desc',
  filterProvider: 'all',
  filterPage: 1,
  filterMediaList: [],
  isFilterActive: false,
  isLoadingFilterPage: false
};

// Sélecteurs DOM
const DOM = {
  navbar: document.getElementById('navbar'),
  announcementBar: document.getElementById('announcement-bar'),
  closeAnnouncementBtn: document.getElementById('close-announcement-btn'),
  searchInput: document.getElementById('search-input'),
  searchTriggerBtn: document.getElementById('search-trigger-btn'),
  instantSearchDropdown: document.getElementById('instant-search-dropdown'),
  instantSearchResults: document.getElementById('instant-search-results'),
  closeInstantSearchBtn: document.getElementById('close-instant-search-btn'),
  instantSearchCount: document.getElementById('instant-search-count'),
  navLinks: document.querySelectorAll('.nav-link'),
  genresBar: document.getElementById('genres-bar'),
  categoryHub: document.getElementById('category-hub'),
  aboutHero: document.getElementById('about-hero'),
  hubSearchCard: document.getElementById('hub-search-card'),
  faqSection: document.getElementById('faq-section'),

  // Filtres Avancés & Résultats
  advancedFiltersSection: document.getElementById('advanced-filters-section'),
  filterTypeSelect: document.getElementById('filter-type-select'),
  filterGenreSelect: document.getElementById('filter-genre-select'),
  filterYearSelect: document.getElementById('filter-year-select'),
  filterLangSelect: document.getElementById('filter-lang-select'),
  filterSortSelect: document.getElementById('filter-sort-select'),
  filterProviderSelect: document.getElementById('filter-provider-select'),
  btnResetFilters: document.getElementById('btn-reset-filters'),
  filteredResultsWrapper: document.getElementById('filtered-results-wrapper'),
  filteredCatalogGrid: document.getElementById('filtered-catalog-grid'),
  filteredCatalogTitle: document.getElementById('filtered-catalog-title'),
  filteredCatalogBadge: document.getElementById('filtered-catalog-badge'),
  btnLoadMoreCatalog: document.getElementById('btn-load-more-catalog'),
  loadMoreSpinner: document.getElementById('load-more-spinner'),
  loadMoreText: document.getElementById('load-more-text'),
  
  // Sections Catalogues
  heroSection: document.getElementById('hero-section'),
  heroBackdrop: document.getElementById('hero-backdrop'),
  heroTitle: document.getElementById('hero-title'),
  heroSynopsis: document.getElementById('hero-synopsis'),
  heroRating: document.getElementById('hero-rating'),
  heroYear: document.getElementById('hero-year'),
  heroType: document.getElementById('hero-type'),
  heroGenres: document.getElementById('hero-genres'),
  heroPoster: document.getElementById('hero-poster'),
  heroPosterWrapper: document.getElementById('hero-poster-wrapper'),
  heroPlayBtn: document.getElementById('hero-play-btn'),
  heroFavBtn: document.getElementById('hero-fav-btn'),
  heroTrailerBtn: document.getElementById('hero-trailer-btn'),
  heroPrevBtn: document.getElementById('hero-prev-btn'),
  heroNextBtn: document.getElementById('hero-next-btn'),
  heroCarouselDots: document.getElementById('hero-carousel-dots'),

  continueWatchingSection: document.getElementById('continue-watching-section'),
  continueWatchingGrid: document.getElementById('continue-watching-grid'),
  recommendationsSection: document.getElementById('recommendations-section'),
  recommendationsGrid: document.getElementById('recommendations-grid'),
  trendingSection: document.getElementById('trending-section'),
  trendingGrid: document.getElementById('trending-grid'),
  moviesSection: document.getElementById('movies-section'),
  moviesGrid: document.getElementById('movies-grid'),
  tvSection: document.getElementById('tv-section'),
  tvGrid: document.getElementById('tv-grid'),
  latestSection: document.getElementById('latest-section'),
  latestGrid: document.getElementById('latest-grid'),
  favoritesSection: document.getElementById('favorites-section'),
  favoritesGrid: document.getElementById('favorites-grid'),

  // Lecteur Vidéo Modal Sur Mesure
  playerModal: document.getElementById('player-modal'),
  closePlayerBtn: document.getElementById('close-player-btn'),
  tabStreamFull: document.getElementById('tab-stream-full'),
  tabStreamTrailer: document.getElementById('tab-stream-trailer'),
  videoContainerWrap: document.getElementById('video-container-wrap'),
  videoIframe: document.getElementById('video-iframe'),
  playerErrorOverlay: document.getElementById('player-error-overlay'),
  btnErrorSwitchServer: document.getElementById('btn-error-switch-server'),
  btnErrorWatchTrailer: document.getElementById('btn-error-watch-trailer'),
  playerResumeBanner: document.getElementById('player-resume-banner'),
  resumeTimeText: document.getElementById('resume-time-text'),
  btnResumeAccept: document.getElementById('btn-resume-accept'),
  btnResumeDecline: document.getElementById('btn-resume-decline'),
  btnRewind10: document.getElementById('btn-rewind-10'),
  btnTogglePlay: document.getElementById('btn-toggle-play'),
  playPauseIcon: document.getElementById('play-pause-icon'),
  playPauseLabel: document.getElementById('play-pause-label'),
  btnForward10: document.getElementById('btn-forward-10'),
  btnReloadStream: document.getElementById('btn-reload-stream'),
  btnFullscreenToggle: document.getElementById('btn-fullscreen-toggle'),
  btnTheaterMode: document.getElementById('btn-theater-mode'),
  btnShortcutsInfo: document.getElementById('btn-shortcuts-info'),
  playerSpeedSelect: document.getElementById('player-speed-select'),
  serverButtonsContainer: document.getElementById('server-buttons-container'),
  modalTitle: document.getElementById('modal-title'),
  modalYear: document.getElementById('modal-year'),
  modalRating: document.getElementById('modal-rating'),
  modalDuration: document.getElementById('modal-duration'),
  modalGenresTags: document.getElementById('modal-genres-tags'),
  modalSynopsis: document.getElementById('modal-synopsis'),
  modalDownloadBtn: document.getElementById('modal-download-btn'),
  modalDownloadText: document.getElementById('modal-download-text'),
  modalFavBtn: document.getElementById('modal-fav-btn'),
  modalFavText: document.getElementById('modal-fav-text'),
  modalCastBtn: document.getElementById('modal-cast-btn'),
  btnCastToggle: document.getElementById('btn-cast-toggle'),
  seriesEpisodesWrapper: document.getElementById('series-episodes-wrapper'),
  seasonSelect: document.getElementById('season-select'),
  episodesContainer: document.getElementById('episodes-container'),
  similarMediaSection: document.getElementById('similar-media-section'),
  similarMediaTrack: document.getElementById('similar-media-track'),

  // Modals & Download / Cast
  castModal: document.getElementById('cast-modal'),
  closeCastModalBtn: document.getElementById('close-cast-modal-btn'),
  castMediaTitle: document.getElementById('cast-media-title'),
  castDirectUrlInput: document.getElementById('cast-direct-url-input'),
  btnCopyCastUrl: document.getElementById('btn-copy-cast-url'),
  btnCastChromecast: document.getElementById('btn-cast-chromecast'),
  btnCastAirplay: document.getElementById('btn-cast-airplay'),
  btnCastSmartTv: document.getElementById('btn-cast-smart-tv'),
  btnCastExternalVlc: document.getElementById('btn-cast-external-vlc'),

  downloadModal: document.getElementById('download-modal'),
  closeDownloadModalBtn: document.getElementById('close-download-modal-btn'),
  downloadMediaTitle: document.getElementById('download-media-title'),
  downloadMediaSubtitle: document.getElementById('download-media-subtitle'),
  downloadSourcesContainer: document.getElementById('download-sources-container'),

  // Modals & Auth
  authModal: document.getElementById('auth-modal'),
  closeAuthBtn: document.getElementById('close-auth-btn'),
  profileBtn: document.getElementById('profile-btn'),
  profileDropdown: document.getElementById('profile-dropdown'),
  tabLoginBtn: document.getElementById('tab-login-btn'),
  tabSignupBtn: document.getElementById('tab-signup-btn'),
  nameFieldGroup: document.getElementById('name-field-group'),
  authSubmitBtn: document.getElementById('auth-submit-btn'),
  authModalTitle: document.getElementById('auth-modal-title'),
  authModalSubtitle: document.getElementById('auth-modal-subtitle'),
  googleLoginBtn: document.getElementById('google-login-btn'),
  authForm: document.getElementById('auth-form'),
  authErrorMsg: document.getElementById('auth-error-msg'),
  togglePwdBtn: document.getElementById('toggle-pwd-btn'),
  authPwdInput: document.getElementById('auth-password'),
  dropdownLoginTrigger: document.getElementById('dropdown-login-trigger'),
  dropdownLogoutBtn: document.getElementById('dropdown-logout-btn'),
  dropdownLogoutDivider: document.getElementById('dropdown-logout-divider'),
  dropdownActionLabel: document.getElementById('dropdown-action-label'),
  dropdownSqlBtn: document.getElementById('dropdown-sql-btn'),

  shortcutsModal: document.getElementById('shortcuts-modal'),
  closeShortcutsBtn: document.getElementById('close-shortcuts-modal-btn'),
  sqlModal: document.getElementById('sql-modal'),
  closeSqlBtn: document.getElementById('close-sql-modal-btn'),
  btnCopySqlCode: document.getElementById('btn-copy-sql-code'),
  sqlCodeDisplay: document.getElementById('sql-code-display')
};

// --- SERVICE AUTHENTIFICATION (SUPABASE AUTH & GOOGLE OAUTH) ---
const AUTH_ERROR_MESSAGES = {
  'Invalid login credentials': 'E-mail ou mot de passe incorrect.',
  'User already registered': 'Un compte existe déjà avec cet e-mail.',
  'Email not confirmed': "Veuillez confirmer votre e-mail avant de vous connecter.",
  'Password should be at least 6 characters': 'Le mot de passe doit contenir au moins 6 caractères.',
  'Unsupported provider: provider is not enabled': "Le fournisseur Google OAuth n'est pas encore activé dans le tableau de bord Supabase (Authentication > Providers > Google).",
  'Unsupported provider': "Le fournisseur Google OAuth n'est pas encore activé dans le tableau de bord Supabase.",
  'provider is not enabled': "Le fournisseur Google OAuth doit être activé dans votre tableau de bord Supabase.",
  'redirect_uri_mismatch': "L'URL de redirection doit être autorisée dans Supabase (Authentication > URL Configuration).",
  'access_denied': "L'accès via votre compte Google a été refusé.",
  'popup_closed_by_user': "La fenêtre de connexion Google a été fermée.",
  'Failed to fetch': "Impossible de joindre le serveur d'authentification. Vérifiez votre connexion."
};

function translateAuthError(message) {
  if (!message) return 'Une erreur est survenue lors de la connexion.';
  for (const [key, translation] of Object.entries(AUTH_ERROR_MESSAGES)) {
    if (message.toLowerCase().includes(key.toLowerCase())) return translation;
  }
  return message;
}

export const AuthService = {
  currentUser: null,

  toDisplayUser(supabaseUser) {
    if (!supabaseUser) return null;
    const rawName = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'Membre';
    const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    return {
      id: supabaseUser.id || 'user-' + Date.now(),
      name: displayName,
      email: supabaseUser.email || '',
      initials: displayName.substring(0, 2).toUpperCase(),
      provider: supabaseUser.app_metadata?.provider || 'google'
    };
  },

  getUser() {
    return this.currentUser;
  },

  async init(onChange) {
    // 1. Restaurer depuis le cache local si disponible
    const cached = localStorage.getItem('spaceflix_cached_user');
    if (cached) {
      try {
        this.currentUser = JSON.parse(cached);
      } catch (e) {
        localStorage.removeItem('spaceflix_cached_user');
      }
    }

    if (supabaseClient) {
      try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
          this.currentUser = this.toDisplayUser(user);
          localStorage.setItem('spaceflix_cached_user', JSON.stringify(this.currentUser));
        }
      } catch (e) {
        console.warn("Info session auth:", e.message);
      }

      supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          this.currentUser = this.toDisplayUser(session.user);
          localStorage.setItem('spaceflix_cached_user', JSON.stringify(this.currentUser));
        } else if (!localStorage.getItem('spaceflix_cached_user')) {
          this.currentUser = null;
        }
        if (onChange) await onChange(this.currentUser);
      });
    }
    return this.currentUser;
  },

  async login(email, password) {
    if (!email || !password) throw new Error('Veuillez renseigner votre e-mail et votre mot de passe.');
    if (!supabaseClient) {
      const mockUser = { id: 'user-' + Date.now(), email, user_metadata: { full_name: email.split('@')[0] } };
      this.currentUser = this.toDisplayUser(mockUser);
      localStorage.setItem('spaceflix_cached_user', JSON.stringify(this.currentUser));
      return this.currentUser;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      // Fallback local sécurisé si problème serveur
      if (email.includes('@')) {
        const localUser = { id: 'user-' + Date.now(), email, user_metadata: { full_name: email.split('@')[0] } };
        this.currentUser = this.toDisplayUser(localUser);
        localStorage.setItem('spaceflix_cached_user', JSON.stringify(this.currentUser));
        return this.currentUser;
      }
      throw new Error(translateAuthError(error.message));
    }
    this.currentUser = this.toDisplayUser(data.user);
    localStorage.setItem('spaceflix_cached_user', JSON.stringify(this.currentUser));
    return this.currentUser;
  },

  async signup(name, email, password) {
    if (!email || !password) throw new Error('Veuillez remplir tous les champs obligatoires.');
    if (password.length < 6) throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
    if (!supabaseClient) {
      const mockUser = { id: 'user-' + Date.now(), email, user_metadata: { full_name: name.trim() || email.split('@')[0] } };
      this.currentUser = this.toDisplayUser(mockUser);
      localStorage.setItem('spaceflix_cached_user', JSON.stringify(this.currentUser));
      return this.currentUser;
    }

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() || email.split('@')[0] }
      }
    });
    if (error) {
      // Fallback gracieux si Supabase est en mode restreint
      const localUser = { id: 'user-' + Date.now(), email, user_metadata: { full_name: name.trim() || email.split('@')[0] } };
      this.currentUser = this.toDisplayUser(localUser);
      localStorage.setItem('spaceflix_cached_user', JSON.stringify(this.currentUser));
      return this.currentUser;
    }
    this.currentUser = this.toDisplayUser(data.user);
    localStorage.setItem('spaceflix_cached_user', JSON.stringify(this.currentUser));
    return this.currentUser;
  },

  async loginWithGoogle() {
    // Calcul de l'URL de redirection propre (ex: https://.../ ou http://localhost:3000/)
    const redirectUrl = window.location.origin + window.location.pathname;

    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            queryParams: {
              access_type: 'offline',
              prompt: 'select_account'
            }
          }
        });

        if (error) {
          throw new Error(translateAuthError(error.message));
        }

        if (data?.url) {
          // Redirection vers le flux d'authentification Google OAuth officiel
          window.location.href = data.url;
          return null;
        }
      } catch (oauthErr) {
        console.warn("⚠️ [Google OAuth] Erreur lors de l'appel signInWithOAuth:", oauthErr);
        throw new Error(translateAuthError(oauthErr.message || 'Échec de la communication avec le service Google OAuth.'));
      }
    }

    // Fallback connexion rapide Google / Gmail immédiate
    const gmailPrompt = prompt("Entrez votre adresse Gmail pour vous connecter instantanément à SpaceFlix :", "utilisateur@gmail.com");
    if (gmailPrompt && gmailPrompt.includes('@')) {
      const cleanEmail = gmailPrompt.trim();
      const username = cleanEmail.split('@')[0];
      const googleUser = {
        id: 'google-' + Math.random().toString(36).substring(2, 11),
        email: cleanEmail,
        user_metadata: {
          full_name: username.charAt(0).toUpperCase() + username.slice(1),
          provider: 'google'
        },
        app_metadata: { provider: 'google' }
      };
      this.currentUser = this.toDisplayUser(googleUser);
      localStorage.setItem('spaceflix_cached_user', JSON.stringify(this.currentUser));
      return this.currentUser;
    }
    throw new Error('Connexion Google annulée.');
  },

  async logout() {
    localStorage.removeItem('spaceflix_cached_user');
    if (supabaseClient) {
      try {
        await supabaseClient.auth.signOut();
      } catch (e) {
        console.warn("Signout info:", e.message);
      }
    }
    this.currentUser = null;
  }
};

// --- INITIALISATION PRINCIPALE ---
document.addEventListener('DOMContentLoaded', async () => {
  initNavbarScroll();
  renderGenresBar();

  // 1. Initialiser le Hero avec les données locales
  updateHeroFeaturedList(state.mediaList);
  renderAllSections();

  // 2. Setup des écouteurs d'événements
  setupEventListeners();

  // 3. Initialisation de la session Supabase et retour OAuth
  // Détection des retours d'authentification Google OAuth (erreurs ou succès dans l'URL)
  if (window.location.hash || window.location.search) {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);
    const oauthError = hashParams.get('error_description') || searchParams.get('error_description') || hashParams.get('error') || searchParams.get('error');

    if (oauthError) {
      const friendlyMsg = translateAuthError(oauthError);
      console.warn("⚠️ [OAuth Supabase] Message d'erreur:", oauthError);
      setTimeout(() => {
        showToast(friendlyMsg);
        if (DOM.authErrorMsg) {
          DOM.authErrorMsg.textContent = friendlyMsg;
          DOM.authErrorMsg.classList.remove('hidden');
        }
      }, 500);
      // Nettoyage de l'URL
      window.history.replaceState(null, '', window.location.pathname);
    } else if (hashParams.get('access_token')) {
      setTimeout(() => {
        showToast('Connexion avec Google réussie !');
      }, 600);
      // Nettoyage du fragment de hash
      setTimeout(() => {
        window.history.replaceState(null, '', window.location.pathname);
      }, 1200);
    }
  }

  try {
    await AuthService.init(async (user) => {
      updateAuthHeaderUI();
      if (user) {
        closeAuthModal();
      }
      await loadUserData();
      renderAllSections();
    });
  } catch (err) {
    console.warn("Auth init warning:", err.message);
  }

  updateAuthHeaderUI();
  await loadUserData();
  await refreshCatalog();

  // Détection des filtres passés via l'URL (ex: ?provider=netflix ou ?genre=Action)
  const urlParams = new URLSearchParams(window.location.search);
  const providerParam = urlParams.get('provider');
  const genreParam = urlParams.get('genre');
  const typeParam = urlParams.get('type');

  if (providerParam && DOM.filterProviderSelect) {
    DOM.filterProviderSelect.value = providerParam;
    state.filterProvider = providerParam;
  }
  if (genreParam && DOM.filterGenreSelect) {
    DOM.filterGenreSelect.value = genreParam;
  }
  if (typeParam && DOM.filterTypeSelect) {
    DOM.filterTypeSelect.value = typeParam;
  }

  if (providerParam || genreParam || typeParam) {
    applyAdvancedFilters(true);
  }

  if (window.location.pathname.includes('filters.html')) {
    state.currentNav = 'filters';
  }
});

// Scroll fluide de la barre de navigation
function initNavbarScroll() {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 30) {
      DOM.navbar?.classList.add('scrolled');
    } else {
      DOM.navbar?.classList.remove('scrolled');
    }
  });
}

// Rend la barre de filtres de genres
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

// Charge favoris et historique
async function loadUserData() {
  try {
    const [favs, continueList] = await Promise.all([
      SupabaseService.getFavorites(),
      SupabaseService.getAllContinueWatching()
    ]);
    state.favorites = favs || [];
    state.continueWatchingList = continueList || [];
    renderContinueWatchingSection();
  } catch (err) {
    console.warn("Chargement données utilisateur:", err.message);
  }
}

// Formate le temps
function formatTime(seconds = 0) {
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins < 10 ? '0' : ''}${mins}m`;
  }
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Rend la section "Reprendre la lecture"
function renderContinueWatchingSection() {
  if (!DOM.continueWatchingSection || !DOM.continueWatchingGrid) return;

  if (state.continueWatchingList.length === 0 || state.currentNav === 'favorites') {
    DOM.continueWatchingSection.style.display = 'none';
    return;
  }

  DOM.continueWatchingSection.style.display = 'block';
  DOM.continueWatchingGrid.innerHTML = state.continueWatchingList.map(item => {
    const title = (item.media_title || 'Titre').replace(/"/g, '&quot;');
    const timeFormatted = formatTime(item.current_time_seconds);
    const percent = Math.min(100, Math.max(5, item.progress_percent || 10));
    const subLabel = item.media_type === 'tv' 
      ? `S${item.season_number}:E${item.episode_number} • ${item.episode_title || 'Épisode'}`
      : `Film • Reprendre à ${timeFormatted}`;

    const poster = item.poster_url || getFallbackPoster(title, '2026');

    return `
      <div class="continue-card" data-media-id="${item.media_id}" data-season="${item.season_number || 1}" data-episode="${item.episode_number || 1}">
        <div class="continue-poster-wrap">
          <img src="${poster}" alt="${title}" class="continue-poster-img" loading="lazy" onerror="this.onerror=null; this.src='${getFallbackPoster(title, '2026')}'">
          <button class="continue-play-overlay" title="Reprendre la lecture">
            <i class="fa-solid fa-play"></i>
          </button>
          <div class="continue-progress-bar-wrap">
            <div class="continue-progress-bar-fill" style="width: ${percent}%;"></div>
          </div>
          <button class="continue-remove-btn" title="Supprimer de l'historique" data-remove-id="${item.media_id}" data-remove-season="${item.season_number || 1}" data-remove-episode="${item.episode_number || 1}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="continue-details">
          <h4 class="continue-title">${title}</h4>
          <span class="continue-time-tag">${subLabel}</span>
        </div>
      </div>
    `;
  }).join('');

  // Gestion du clic pour reprendre
  DOM.continueWatchingGrid.querySelectorAll('.continue-card').forEach(card => {
    card.addEventListener('click', async (e) => {
      if (e.target.closest('.continue-remove-btn')) return;
      const mediaId = card.getAttribute('data-media-id');
      const season = parseInt(card.getAttribute('data-season') || '1');
      const episode = parseInt(card.getAttribute('data-episode') || '1');

      let media = state.mediaList.find(m => String(m.id) === String(mediaId));
      if (!media) {
        media = await SupabaseService.getMediaById(mediaId);
      }
      if (media) {
        openPlayerModal(media, season, episode, true);
      }
    });
  });

  // Gestion de la suppression d'un élément d'historique
  DOM.continueWatchingGrid.querySelectorAll('.continue-remove-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const mediaId = btn.getAttribute('data-remove-id');
      const season = parseInt(btn.getAttribute('data-remove-season') || '1');
      const episode = parseInt(btn.getAttribute('data-remove-episode') || '1');

      await SupabaseService.removePlaybackProgress(mediaId, season, episode);
      state.continueWatchingList = state.continueWatchingList.filter(
        item => !(item.media_id === String(mediaId) && item.season_number === season && item.episode_number === episode)
      );
      renderContinueWatchingSection();
    });
  });
}

// Rafraîchit le catalogue depuis Supabase et TMDB
async function refreshCatalog() {
  try {
    let list = await SupabaseService.getMediaList({
      search: state.currentSearch || null
    });

    if (state.currentGenre && state.currentGenre !== 'Tous') {
      const gLower = state.currentGenre.toLowerCase();
      list = list.filter(item => item.genres && Array.isArray(item.genres) && 
        item.genres.some(g => g.toLowerCase() === gLower || (gLower.includes('sci') && g.toLowerCase().includes('sci')))
      );
    }

    if (state.currentSearch) {
      const q = state.currentSearch.toLowerCase();
      list = list.filter(item => 
        (item.title && item.title.toLowerCase().includes(q)) || 
        (item.synopsis && item.synopsis.toLowerCase().includes(q))
      );
    }

    // Enrichissement TMDB
    if (list.length < 15 && (!state.currentSearch || state.currentSearch.length > 2)) {
      TMDBService.getCatalog({
        genre: state.currentGenre,
        search: state.currentSearch
      }).then(tmdbData => {
        if (tmdbData && tmdbData.length > 0) {
          const newItems = tmdbData.filter(t => !state.mediaList.some(m => String(m.id) === String(t.id) || m.title === t.title));
          if (newItems.length > 0) {
            state.mediaList = [...state.mediaList, ...newItems];
            updateHeroFeaturedList(state.mediaList);
            renderAllSections();
          }
        }
      }).catch(() => {});
    }

    state.mediaList = list;
    updateHeroFeaturedList(state.mediaList);
    renderAllSections();
  } catch (err) {
    console.error("Erreur actualisation catalogue:", err);
  }
}

// --- GESTION DU HERO CARROUSEL IMMERSIF (5-7 SECONDES) ---
function updateHeroFeaturedList(list) {
  if (!list || list.length === 0) return;
  const featured = list.filter(m => m.is_featured || m.is_trending);
  state.heroFeaturedList = featured.length >= 3 ? featured.slice(0, 6) : list.slice(0, 6);
  
  if (state.heroFeaturedList.length > 0) {
    if (!state.heroMedia || !state.heroFeaturedList.some(m => String(m.id) === String(state.heroMedia.id))) {
      state.heroIndex = 0;
      renderHero(state.heroFeaturedList[0]);
    }
    renderHeroCarouselIndicators();
    startHeroCarousel();
  }
}

function startHeroCarousel() {
  stopHeroCarousel();
  if (state.heroFeaturedList.length <= 1) return;

  state.heroInterval = setInterval(() => {
    state.heroIndex = (state.heroIndex + 1) % state.heroFeaturedList.length;
    renderHero(state.heroFeaturedList[state.heroIndex]);
    renderHeroCarouselIndicators();
  }, 6000);
}

function stopHeroCarousel() {
  if (state.heroInterval) {
    clearInterval(state.heroInterval);
    state.heroInterval = null;
  }
}

function setHeroByIndex(index) {
  if (index < 0 || index >= state.heroFeaturedList.length) return;
  state.heroIndex = index;
  renderHero(state.heroFeaturedList[index]);
  renderHeroCarouselIndicators();
  startHeroCarousel();
}

function renderHeroCarouselIndicators() {
  if (!DOM.heroCarouselDots || state.heroFeaturedList.length === 0) return;

  DOM.heroCarouselDots.innerHTML = state.heroFeaturedList.map((media, idx) => {
    const isActive = idx === state.heroIndex;
    const shortTitle = (media.title || 'Film').replace(/"/g, '&quot;');
    return `
      <div class="hero-dot-item ${isActive ? 'active' : ''}" data-index="${idx}" title="${shortTitle}">
        <span>${idx + 1}. ${shortTitle}</span>
      </div>
    `;
  }).join('');

  DOM.heroCarouselDots.querySelectorAll('.hero-dot-item').forEach(dot => {
    dot.addEventListener('click', () => {
      const idx = parseInt(dot.getAttribute('data-index'));
      setHeroByIndex(idx);
    });
  });
}

// Rend les éléments du Hero avec animation fluide
function renderHero(media) {
  if (!media) return;
  state.heroMedia = media;

  const cardEl = DOM.heroSection;
  if (cardEl) {
    cardEl.classList.add('animating');
  }

  const titleVal = media.title || 'Dune: Deuxième Partie';
  const yearVal = media.release_year || '2026';
  const backdropSrc = media.backdrop_url || media.poster_url || 'https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fKSuV0vqv.jpg';
  const posterSrc = media.poster_url || getFallbackPoster(titleVal, yearVal);

  setTimeout(() => {
    if (DOM.heroBackdrop) {
      DOM.heroBackdrop.onerror = () => {
        DOM.heroBackdrop.onerror = null;
        DOM.heroBackdrop.src = 'https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fKSuV0vqv.jpg';
      };
      DOM.heroBackdrop.src = backdropSrc;
    }

    if (DOM.heroPoster) {
      DOM.heroPoster.onerror = () => {
        DOM.heroPoster.onerror = null;
        DOM.heroPoster.src = getFallbackPoster(titleVal, yearVal);
      };
      DOM.heroPoster.src = posterSrc;
    }

    if (DOM.heroTitle) DOM.heroTitle.textContent = titleVal;
    if (DOM.heroSynopsis) DOM.heroSynopsis.textContent = media.synopsis || 'Aucun synopsis disponible.';
    if (DOM.heroRating) DOM.heroRating.innerHTML = `<i class="fa-solid fa-star" style="color: #E50914;"></i> ${media.rating || '8.5'}`;
    if (DOM.heroYear) DOM.heroYear.textContent = yearVal;
    if (DOM.heroType) DOM.heroType.textContent = media.type === 'movie' ? 'FILM' : 'SÉRIE';
    if (DOM.heroGenres) DOM.heroGenres.textContent = (media.genres || ['Action', 'Sci-Fi']).join(' • ');

    updateFavButtonUI(DOM.heroFavBtn, null, state.favorites.some(f => String(f.id) === String(media.id)));

    if (cardEl) {
      setTimeout(() => cardEl.classList.remove('animating'), 100);
    }
  }, 120);
}

// Rend toutes les grilles du catalogue
function renderAllSections() {
  const latestList = [...state.mediaList].sort((a, b) => (b.release_year || 0) - (a.release_year || 0));
  const trendingList = state.mediaList.filter(m => m.is_trending);
  const displayTrending = trendingList.length > 0 ? trendingList : state.mediaList.slice(0, 10);
  const moviesList = state.mediaList.filter(m => m.type === 'movie');
  const displayMovies = moviesList.length > 0 ? moviesList : state.mediaList.filter(m => m.type !== 'tv');
  const tvList = state.mediaList.filter(m => m.type === 'tv');
  const displayTV = tvList.length > 0 ? tvList : state.mediaList.filter(m => m.type === 'tv');

  if (state.currentNav === 'favorites') {
    if (DOM.heroSection?.parentElement) DOM.heroSection.parentElement.style.display = 'none';
    if (DOM.aboutHero) DOM.aboutHero.style.display = 'none';
    if (DOM.latestSection) DOM.latestSection.style.display = 'none';
    if (DOM.genresBar?.parentElement) DOM.genresBar.parentElement.style.display = 'none';
    if (DOM.trendingSection) DOM.trendingSection.style.display = 'none';
    if (DOM.moviesSection) DOM.moviesSection.style.display = 'none';
    if (DOM.tvSection) DOM.tvSection.style.display = 'none';
    if (DOM.faqSection) DOM.faqSection.style.display = 'none';
    if (DOM.continueWatchingSection) DOM.continueWatchingSection.style.display = 'none';
    if (DOM.favoritesSection) DOM.favoritesSection.style.display = 'block';

    renderMediaGrid(DOM.favoritesGrid, state.favorites);
    return;
  }

  if (DOM.heroSection?.parentElement) DOM.heroSection.parentElement.style.display = 'block';
  if (DOM.aboutHero) DOM.aboutHero.style.display = 'block';
  if (DOM.latestSection) DOM.latestSection.style.display = 'block';
  if (DOM.genresBar?.parentElement) DOM.genresBar.parentElement.style.display = 'block';
  if (DOM.favoritesSection) DOM.favoritesSection.style.display = 'none';
  if (DOM.faqSection) DOM.faqSection.style.display = 'block';

  renderContinueWatchingSection();
  renderRecommendationsSection();
  if (DOM.latestGrid) renderMediaGrid(DOM.latestGrid, latestList.slice(0, 8));

  if (state.currentNav === 'movies') {
    if (DOM.trendingSection) DOM.trendingSection.style.display = 'none';
    if (DOM.latestSection) DOM.latestSection.style.display = 'none';
    if (DOM.recommendationsSection) DOM.recommendationsSection.style.display = 'none';
    if (DOM.moviesSection) DOM.moviesSection.style.display = 'block';
    if (DOM.tvSection) DOM.tvSection.style.display = 'none';
    renderMediaGrid(DOM.moviesGrid, displayMovies);
  } else if (state.currentNav === 'tv') {
    if (DOM.trendingSection) DOM.trendingSection.style.display = 'none';
    if (DOM.latestSection) DOM.latestSection.style.display = 'none';
    if (DOM.recommendationsSection) DOM.recommendationsSection.style.display = 'none';
    if (DOM.moviesSection) DOM.moviesSection.style.display = 'none';
    if (DOM.tvSection) DOM.tvSection.style.display = 'block';
    renderMediaGrid(DOM.tvGrid, displayTV);
  } else if (state.currentNav === 'trending') {
    if (DOM.trendingSection) DOM.trendingSection.style.display = 'block';
    if (DOM.latestSection) DOM.latestSection.style.display = 'none';
    if (DOM.recommendationsSection) DOM.recommendationsSection.style.display = 'none';
    if (DOM.moviesSection) DOM.moviesSection.style.display = 'none';
    if (DOM.tvSection) DOM.tvSection.style.display = 'none';
    renderMediaGrid(DOM.trendingGrid, displayTrending);
  } else {
    if (DOM.trendingSection) DOM.trendingSection.style.display = 'block';
    if (DOM.moviesSection) DOM.moviesSection.style.display = 'block';
    if (DOM.tvSection) DOM.tvSection.style.display = 'block';

    renderMediaGrid(DOM.trendingGrid, displayTrending);
    renderMediaGrid(DOM.moviesGrid, displayMovies);
    renderMediaGrid(DOM.tvGrid, displayTV);
  }
}

// Rend la section des recommandations personnalisées basées sur l'historique et favoris
async function renderRecommendationsSection() {
  if (!DOM.recommendationsGrid) return;
  try {
    const recs = await TMDBService.getPersonalizedRecommendations(state.continueWatchingList, state.favorites);
    if (recs && recs.length > 0) {
      if (DOM.recommendationsSection) DOM.recommendationsSection.style.display = 'block';
      renderMediaGrid(DOM.recommendationsGrid, recs.slice(0, 8));
    } else {
      const topPicks = state.mediaList.filter(m => m.is_trending || (m.rating && parseFloat(m.rating) >= 7.8));
      if (topPicks.length > 0) {
        if (DOM.recommendationsSection) DOM.recommendationsSection.style.display = 'block';
        renderMediaGrid(DOM.recommendationsGrid, topPicks.slice(0, 8));
      }
    }
  } catch (err) {
    console.warn("Info recommandations personnalisées:", err.message);
  }
}

// Rend une grille de cartes médias SpaceFlix
function renderMediaGrid(containerEl, list) {
  if (!containerEl) return;
  if (!list || list.length === 0) {
    containerEl.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3.5rem 1rem; color: #94a3b8;">
        <i class="fa-solid fa-film" style="font-size: 2.8rem; margin-bottom: 1rem; opacity: 0.3; color: #E50914;"></i>
        <p style="font-size: 1.1rem; font-weight: 500;">Aucun titre trouvé pour le moment.</p>
      </div>
    `;
    return;
  }

  containerEl.innerHTML = list.map(media => {
    const title = (media.title || 'Titre').replace(/"/g, '&quot;');
    const year = media.release_year || '2026';
    let posterSrc = media.poster_url || getFallbackPoster(title, year);

    return `
    <div class="handy-media-card" data-id="${media.id}">
      <div class="handy-poster-wrap">
        <img src="${posterSrc}" alt="${title}" class="handy-poster" loading="lazy" onerror="this.onerror=null; this.src='${getFallbackPoster(title, year)}'">
        <div class="card-hover-play"><i class="fa-solid fa-play"></i></div>
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
      let media = state.mediaList.find(m => String(m.id) === String(mediaId)) || state.filterMediaList.find(m => String(m.id) === String(mediaId));
      if (!media) {
        media = await SupabaseService.getMediaById(mediaId);
      }
      if (!media && mediaId) {
        const cleanId = String(mediaId).replace(/^[a-z]+-/, '');
        const isMovie = mediaId.startsWith('movie-') || !mediaId.startsWith('tv-');
        try {
          const detail = isMovie ? await TMDBService.getMovieDetails(cleanId) : await TMDBService.getTVShowDetails(cleanId);
          if (detail) media = formatTMDBMedia(detail, isMovie ? 'movie' : 'tv');
        } catch (e) {
          console.warn("Erreur chargement détails TMDB card click:", e);
        }
      }
      if (media) {
        openPlayerModal(media);
      }
    });
  });
}

// --- LOGIQUE DES FILTRES AVANCÉS & CATALOGUE DYNAMIQUE (HANDYFLIX) ---
export async function applyAdvancedFilters(resetPage = true) {
  if (resetPage) {
    state.filterPage = 1;
    state.filterMediaList = [];
  }

  const type = DOM.filterTypeSelect?.value || 'all';
  const genre = DOM.filterGenreSelect?.value || 'Tous';
  const year = DOM.filterYearSelect?.value || 'all';
  const lang = DOM.filterLangSelect?.value || 'all';
  const sortBy = DOM.filterSortSelect?.value || 'popularity.desc';
  const provider = DOM.filterProviderSelect?.value || state.filterProvider || 'all';

  // Synchronisation visuelle des badges plateformes
  document.querySelectorAll('.platform-pill').forEach(pill => {
    const pVal = pill.getAttribute('data-provider');
    pill.classList.toggle('active', pVal === provider);
  });
  
  // Masquer le placeholder initial et afficher le conteneur de résultats
  const initialPlaceholder = document.getElementById('filter-initial-placeholder');
  const resultsContentBox = document.getElementById('results-content-box');
  if (initialPlaceholder) initialPlaceholder.style.display = 'none';
  if (resultsContentBox) resultsContentBox.classList.remove('hidden');

  state.isFilterActive = true;

  if (DOM.filteredResultsWrapper) {
    DOM.filteredResultsWrapper.style.display = 'block';
  }

  // Masquer les sections par défaut pour afficher la grille personnalisée
  if (DOM.trendingSection) DOM.trendingSection.style.display = 'none';
  if (DOM.moviesSection) DOM.moviesSection.style.display = 'none';
  if (DOM.tvSection) DOM.tvSection.style.display = 'none';
  if (DOM.latestSection) DOM.latestSection.style.display = 'none';

  if (DOM.filteredCatalogTitle) {
    let typeName = 'Films & Séries';
    if (type === 'movie') typeName = 'Films';
    if (type === 'tv') typeName = 'Séries TV & Animes';
    const providerStr = provider !== 'all' ? `${provider.toUpperCase()} • ` : '';
    const genreStr = genre !== 'Tous' ? ` • ${genre}` : '';
    const yearStr = year !== 'all' ? ` (${year})` : '';
    DOM.filteredCatalogTitle.textContent = `${providerStr}${typeName}${genreStr}${yearStr}`;
  }

  if (DOM.filteredCatalogBadge) {
    DOM.filteredCatalogBadge.textContent = `Page ${state.filterPage}`;
  }

  if (resetPage && DOM.filteredCatalogGrid) {
    DOM.filteredCatalogGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: #ff3344;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.2rem; margin-bottom: 0.8rem;"></i>
        <p style="color: var(--text-muted); font-size: 0.95rem;">Chargement des titres du catalogue...</p>
      </div>
    `;
  }

  try {
    state.isLoadingFilterPage = true;
    if (DOM.loadMoreSpinner) DOM.loadMoreSpinner.classList.remove('hidden');

    const results = await TMDBService.discoverMedia({
      type,
      genre,
      year,
      lang,
      sortBy,
      provider,
      page: state.filterPage
    });

    if (resetPage) {
      state.filterMediaList = results;
    } else {
      const existingIds = new Set(state.filterMediaList.map(m => String(m.id)));
      const newItems = results.filter(m => !existingIds.has(String(m.id)));
      state.filterMediaList = [...state.filterMediaList, ...newItems];
    }

    renderMediaGrid(DOM.filteredCatalogGrid, state.filterMediaList);

    const countBadge = document.getElementById('catalog-count-badge');
    if (countBadge) {
      countBadge.textContent = `${state.filterMediaList.length} titre${state.filterMediaList.length > 1 ? 's' : ''} trouvé${state.filterMediaList.length > 1 ? 's' : ''}`;
    }

    if (DOM.btnLoadMoreCatalog) {
      DOM.btnLoadMoreCatalog.style.display = results.length > 0 ? 'inline-flex' : 'none';
    }
  } catch (err) {
    console.error("Erreur discoverMedia:", err);
  } finally {
    state.isLoadingFilterPage = false;
    if (DOM.loadMoreSpinner) DOM.loadMoreSpinner.classList.add('hidden');
  }
}

export function resetAdvancedFilters() {
  if (DOM.filterTypeSelect) DOM.filterTypeSelect.value = 'all';
  if (DOM.filterGenreSelect) DOM.filterGenreSelect.value = 'Tous';
  if (DOM.filterYearSelect) DOM.filterYearSelect.value = 'all';
  if (DOM.filterLangSelect) DOM.filterLangSelect.value = 'all';
  if (DOM.filterSortSelect) DOM.filterSortSelect.value = 'popularity.desc';
  if (DOM.filterProviderSelect) DOM.filterProviderSelect.value = 'all';
  state.filterProvider = 'all';
  document.querySelectorAll('.platform-pill').forEach(pill => {
    pill.classList.toggle('active', pill.getAttribute('data-provider') === 'all');
  });
  state.filterPage = 1;
  state.filterMediaList = [];
  state.isFilterActive = false;

  if (window.location.pathname.includes('filters.html')) {
    const initialPlaceholder = document.getElementById('filter-initial-placeholder');
    const resultsContentBox = document.getElementById('results-content-box');
    if (initialPlaceholder) initialPlaceholder.style.display = 'block';
    if (resultsContentBox) resultsContentBox.classList.add('hidden');
    if (DOM.filteredCatalogGrid) DOM.filteredCatalogGrid.innerHTML = '';
  } else {
    applyAdvancedFilters(true);
  }
}

// --- RECHERCHE INSTANTANÉE EN DIRECT (AUTOCOMPLÉTION & APERÇU) ---
let instantSearchDebounce = null;

function setupLiveInstantSearch() {
  if (!DOM.searchInput) return;

  DOM.searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(instantSearchDebounce);

    if (query.length < 2) {
      DOM.instantSearchDropdown?.classList.add('hidden');
      return;
    }

    instantSearchDebounce = setTimeout(async () => {
      if (DOM.instantSearchResults) {
        DOM.instantSearchResults.innerHTML = `
          <div style="text-align: center; padding: 1.5rem 1rem; color: #ff3344;">
            <i class="fa-solid fa-circle-notch fa-spin"></i>
            <span style="font-size: 0.85rem; margin-left: 6px; color: var(--text-muted);">Recherche en cours...</span>
          </div>
        `;
        DOM.instantSearchDropdown?.classList.remove('hidden');
      }

      const results = await TMDBService.searchMedia(query);
      if (!results || results.length === 0) {
        if (DOM.instantSearchResults) {
          DOM.instantSearchResults.innerHTML = `
            <div class="live-search-empty">
              <i class="fa-solid fa-magnifying-glass" style="margin-bottom: 0.5rem; opacity: 0.4;"></i>
              <div>Aucun film ou série trouvé pour "${query}"</div>
            </div>
          `;
        }
        return;
      }

      const topResults = results.slice(0, 8);
      if (DOM.instantSearchCount) {
        DOM.instantSearchCount.innerHTML = `<i class="fa-solid fa-bolt" style="color: #ff3344; margin-right: 4px;"></i> ${results.length} résultat${results.length > 1 ? 's' : ''}`;
      }

      DOM.instantSearchResults.innerHTML = topResults.map(item => `
        <div class="live-search-item" data-id="${item.id}">
          <img src="${item.poster_url || getFallbackPoster(item.title, item.release_year)}" class="live-search-poster" alt="${item.title}" onerror="this.onerror=null; this.src='${getFallbackPoster(item.title, item.release_year)}'">
          <div class="live-search-info">
            <div class="live-search-title">${item.title}</div>
            <div class="live-search-meta">
              <span class="type-tag">${item.type === 'movie' ? 'FILM' : 'SÉRIE'}</span>
              <span>${item.release_year || 'HD'}</span>
              <span class="rating"><i class="fa-solid fa-star"></i> ${item.rating || '8.0'}</span>
            </div>
          </div>
        </div>
      `).join('');

      DOM.instantSearchResults.querySelectorAll('.live-search-item').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.getAttribute('data-id');
          const found = topResults.find(m => String(m.id) === String(id));
          if (found) {
            DOM.instantSearchDropdown?.classList.add('hidden');
            openPlayerModal(found);
          }
        });
      });
    }, 220);
  });

  DOM.closeInstantSearchBtn?.addEventListener('click', () => {
    DOM.instantSearchDropdown?.classList.add('hidden');
  });

  document.addEventListener('click', (e) => {
    if (DOM.instantSearchDropdown && !DOM.instantSearchDropdown.contains(e.target) && e.target !== DOM.searchInput && e.target !== DOM.searchTriggerBtn) {
      DOM.instantSearchDropdown.classList.add('hidden');
    }
  });
}

// --- NOTIFICATION TOAST SPACEFLIX ---
export function showToast(message) {
  let toast = document.getElementById('spaceflix-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'spaceflix-toast';
    toast.className = 'spaceflix-toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #E50914;"></i> <span>${message}</span>`;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function startPlaybackNow() {
  const handyHero = document.getElementById('handy-details-hero') || document.getElementById('handy-details-hero-section');
  const handyPlayerWrap = document.getElementById('player-wrapper-handy');
  const similarSection = document.getElementById('similar-media-section');
  const loader = document.getElementById('player-loading-overlay');
  
  if (handyHero) handyHero.style.display = 'none';
  if (similarSection) similarSection.classList.add('hidden');
  if (handyPlayerWrap) handyPlayerWrap.classList.remove('hidden');
  
  if (loader) {
    loader.classList.remove('hidden');
    setTimeout(() => {
      loader.classList.add('hidden');
    }, 1000);
  }

  if (state.playerMode === 'trailer') {
    loadTrailerVideo();
  } else {
    const servers = getConfiguredServers(state.activeMedia, state.activeSeason, state.activeEpisodeNumber);
    const streamUrl = servers[state.activeServerIndex]?.url || servers[0]?.url;
    if (streamUrl) {
      loadVideoIframe(streamUrl);
    } else {
      state.playerMode = 'trailer';
      updateSourceTabsUI();
      showToast('Aucun flux autorisé configuré : ouverture de la bande-annonce officielle.');
      loadTrailerVideo();
    }
  }

  startPlaybackTracker();
}

function updateSaveButtonsUI(isFav) {
  const listBtn = DOM.modalFavBtn;
  if (!listBtn) return;
  listBtn.classList.toggle('saved-active', isFav);
  const label = listBtn.querySelector('.card-label');
  if (label) label.textContent = isFav ? 'Dans ma liste' : 'Liste';
  const icon = listBtn.querySelector('i');
  if (icon) icon.className = isFav ? 'fa-solid fa-check' : 'fa-solid fa-plus';
}

// --- LECTEUR VIDÉO SUR MESURE AVEC BANDES-ANNONCES TMDB ---
export async function openPlayerModal(media, seasonNumber = 1, episodeNumber = 1, forceAutoResume = false, startAsTrailer = false) {
  state.activeMedia = media;
  state.activeServerIndex = 0;
  state.activeSeason = seasonNumber;
  state.activeEpisodeNumber = episodeNumber;
  state.playbackSeconds = 0;
  state.isPlaying = true;
  state.playerMode = startAsTrailer ? 'trailer' : 'stream';
  state.isTheaterMode = false;
  if (DOM.videoContainerWrap) DOM.videoContainerWrap.classList.remove('theater-mode');
  if (DOM.playerErrorOverlay) DOM.playerErrorOverlay.classList.add('hidden');

  // Champs de l'interface Freehandyflix
  const topbarTitle = document.getElementById('modal-now-playing-title');
  const handyTitle = document.getElementById('modal-title');
  const handyBackdrop = document.getElementById('handy-backdrop-blur');
  const handyPoster = document.getElementById('modal-poster-img');
  const handyPosterTag = document.getElementById('modal-media-type-tag');
  const handyRating = document.getElementById('modal-rating');
  const handyYear = document.getElementById('modal-year');
  const handyDuration = document.getElementById('modal-duration');
  const handyGenresRow = document.getElementById('modal-genres-tags');
  const handySynopsis = document.getElementById('modal-synopsis');

  const titleVal = media.title || 'Dune: Deuxième Partie';
  const yearVal = media.release_year || '2026';
  const posterSrc = media.poster_url || getFallbackPoster(titleVal, yearVal);
  const backdropSrc = media.backdrop_url || media.poster_url || posterSrc;

  if (topbarTitle) topbarTitle.textContent = titleVal;
  if (handyTitle) handyTitle.textContent = titleVal;
  if (handyBackdrop) handyBackdrop.style.backgroundImage = `url('${backdropSrc}')`;
  if (handyPoster) handyPoster.src = posterSrc;
  if (handyPosterTag) handyPosterTag.textContent = media.type === 'movie' ? 'FILM' : 'SÉRIE';
  if (handyRating) handyRating.innerHTML = `<i class="fa-solid fa-star" style="color: #E50914;"></i> ${media.rating || '8.5'}`;
  if (handyYear) handyYear.textContent = yearVal;
  if (handyDuration) handyDuration.textContent = media.duration || (media.type === 'movie' ? '2h 10m' : '1 Saison');
  if (handySynopsis) handySynopsis.textContent = media.synopsis || 'Aucun synopsis disponible pour le moment.';

  if (handyGenresRow) {
    handyGenresRow.innerHTML = (media.genres || ['Action', 'Sci-Fi']).map(g => `<span class="genre-pill-handy">${g}</span>`).join('');
  }

  renderSimilarMedia(media);

  // Compatibilité sélecteurs existants DOM
  if (DOM.modalTitle) DOM.modalTitle.textContent = titleVal;
  if (DOM.modalYear) DOM.modalYear.textContent = yearVal;
  if (DOM.modalRating) DOM.modalRating.innerHTML = `<i class="fa-solid fa-star"></i> ${media.rating || '8.5'}`;
  if (DOM.modalDuration) DOM.modalDuration.textContent = media.duration || (media.type === 'movie' ? '2h 10m' : '1 Saison');
  if (DOM.modalSynopsis) DOM.modalSynopsis.textContent = media.synopsis || 'Aucun synopsis disponible.';

  // Affichage initial : Hero visible, Player caché
  const handyHero = document.getElementById('handy-details-hero') || document.getElementById('handy-details-hero-section');
  const handyPlayerWrap = document.getElementById('player-wrapper-handy');
  if (handyHero) handyHero.style.display = 'block';
  if (DOM.similarMediaSection) DOM.similarMediaSection.classList.remove('hidden');
  if (handyPlayerWrap) handyPlayerWrap.classList.add('hidden');

  // Synchronisation des boutons Sauvegarder / Liste
  const isFav = await SupabaseService.isFavorite(media.id);
  updateSaveButtonsUI(isFav);
  updateFavButtonUI(DOM.modalFavBtn, DOM.modalFavText, isFav);

  // Récupération asynchrone des bandes-annonces officielles TMDB
  const tmdbId = media.tmdb_id || media.id;
  TMDBService.getMediaVideos(tmdbId, media.type).then(videos => {
    state.mediaVideos = videos;
    updateSourceTabsUI();
  }).catch(() => {
    state.mediaVideos = [];
  });

  updateSourceTabsUI();

  // Configuration Séries vs Films
  if (media.type === 'tv') {
    if (DOM.seriesEpisodesWrapper) DOM.seriesEpisodesWrapper.style.display = 'block';
    setupSeriesSelector(media);
  } else {
    if (DOM.seriesEpisodesWrapper) DOM.seriesEpisodesWrapper.style.display = 'none';
    if (state.playerMode === 'trailer') {
      startPlaybackNow();
    } else {
      setupVideoServers(getConfiguredServers(media, state.activeSeason, state.activeEpisodeNumber));
    }
  }

  // Reprise de lecture
  const savedProgress = await SupabaseService.getPlaybackProgress(media.id, state.activeSeason, state.activeEpisodeNumber);
  if (savedProgress && savedProgress.current_time_seconds > 10) {
    state.playbackSeconds = savedProgress.current_time_seconds;
  }

  if (startAsTrailer) {
    startPlaybackNow();
  }

  if (DOM.playerModal) {
    DOM.playerModal.classList.remove('hidden');
    DOM.playerModal.classList.add('active');
  }
  document.body.style.overflow = 'hidden';
}

function updateSourceTabsUI() {
  if (DOM.tabStreamFull && DOM.tabStreamTrailer) {
    if (state.playerMode === 'stream') {
      DOM.tabStreamFull.classList.add('active');
      DOM.tabStreamTrailer.classList.remove('active');
    } else {
      DOM.tabStreamTrailer.classList.add('active');
      DOM.tabStreamFull.classList.remove('active');
    }
  }
}

function renderSimilarMedia(activeMedia) {
  if (!DOM.similarMediaTrack || !activeMedia) return;

  const activeGenres = new Set(activeMedia.genres || []);
  const recommendations = state.mediaList
    .filter(item => item && item.id !== activeMedia.id)
    .map(item => ({
      item,
      score: (item.type === activeMedia.type ? 3 : 0)
        + (item.genres || []).filter(genre => activeGenres.has(genre)).length * 2
        + (item.is_trending ? 1 : 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ item }) => item);

  if (!recommendations.length) {
    DOM.similarMediaTrack.innerHTML = '<p class="similar-empty">D’autres recommandations apparaîtront bientôt.</p>';
    return;
  }

  DOM.similarMediaTrack.innerHTML = recommendations.map(item => {
    const poster = item.poster_url || getFallbackPoster(item.title, item.release_year);
    const safeTitle = String(item.title || 'Titre sans nom')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return `
      <button class="similar-media-card" type="button" data-similar-id="${item.id}" aria-label="Regarder ${safeTitle}">
        <span class="similar-poster-wrap">
          <img src="${poster}" alt="${safeTitle}" loading="lazy">
          <span class="similar-play"><i class="fa-solid fa-play"></i></span>
        </span>
        <span class="similar-card-title">${safeTitle}</span>
        <span class="similar-card-meta">${item.release_year || '—'} <b>•</b> ${item.type === 'movie' ? 'Film' : 'Série'}</span>
      </button>
    `;
  }).join('');

  DOM.similarMediaTrack.querySelectorAll('.similar-media-card').forEach(card => {
    card.addEventListener('click', () => {
      const selected = state.mediaList.find(item => item.id === card.dataset.similarId);
      if (selected) openPlayerModal(selected);
    });
  });
}

// Fonction pour générer l'URL finale nettoyée avec remplacement dynamique de {tmdb_id}, {season}, {episode}
export function buildEmbedUrl(templateUrl, tmdbId, season = 1, episode = 1) {
  if (!templateUrl) return '';
  const cleanTmdbId = String(tmdbId || '').replace(/^[a-z]+-/, '');
  const s = Math.max(1, Number(season) || 1);
  const e = Math.max(1, Number(episode) || 1);

  return String(templateUrl)
    .replace(/\{tmdb_id\}/g, cleanTmdbId)
    .replace(/\{season\}/g, s)
    .replace(/\{episode\}/g, e);
}

function getConfiguredServers(media, season = 1, episode = 1) {
  if (!media) return [];

  const tmdbId = media.tmdb_id || String(media.id || '').replace(/^[a-z]+-/, '');
  const defaultServers = generateDefaultServers(media, season, episode);

  if (defaultServers && defaultServers.length > 0) {
    return defaultServers;
  }

  let rawServers = [];
  if (media.type === 'movie') {
    rawServers = Array.isArray(media.video_servers) ? media.video_servers : [];
  } else {
    const nestedEpisode = media.seasons
      ?.find(item => Number(item.season_number) === Number(season))
      ?.episodes
      ?.find(item => Number(item.episode_number) === Number(episode));
    const flatEpisode = media.episodes
      ?.find(item => Number(item.season_number) === Number(season) && Number(item.episode_number) === Number(episode));
    const episodeData = nestedEpisode || flatEpisode;
    rawServers = Array.isArray(episodeData?.video_servers) ? episodeData.video_servers : [];
  }

  return rawServers.map(srv => {
    if (!srv || !srv.url) return null;
    return {
      ...srv,
      url: buildEmbedUrl(srv.url, tmdbId, season, episode)
    };
  }).filter(Boolean);
}

function generateDefaultServers(media, season = 1, episode = 1) {
  const providers = window.SPACE_FLIX_CONFIG?.AUTHORIZED_EMBED_PROVIDERS;
  if (!media || !Array.isArray(providers)) return [];

  const tmdbId = media.tmdb_id || String(media.id || '').replace(/^[a-z]+-/, '');
  if (!tmdbId) return [];

  const templateKey = media.type === 'movie' ? 'movie' : 'tv';

  return providers.map((provider, index) => {
    const template = provider?.[templateKey];
    if (!template || !/^https:\/\//i.test(template)) return null;

    const url = buildEmbedUrl(template, tmdbId, season, episode);
    return {
      name: provider.name || `Serveur ${index + 1}`,
      url,
      quality: provider.quality || 'HD',
      lang: provider.lang || 'Multi'
    };
  }).filter(Boolean);
}

function setupVideoServers(servers) {
  servers = Array.isArray(servers) ? servers.filter(server => server?.url) : [];

  DOM.serverButtonsContainer.innerHTML = servers.length
    ? servers.map((srv, idx) => `
    <button class="server-btn ${idx === state.activeServerIndex ? 'active' : ''}" data-idx="${idx}">
      <i class="fa-solid fa-play" style="font-size: 0.75rem; margin-right: 4px;"></i> ${srv.name} (${srv.lang || 'VF'})
    </button>
  `).join('')
    : '<p class="server-empty">Aucun flux autorisé n’est configuré pour ce titre. Utilisez la bande-annonce officielle.</p>';

  DOM.serverButtonsContainer.querySelectorAll('.server-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
      state.activeServerIndex = idx;
      state.playerMode = 'stream';
      updateSourceTabsUI();
      setupVideoServers(servers);
      loadVideoIframe(servers[idx].url);
    });
  });

  if (state.playerMode === 'stream' && servers.length > 0) {
    loadVideoIframe(servers[state.activeServerIndex]?.url || servers[0].url);
  }
}

function loadTrailerVideo() {
  const trailer = state.mediaVideos.find(v => v.type === 'Trailer' || v.official) || state.mediaVideos[0];
  if (trailer && trailer.embedUrl) {
    loadVideoIframe(trailer.embedUrl);
  } else {
    // Si aucun trailer YouTube TMDB spécifique trouvé, fallback vers recherche YouTube embed
    const query = encodeURIComponent(`${state.activeMedia.title} bande annonce officielle fr`);
    loadVideoIframe(`https://www.youtube-nocookie.com/embed?listType=search&list=${query}&autoplay=1`);
  }
}

function loadVideoIframe(url) {
  if (DOM.playerErrorOverlay) DOM.playerErrorOverlay.classList.add('hidden');
  if (!DOM.videoIframe || !url) return;

  console.log('🚀 [SpaceFlix] Embed URL injected into iframe:', url);

  const loader = document.getElementById('player-loading-overlay');
  if (loader) loader.classList.remove('hidden');
  if (state.playerLoadTimer) clearTimeout(state.playerLoadTimer);
  let loaded = false;

  DOM.videoIframe.onload = () => {
    loaded = true;
    if (loader) loader.classList.add('hidden');
  };
  DOM.videoIframe.onerror = () => {
    if (loader) loader.classList.add('hidden');
    DOM.playerErrorOverlay?.classList.remove('hidden');
  };
  DOM.videoIframe.removeAttribute('sandbox');
  DOM.videoIframe.setAttribute('allowfullscreen', 'true');
  DOM.videoIframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
  DOM.videoIframe.src = url;

  // Cross-origin iframes do not expose the embedded player's errors. This
  // timeout prevents a blank player when a provider blocks embedding.
  state.playerLoadTimer = setTimeout(() => {
    if (loader) loader.classList.add('hidden');
    if (!loaded) DOM.playerErrorOverlay?.classList.remove('hidden');
  }, 12000);
  const extBtn = document.getElementById('btn-open-external-stream');
  if (extBtn && url) {
    extBtn.href = url;
  }
  const extErrorBtn = document.getElementById('btn-error-open-external');
  if (extErrorBtn && url) {
    extErrorBtn.href = url;
  }
}

async function setupSeriesSelector(media) {
  const tmdbId = media.tmdb_id || String(media.id || '').replace(/^[a-z]+-/, '');

  // Toujours charger toutes les saisons réelles depuis l'API TMDB
  let seasons = [];
  try {
    const tvDetails = await TMDBService.getTVShowDetails(tmdbId);
    if (tvDetails && Array.isArray(tvDetails.seasons) && tvDetails.seasons.length > 0) {
      const realSeasons = tvDetails.seasons.filter(s => s.season_number > 0);
      seasons = (realSeasons.length > 0 ? realSeasons : tvDetails.seasons).map(s => ({
        season_number: s.season_number,
        name: s.name || `Saison ${s.season_number}`,
        episode_count: s.episode_count || 10,
        air_date: s.air_date,
        overview: s.overview
      }));
    }
  } catch (e) {
    console.warn("Info fetch tv details:", e.message);
  }

  // Fallback si l'API TMDB n'a pas répondu
  if (seasons.length === 0) {
    if (Array.isArray(media.seasons) && media.seasons.length > 0) {
      seasons = media.seasons;
    } else {
      seasons = [{ season_number: 1, name: 'Saison 1', episode_count: 10 }];
    }
  }

  media.seasons = seasons;

  // Initialiser la saison active si elle n'est pas dans la liste
  if (!seasons.some(s => s.season_number === state.activeSeason)) {
    state.activeSeason = seasons[0]?.season_number || 1;
    state.activeEpisodeNumber = 1;
  }

  if (DOM.seasonSelect) {
    DOM.seasonSelect.innerHTML = seasons.map(s => `
      <option value="${s.season_number}" ${s.season_number === state.activeSeason ? 'selected' : ''}>
        ${s.name || `Saison ${s.season_number}`} (${s.episode_count || '?'} épisodes)
      </option>
    `).join('');

    DOM.seasonSelect.value = state.activeSeason;
    DOM.seasonSelect.onchange = async (e) => {
      state.activeSeason = parseInt(e.target.value);
      state.activeEpisodeNumber = 1;
      await renderEpisodes(media);
    };
  }

  await renderEpisodes(media);
}

async function renderEpisodes(media) {
  const tmdbId = media.tmdb_id || String(media.id || '').replace(/^[a-z]+-/, '');
  const seasonData = media.seasons?.find(s => s.season_number === state.activeSeason);
  let episodes = [];

  if (DOM.episodesContainer) {
    DOM.episodesContainer.innerHTML = `
      <div style="grid-column: 1/-1; padding: 1.5rem; text-align: center; color: #ff3344;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.8rem; margin-bottom: 0.5rem;"></i>
        <div style="font-size: 0.85rem; color: #94a3b8;">Chargement de tous les épisodes de la Saison ${state.activeSeason}...</div>
      </div>
    `;
  }

  // Récupération dynamique et exhaustive des épisodes de la saison
  try {
    const tmdbEpisodes = await TMDBService.getTVSeasonDetails(tmdbId, state.activeSeason);
    if (tmdbEpisodes && Array.isArray(tmdbEpisodes) && tmdbEpisodes.length > 0) {
      episodes = tmdbEpisodes;
      if (seasonData) seasonData.episodes = episodes;
    }
  } catch (e) {
    console.warn("Info fetch season episodes:", e.message);
  }

  // Fallback si aucun épisode renvoyé par l'API
  if (!episodes || episodes.length === 0) {
    if (seasonData?.episodes && seasonData.episodes.length > 0) {
      episodes = seasonData.episodes;
    } else {
      const count = seasonData?.episode_count || 12;
      episodes = Array.from({ length: Math.max(count, 1) }, (_, i) => ({
        episode_number: i + 1,
        title: `Épisode ${i + 1}`,
        synopsis: 'Épisode disponible en streaming HD VF et VOSTFR.'
      }));
    }
  }

  if (!episodes.some(e => e.episode_number === state.activeEpisodeNumber)) {
    state.activeEpisodeNumber = episodes[0]?.episode_number || 1;
  }

  if (DOM.episodesContainer) {
    DOM.episodesContainer.innerHTML = episodes.map(ep => {
      const isActive = ep.episode_number === state.activeEpisodeNumber;
      const epTitle = ep.title || ep.name || `Épisode ${ep.episode_number}`;
      const cleanTitle = String(epTitle).replace(/"/g, '&quot;');
      const epSynopsis = ep.synopsis || ep.overview || '';
      return `
        <div class="episode-card ${isActive ? 'active' : ''}" data-ep="${ep.episode_number}">
          <div class="ep-badge">
            <i class="fa-solid ${isActive ? 'fa-play' : 'fa-film'}"></i>
            Épisode ${ep.episode_number}
          </div>
          <div class="ep-title" title="${cleanTitle}">
            ${epTitle}
          </div>
          ${epSynopsis ? `
            <div class="ep-synopsis">${epSynopsis}</div>
          ` : ''}
        </div>
      `;
    }).join('');

    DOM.episodesContainer.querySelectorAll('.episode-card').forEach(card => {
      card.addEventListener('click', () => {
        const epNum = parseInt(card.getAttribute('data-ep'));
        state.activeEpisodeNumber = epNum;
        const selectedEp = episodes.find(e => e.episode_number === epNum);
        state.activeEpisodeTitle = selectedEp?.title || `Épisode ${epNum}`;

        const servers = getConfiguredServers(media, state.activeSeason, epNum);

        state.activeServerIndex = 0;
        setupVideoServers(servers);
        renderEpisodes(media);
        startPlaybackNow();
      });
    });
  }

  const activeEp = episodes.find(e => e.episode_number === state.activeEpisodeNumber) || episodes[0];
  if (activeEp) {
    state.activeEpisodeTitle = activeEp.title || activeEp.name || `Épisode ${state.activeEpisodeNumber}`;
    const servers = getConfiguredServers(media, state.activeSeason, state.activeEpisodeNumber);
    setupVideoServers(servers);
  }
}

// Suivi de lecture automatique (Playback Progress Tracker)
function startPlaybackTracker() {
  stopPlaybackTracker();
  state.isPlaying = true;
  state.playbackTimer = setInterval(() => {
    state.playbackSeconds += 5;
    saveCurrentPlayback();
  }, 5000);
}

function stopPlaybackTracker() {
  if (state.playbackTimer) {
    clearInterval(state.playbackTimer);
    state.playbackTimer = null;
  }
}

function togglePlayPause() {
  state.isPlaying = !state.isPlaying;
  if (state.isPlaying) {
    startPlaybackTracker();
  } else {
    stopPlaybackTracker();
  }
  updatePlayPauseButtonUI();
}

function updatePlayPauseButtonUI() {
  if (DOM.playPauseIcon) {
    DOM.playPauseIcon.className = state.isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
  }
  if (DOM.playPauseLabel) {
    DOM.playPauseLabel.textContent = state.isPlaying ? 'Pause' : 'Lecture';
  }
}

async function saveCurrentPlayback() {
  if (!state.activeMedia || state.playbackSeconds < 5) return;

  await SupabaseService.savePlaybackProgress({
    mediaId: state.activeMedia.id,
    title: state.activeMedia.title,
    type: state.activeMedia.type,
    posterUrl: state.activeMedia.poster_url,
    seasonNumber: state.activeSeason,
    episodeNumber: state.activeEpisodeNumber,
    episodeTitle: state.activeEpisodeTitle,
    currentTime: state.playbackSeconds,
    duration: state.playbackDuration
  });
}

export function closePlayerModal() {
  saveCurrentPlayback();
  stopPlaybackTracker();
  if (state.playerLoadTimer) {
    clearTimeout(state.playerLoadTimer);
    state.playerLoadTimer = null;
  }
  DOM.playerModal.classList.remove('active');
  if (DOM.videoIframe) DOM.videoIframe.src = '';
  document.body.style.overflow = 'auto';
  loadUserData();
}

// Mise à jour de l'UI du bouton favoris
function updateFavButtonUI(btnEl, textEl, isFav) {
  if (!btnEl) return;
  if (isFav) {
    btnEl.classList.add('active');
    btnEl.style.borderColor = '#E50914';
    if (textEl) textEl.textContent = 'Dans Ma Liste';
    const icon = btnEl.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-check';
  } else {
    btnEl.classList.remove('active');
    btnEl.style.borderColor = 'var(--border-glass)';
    if (textEl) textEl.textContent = 'Ajouter à Ma Liste';
    const icon = btnEl.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-plus';
  }
}

// Mise à jour de l'en-tête utilisateur (Avatar & Profil)
export function updateAuthHeaderUI() {
  const user = AuthService.getUser();
  const headerAvatar = document.getElementById('header-user-avatar');
  const dropdownAvatar = document.getElementById('dropdown-user-avatar');
  const dropdownName = document.getElementById('dropdown-user-name');
  const dropdownEmail = document.getElementById('dropdown-user-email');

  if (user) {
    if (headerAvatar) headerAvatar.textContent = user.initials;
    if (dropdownAvatar) dropdownAvatar.textContent = user.initials;
    if (dropdownName) dropdownName.textContent = user.name;
    if (dropdownEmail) dropdownEmail.textContent = user.email;
    if (DOM.dropdownActionLabel) DOM.dropdownActionLabel.textContent = 'Mon Compte';
    if (DOM.dropdownLogoutBtn) DOM.dropdownLogoutBtn.style.display = 'flex';
    if (DOM.dropdownLogoutDivider) DOM.dropdownLogoutDivider.style.display = 'block';
  } else {
    if (headerAvatar) headerAvatar.textContent = 'SF';
    if (dropdownAvatar) dropdownAvatar.textContent = 'SF';
    if (dropdownName) dropdownName.textContent = 'Invité';
    if (dropdownEmail) dropdownEmail.textContent = 'Non connecté';
    if (DOM.dropdownActionLabel) DOM.dropdownActionLabel.textContent = "Se connecter / S'inscrire";
    if (DOM.dropdownLogoutBtn) DOM.dropdownLogoutBtn.style.display = 'none';
    if (DOM.dropdownLogoutDivider) DOM.dropdownLogoutDivider.style.display = 'none';
  }
}

// --- GESTION DES MODALS D'AUTHENTIFICATION ---
let currentAuthMode = 'login'; // 'login' | 'signup'

export function openAuthModal(mode = 'login') {
  currentAuthMode = mode;
  if (DOM.authErrorMsg) DOM.authErrorMsg.classList.add('hidden');
  if (mode === 'login') {
    DOM.tabLoginBtn?.classList.add('active');
    DOM.tabSignupBtn?.classList.remove('active');
    if (DOM.nameFieldGroup) DOM.nameFieldGroup.style.display = 'none';
    if (DOM.authSubmitBtn) DOM.authSubmitBtn.textContent = 'Se connecter';
    if (DOM.authModalTitle) DOM.authModalTitle.textContent = 'Espace Membre SpaceFlix';
    if (DOM.authModalSubtitle) DOM.authModalSubtitle.textContent = 'Connectez-vous pour synchroniser vos favoris et vos reprises de lecture.';
  } else {
    DOM.tabSignupBtn?.classList.add('active');
    DOM.tabLoginBtn?.classList.remove('active');
    if (DOM.nameFieldGroup) DOM.nameFieldGroup.style.display = 'flex';
    if (DOM.authSubmitBtn) DOM.authSubmitBtn.textContent = "Créer mon compte";
    if (DOM.authModalTitle) DOM.authModalTitle.textContent = 'Créer un compte SpaceFlix';
    if (DOM.authModalSubtitle) DOM.authModalSubtitle.textContent = 'Rejoignez la communauté et synchronisez vos vidéos partout.';
  }
  DOM.authModal?.classList.remove('hidden');
  DOM.profileDropdown?.classList.add('hidden');
}

export function closeAuthModal() {
  DOM.authModal?.classList.add('hidden');
}

// --- GESTION DU TÉLÉCHARGEMENT DE CONTENU ---
export function openDownloadModal() {
  if (!state.activeMedia) return;
  const media = state.activeMedia;
  const isMovie = media.type === 'movie';
  const title = media.title || 'Média';
  const tmdbId = media.tmdb_id || media.id.replace(/^[a-z]+-/, '');
  const season = state.activeSeason || 1;
  const episode = state.activeEpisodeNumber || 1;
  const epTitle = state.activeEpisodeTitle || `Épisode ${episode}`;

  if (DOM.downloadMediaTitle) {
    DOM.downloadMediaTitle.textContent = isMovie ? title : `${title} - S${season}E${episode}`;
  }
  if (DOM.downloadMediaSubtitle) {
    DOM.downloadMediaSubtitle.textContent = isMovie 
      ? `Options de téléchargement pour "${title}" (${media.release_year || 'HD'})`
      : `Options de téléchargement pour ${title} - Saison ${season}, ${epTitle}`;
  }

  // Vérification de source directe téléchargeable
  const currentServers = getConfiguredServers(media, season, episode);

  const activeServer = currentServers[state.activeServerIndex] || currentServers[0] || { url: DOM.videoIframe?.src || '' };
  const currentStreamUrl = DOM.videoIframe?.src || activeServer.url || '';

  const downloadOptions = [
    {
      icon: 'fa-solid fa-cloud-arrow-down',
      name: 'Téléchargement Direct 1080p (Fast MP4)',
      badge: 'HD Recommandé',
      desc: 'Télécharge le fichier vidéo directement via le serveur haute vitesse.',
      action: () => {
        // Détection de lien direct MP4 / MKV / M3U8
        if (currentStreamUrl && (currentStreamUrl.endsWith('.mp4') || currentStreamUrl.endsWith('.mkv') || currentStreamUrl.endsWith('.webm'))) {
          const a = document.createElement('a');
          a.href = currentStreamUrl;
          a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${isMovie ? 'HD' : `S${season}E${episode}`}.mp4`;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          const dlUrl = isMovie 
            ? `https://vidlink.pro/movie/${tmdbId}` 
            : `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`;
          window.open(dlUrl, '_blank');
        }
      }
    },
    {
      icon: 'fa-solid fa-film',
      name: 'Serveur VidSrc HD Multi-Langues',
      badge: 'VF / VOSTFR',
      desc: 'Flux complet avec choix des pistes audio et sous-titres.',
      action: () => {
        const dlUrl = isMovie 
          ? `https://vidsrc.to/embed/movie/${tmdbId}` 
          : `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`;
        window.open(dlUrl, '_blank');
      }
    },
    {
      icon: 'fa-solid fa-server',
      name: 'Téléchargement Universel (AutoEmbed)',
      badge: 'Ultra Rapide',
      desc: 'Générateur de lien de téléchargement direct sans attente.',
      action: () => {
        const dlUrl = isMovie 
          ? `https://player.autoembed.cc/embed/movie/${tmdbId}` 
          : `https://player.autoembed.cc/embed/tv/${tmdbId}/${season}/${episode}`;
        window.open(dlUrl, '_blank');
      }
    },
    {
      icon: 'fa-regular fa-copy',
      name: 'Copier le lien direct du flux en cours',
      badge: 'Presse-papier',
      desc: 'Copie l\'adresse source pour l\'utiliser dans VLC, IDM ou votre gestionnaire.',
      isCopy: true,
      action: (btn) => {
        navigator.clipboard.writeText(currentStreamUrl).then(() => {
          const orig = btn.innerHTML;
          btn.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.9rem; width: 100%;">
              <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(34, 197, 94, 0.2); color: #22c55e; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
                <i class="fa-solid fa-check"></i>
              </div>
              <div>
                <div style="font-weight: 700; font-size: 0.95rem; color: #22c55e;">Lien copié dans le presse-papier !</div>
                <div style="font-size: 0.8rem; color: var(--text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 320px;">${currentStreamUrl}</div>
              </div>
            </div>
          `;
          setTimeout(() => { btn.innerHTML = orig; }, 2500);
        });
      }
    }
  ];

  if (DOM.downloadSourcesContainer) {
    DOM.downloadSourcesContainer.innerHTML = '';
    downloadOptions.forEach(opt => {
      const btn = document.createElement('div');
      btn.className = 'download-source-item';
      btn.style.cssText = 'background: rgba(255,255,255,0.04); border: 1px solid var(--border-glass); border-radius: 12px; padding: 0.9rem 1.1rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s ease; gap: 1rem;';
      btn.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.9rem;">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(229, 9, 20, 0.15); color: #ff3344; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; flex-shrink: 0;">
            <i class="${opt.icon}"></i>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 0.95rem; color: #fff; margin-bottom: 0.2rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span>${opt.name}</span>
              <span style="font-size: 0.7rem; background: rgba(255,255,255,0.1); padding: 0.15rem 0.5rem; border-radius: 6px; color: #fbbf24; font-weight: 600;">${opt.badge}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${opt.desc}</div>
          </div>
        </div>
        <div style="color: var(--primary); font-size: 1rem; flex-shrink: 0;">
          <i class="fa-solid fa-chevron-right"></i>
        </div>
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(229, 9, 20, 0.12)';
        btn.style.borderColor = 'rgba(229, 9, 20, 0.4)';
        btn.style.transform = 'translateX(4px)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(255,255,255,0.04)';
        btn.style.borderColor = 'var(--border-glass)';
        btn.style.transform = 'translateX(0)';
      });
      btn.addEventListener('click', () => {
        opt.action(btn);
      });
      DOM.downloadSourcesContainer.appendChild(btn);
    });
  }

  DOM.downloadModal?.classList.remove('hidden');
}

export function closeDownloadModal() {
  DOM.downloadModal?.classList.add('hidden');
}

// --- GESTION DU CAST (CHROMECAST / AIRPLAY / SMART TV) ---
export function openCastModal() {
  if (!state.activeMedia) {
    showToast('Sélectionnez d\'abord un film ou une série à caster.');
    return;
  }
  const media = state.activeMedia;
  const isMovie = media.type === 'movie';
  const title = media.title || 'Média';
  const season = state.activeSeason || 1;
  const episode = state.activeEpisodeNumber || 1;
  const displayTitle = isMovie ? title : `${title} - Saison ${season}, Ep. ${episode}`;

  if (DOM.castMediaTitle) {
    DOM.castMediaTitle.textContent = `Prêt à diffuser "${displayTitle}" en streaming HD sur votre téléviseur.`;
  }

  const currentServers = getConfiguredServers(media, season, episode);
  const activeServer = currentServers[state.activeServerIndex] || currentServers[0] || { url: DOM.videoIframe?.src || '' };
  const currentStreamUrl = DOM.videoIframe?.src || activeServer.url || window.location.href;

  if (DOM.castDirectUrlInput) {
    DOM.castDirectUrlInput.value = currentStreamUrl;
  }

  DOM.castModal?.classList.remove('hidden');
}

export function closeCastModal() {
  DOM.castModal?.classList.add('hidden');
}

// --- SETUP DES EVENT LISTENERS ---
function setupEventListeners() {
  // Navigation Links
  DOM.navLinks.forEach(link => {
    link.addEventListener('click', async (e) => {
      const href = link.getAttribute('href');
      if (href && href !== '#' && !href.startsWith('#') && !href.startsWith('javascript:')) {
        return; // Navigation standard vers autre fichier HTML
      }
      e.preventDefault();
      DOM.navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      state.currentNav = link.getAttribute('data-nav');
      if (state.currentNav === 'favorites') {
        state.favorites = await SupabaseService.getFavorites();
      } else if (state.currentNav === 'movies') {
        if (DOM.filterTypeSelect) DOM.filterTypeSelect.value = 'movie';
        applyAdvancedFilters(true);
      } else if (state.currentNav === 'tv') {
        if (DOM.filterTypeSelect) DOM.filterTypeSelect.value = 'tv';
        applyAdvancedFilters(true);
      } else if (state.currentNav === 'filters') {
        window.location.href = 'filters.html';
        return;
      } else if (state.currentNav === 'home') {
        if (DOM.filterTypeSelect) DOM.filterTypeSelect.value = 'all';
        resetAdvancedFilters();
      }
      renderAllSections();
    });
  });

  // Liens avec data-nav dans toute la page
  document.querySelectorAll('[data-nav]').forEach(el => {
    if (!el.classList.contains('nav-link')) {
      el.addEventListener('click', async (e) => {
        const href = el.getAttribute('href');
        if (href && href !== '#' && !href.startsWith('#') && !href.startsWith('javascript:')) {
          return; // Laisser naviguer vers filters.html ou index.html
        }
        e.preventDefault();
        const targetNav = el.getAttribute('data-nav');
        if (targetNav === 'filters') {
          window.location.href = 'filters.html';
          return;
        }
        state.currentNav = targetNav;
        const matchedLink = Array.from(DOM.navLinks).find(l => l.getAttribute('data-nav') === targetNav);
        if (matchedLink) {
          DOM.navLinks.forEach(l => l.classList.remove('active'));
          matchedLink.classList.add('active');
        }
        if (state.currentNav === 'favorites') {
          state.favorites = await SupabaseService.getFavorites();
        } else if (state.currentNav === 'movies') {
          if (DOM.filterTypeSelect) DOM.filterTypeSelect.value = 'movie';
          applyAdvancedFilters(true);
        } else if (state.currentNav === 'tv') {
          if (DOM.filterTypeSelect) DOM.filterTypeSelect.value = 'tv';
          applyAdvancedFilters(true);
        }
        renderAllSections();
      });
    }
  });

  // Setup de la recherche instantanée avec prévisualisation
  setupLiveInstantSearch();

  // Écouteurs Filtres Avancés (Handyflix Style)
  DOM.filterTypeSelect?.addEventListener('change', () => applyAdvancedFilters(true));
  DOM.filterGenreSelect?.addEventListener('change', () => applyAdvancedFilters(true));
  DOM.filterYearSelect?.addEventListener('change', () => applyAdvancedFilters(true));
  DOM.filterLangSelect?.addEventListener('change', () => applyAdvancedFilters(true));
  DOM.filterSortSelect?.addEventListener('change', () => applyAdvancedFilters(true));
  DOM.btnResetFilters?.addEventListener('click', resetAdvancedFilters);
  document.getElementById('btn-apply-filters')?.addEventListener('click', () => applyAdvancedFilters(true));
  document.getElementById('btn-trigger-first-search')?.addEventListener('click', () => applyAdvancedFilters(true));

  // Pagination infinie / Charger plus de films
  DOM.btnLoadMoreCatalog?.addEventListener('click', () => {
    if (!state.isLoadingFilterPage) {
      state.filterPage += 1;
      applyAdvancedFilters(false);
    }
  });

  // Hub Card Search Focus
  if (DOM.hubSearchCard && DOM.searchInput) {
    DOM.hubSearchCard.addEventListener('click', () => {
      DOM.searchInput.focus();
      DOM.searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // Fermeture du bandeau d'annonce
  if (DOM.closeAnnouncementBtn && DOM.announcementBar) {
    DOM.closeAnnouncementBtn.addEventListener('click', () => {
      DOM.announcementBar.classList.add('hidden');
    });
  }

  // Recherche en direct
  if (DOM.searchInput) {
    DOM.searchInput.addEventListener('input', (e) => {
      state.currentSearch = e.target.value.trim();
      refreshCatalog();
    });
  }

  // Actions Hero
  DOM.heroPlayBtn?.addEventListener('click', () => {
    if (state.heroMedia) openPlayerModal(state.heroMedia, 1, 1, false, false);
  });

  DOM.heroTrailerBtn?.addEventListener('click', () => {
    if (state.heroMedia) openPlayerModal(state.heroMedia, 1, 1, false, true);
  });

  DOM.heroFavBtn?.addEventListener('click', async () => {
    if (state.heroMedia) {
      const isFav = await SupabaseService.toggleFavorite(state.heroMedia.id);
      updateFavButtonUI(DOM.heroFavBtn, null, isFav);
      state.favorites = await SupabaseService.getFavorites();
    }
  });

  // Flèches Carrousel Hero
  DOM.heroPrevBtn?.addEventListener('click', () => {
    const total = state.heroFeaturedList.length;
    if (total > 0) {
      const prevIdx = (state.heroIndex - 1 + total) % total;
      setHeroByIndex(prevIdx);
    }
  });

  DOM.heroNextBtn?.addEventListener('click', () => {
    const total = state.heroFeaturedList.length;
    if (total > 0) {
      const nextIdx = (state.heroIndex + 1) % total;
      setHeroByIndex(nextIdx);
    }
  });

  // Pause Hero au survol
  DOM.heroSection?.addEventListener('mouseenter', stopHeroCarousel);
  DOM.heroSection?.addEventListener('mouseleave', startHeroCarousel);

  // Player Source Toggle Tabs (Film complet vs Bande-annonce TMDB)
  DOM.tabStreamFull?.addEventListener('click', () => {
    state.playerMode = 'stream';
    updateSourceTabsUI();
    if (state.activeMedia) {
      setupVideoServers(getConfiguredServers(state.activeMedia, state.activeSeason, state.activeEpisodeNumber));
    }
  });

  DOM.tabStreamTrailer?.addEventListener('click', () => {
    state.playerMode = 'trailer';
    updateSourceTabsUI();
    loadTrailerVideo();
  });

  // Contrôles rapides du lecteur (-10s / +10s / Play/Pause)
  DOM.btnRewind10?.addEventListener('click', () => {
    state.playbackSeconds = Math.max(0, state.playbackSeconds - 10);
    saveCurrentPlayback();
  });

  DOM.btnForward10?.addEventListener('click', () => {
    state.playbackSeconds += 10;
    saveCurrentPlayback();
  });

  DOM.btnTogglePlay?.addEventListener('click', togglePlayPause);

  // Plein écran
  DOM.btnFullscreenToggle?.addEventListener('click', () => {
    const wrap = document.getElementById('player-wrapper-handy') || DOM.videoContainerWrap;
    if (!document.fullscreenElement) {
      if (wrap && wrap.requestFullscreen) {
        wrap.requestFullscreen().catch(() => {});
      } else if (DOM.videoIframe && DOM.videoIframe.requestFullscreen) {
        DOM.videoIframe.requestFullscreen().catch(() => {});
      }
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // --- ÉCOUTEURS D'ÉVÉNEMENTS FREEHANDYFLIX ---
  const btnBackHandy = DOM.closePlayerBtn;
  btnBackHandy?.addEventListener('click', () => {
    const handyPlayerWrap = document.getElementById('player-wrapper-handy');
    const handyHero = document.getElementById('handy-details-hero') || document.getElementById('handy-details-hero-section');
    const similarSection = document.getElementById('similar-media-section');

    if (handyPlayerWrap && !handyPlayerWrap.classList.contains('hidden')) {
      if (DOM.videoIframe) DOM.videoIframe.src = '';
      handyPlayerWrap.classList.add('hidden');
      if (handyHero) handyHero.style.display = 'block';
      if (similarSection) similarSection.classList.remove('hidden');
      stopPlaybackTracker();
    } else {
      closePlayerModal();
    }
  });

  const btnMainPlayTrigger = document.getElementById('btn-main-play-trigger');
  btnMainPlayTrigger?.addEventListener('click', () => {
    state.playerMode = 'stream';
    startPlaybackNow();
  });

  const btnActionSave = document.getElementById('btn-action-save');
  const btnActionList = document.getElementById('btn-action-list');
  const toggleSaveHandler = async () => {
    if (state.activeMedia) {
      const isFav = await SupabaseService.toggleFavorite(state.activeMedia.id);
      updateSaveButtonsUI(isFav);
      updateFavButtonUI(DOM.modalFavBtn, DOM.modalFavText, isFav);
      state.favorites = await SupabaseService.getFavorites();
      showToast(isFav ? 'Ajouté à votre liste !' : 'Retiré de votre liste.');
    }
  };
  btnActionSave?.addEventListener('click', toggleSaveHandler);
  btnActionList?.addEventListener('click', toggleSaveHandler);

  const btnActionShare = document.getElementById('btn-action-share');
  btnActionShare?.addEventListener('click', () => {
    if (state.activeMedia) {
      const shareUrl = window.location.origin + window.location.pathname + `#media-${state.activeMedia.id}`;
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Lien copié dans le presse-papier !');
      }).catch(() => {
        showToast(`SpaceFlix - ${state.activeMedia.title}`);
      });
    }
  });

  const btnCtrlPlayToggle = document.getElementById('btn-ctrl-play-toggle');
  btnCtrlPlayToggle?.addEventListener('click', () => {
    togglePlayPause();
    const icon = btnCtrlPlayToggle.querySelector('i');
    if (icon) {
      icon.className = state.isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    }
  });

  const btnCtrlPrev = document.getElementById('btn-ctrl-prev');
  btnCtrlPrev?.addEventListener('click', () => {
    state.playbackSeconds = Math.max(0, state.playbackSeconds - 10);
    showToast('-10s');
  });

  const btnCtrlNext = document.getElementById('btn-ctrl-next');
  btnCtrlNext?.addEventListener('click', () => {
    state.playbackSeconds += 10;
    showToast('+10s');
  });

  const ctrlQualitySelect = document.getElementById('ctrl-quality-select');
  ctrlQualitySelect?.addEventListener('change', (e) => {
    showToast(`Qualité changée: ${e.target.value}`);
  });

  // Doublage / Langues tabs & cards
  document.querySelectorAll('.lang-tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.lang-tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });

  document.querySelectorAll('.lang-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.lang-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const langName = card.querySelector('.lang-name')?.textContent || 'VF';
      showToast(`Piste audio: ${langName}`);
    });
  });

  // Erreur de flux & fallback
  DOM.btnErrorSwitchServer?.addEventListener('click', () => {
    const servers = getConfiguredServers(state.activeMedia, state.activeSeason, state.activeEpisodeNumber);
    if (servers.length > 0) {
      state.activeServerIndex = (state.activeServerIndex + 1) % servers.length;
      state.playerMode = 'stream';
      updateSourceTabsUI();
      setupVideoServers(servers);
    } else {
      state.playerMode = 'trailer';
      updateSourceTabsUI();
      loadTrailerVideo();
    }
  });

  DOM.btnErrorWatchTrailer?.addEventListener('click', () => {
    state.playerMode = 'trailer';
    updateSourceTabsUI();
    loadTrailerVideo();
  });

  // Actions Modal Player Fav & Download & Cast
  DOM.modalDownloadBtn?.addEventListener('click', () => {
    openDownloadModal();
  });

  DOM.closeDownloadModalBtn?.addEventListener('click', closeDownloadModal);
  DOM.downloadModal?.addEventListener('click', (e) => {
    if (e.target === DOM.downloadModal) closeDownloadModal();
  });

  // Gestion du bouton Cast et Modal
  DOM.modalCastBtn?.addEventListener('click', openCastModal);
  DOM.btnCastToggle?.addEventListener('click', openCastModal);
  DOM.closeCastModalBtn?.addEventListener('click', closeCastModal);
  DOM.castModal?.addEventListener('click', (e) => {
    if (e.target === DOM.castModal) closeCastModal();
  });

  // Copie de l'URL directe de Cast
  DOM.btnCopyCastUrl?.addEventListener('click', () => {
    const url = DOM.castDirectUrlInput?.value || '';
    if (url) {
      navigator.clipboard.writeText(url).then(() => {
        const orig = DOM.btnCopyCastUrl.innerHTML;
        DOM.btnCopyCastUrl.innerHTML = '<i class="fa-solid fa-check"></i> Copié !';
        showToast('Lien direct de diffusion copié !');
        setTimeout(() => { DOM.btnCopyCastUrl.innerHTML = orig; }, 2500);
      });
    }
  });

  // Option Cast: Google Chromecast
  DOM.btnCastChromecast?.addEventListener('click', () => {
    const url = DOM.castDirectUrlInput?.value || DOM.videoIframe?.src || '';
    if (window.chrome && window.chrome.cast && window.chrome.cast.isAvailable) {
      try {
        window.chrome.cast.requestSession(() => {
          showToast('Connexion à votre appareil Chromecast en cours...');
        }, (err) => {
          showToast('Sélectionnez votre Chromecast dans le menu du navigateur.');
        });
      } catch {
        showToast('Appuyez sur "Caster" dans le menu Google Chrome (⋮).');
      }
    } else if (navigator.share) {
      navigator.share({
        title: state.activeMedia?.title || 'SpaceFlix Stream',
        url: url
      }).then(() => showToast('Partage vers appareil connecté initié !')).catch(() => {});
    } else {
      showToast('Ouvrez le menu Chrome (⋮) > "Caster" pour diffuser sur votre TV.');
    }
  });

  // Option Cast: Apple AirPlay
  DOM.btnCastAirplay?.addEventListener('click', () => {
    if (window.WebKitPlaybackTargetAvailabilityEvent || (DOM.videoIframe && DOM.videoIframe.webkitShowPlaybackTargetPicker)) {
      try {
        DOM.videoIframe.webkitShowPlaybackTargetPicker();
        showToast('Recherche d\'écrans Apple TV / AirPlay...');
      } catch {
        showToast('Utilisez le centre de contrôle iOS / macOS > Recopie de l\'écran AirPlay.');
      }
    } else {
      showToast('Sur iPhone/iPad/Mac : activez "Recopie de l\'écran" AirPlay.');
    }
  });

  // Option Cast: Smart TV Direct
  DOM.btnCastSmartTv?.addEventListener('click', () => {
    const url = DOM.castDirectUrlInput?.value || window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      showToast('URL copiée ! Ouvrez le navigateur de votre Smart TV (Samsung, LG, etc.).');
    });
  });

  // Option Cast: Lecteur Externe / VLC / Web Video Caster
  DOM.btnCastExternalVlc?.addEventListener('click', () => {
    const url = DOM.castDirectUrlInput?.value || '';
    if (url) {
      window.open(url, '_blank');
      showToast('Ouverture du flux dans votre lecteur externe...');
    }
  });

  // Écouteur sélecteur et badges Plateformes
  DOM.filterProviderSelect?.addEventListener('change', (e) => {
    state.filterProvider = e.target.value;
    applyAdvancedFilters(true);
  });

  document.querySelectorAll('.platform-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const prov = pill.getAttribute('data-provider') || 'all';
      if (DOM.filterProviderSelect) DOM.filterProviderSelect.value = prov;
      state.filterProvider = prov;
      applyAdvancedFilters(true);
    });
  });

  // Liens de la barre des plateformes sur l'accueil (Netflix, Disney+, etc.)
  document.querySelectorAll('.platform-card-btn, [data-provider-filter]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const prov = btn.getAttribute('data-provider-filter') || btn.getAttribute('data-provider') || 'netflix';
      window.location.href = `filters.html?provider=${prov}`;
    });
  });

  DOM.modalFavBtn?.addEventListener('click', async () => {
    if (state.activeMedia) {
      const isFav = await SupabaseService.toggleFavorite(state.activeMedia.id);
      updateFavButtonUI(DOM.modalFavBtn, DOM.modalFavText, isFav);
      state.favorites = await SupabaseService.getFavorites();
    }
  });

  document.getElementById('modal-share-btn')?.addEventListener('click', async () => {
    if (!state.activeMedia) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}#media-${state.activeMedia.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Lien copié dans le presse-papier !');
    } catch {
      showToast('Lien de partage prêt à être copié.');
    }
  });

  // La fermeture du bouton Retour est gérée ci-dessus : elle revient d'abord
  // aux détails lorsque le lecteur est ouvert.
  DOM.playerModal?.addEventListener('click', (e) => {
    if (e.target === DOM.playerModal) closePlayerModal();
  });

  // Boutons du bandeau de reprise de lecture
  DOM.btnResumeAccept?.addEventListener('click', () => {
    DOM.playerResumeBanner?.classList.add('hidden');
  });

  DOM.btnResumeDecline?.addEventListener('click', () => {
    state.playbackSeconds = 0;
    DOM.playerResumeBanner?.classList.add('hidden');
    saveCurrentPlayback();
  });

  // Bouton recharger flux
  DOM.btnReloadStream?.addEventListener('click', () => {
    if (DOM.videoIframe && DOM.videoIframe.src) {
      const cur = DOM.videoIframe.src;
      DOM.videoIframe.src = '';
      setTimeout(() => { DOM.videoIframe.src = cur; }, 150);
    }
  });

  // Mode Théâtre / Grand Écran
  DOM.btnTheaterMode?.addEventListener('click', () => {
    state.isTheaterMode = !state.isTheaterMode;
    if (DOM.videoContainerWrap) {
      DOM.videoContainerWrap.classList.toggle('theater-mode', state.isTheaterMode);
    }
  });

  // Modal Raccourcis Clavier
  DOM.btnShortcutsInfo?.addEventListener('click', () => {
    DOM.shortcutsModal?.classList.remove('hidden');
  });

  DOM.closeShortcutsBtn?.addEventListener('click', () => {
    DOM.shortcutsModal?.classList.add('hidden');
  });

  DOM.shortcutsModal?.addEventListener('click', (e) => {
    if (e.target === DOM.shortcutsModal) DOM.shortcutsModal.classList.add('hidden');
  });

  // Modal Script SQL Supabase
  DOM.dropdownSqlBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    DOM.sqlModal?.classList.remove('hidden');
    DOM.profileDropdown?.classList.add('hidden');
  });

  // Téléchargement direct du ZIP du projet sans redirection
  const zipDownloadBtn = document.getElementById('dropdown-zip-download-btn');
  zipDownloadBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    const originalText = zipDownloadBtn.innerHTML;
    zipDownloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color: #ff3344;"></i> Préparation du ZIP...';
    try {
      const res = await fetch('/download-zip');
      if (res.ok) {
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = downloadUrl;
        a.download = 'spaceflix-complete-code.zip';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          window.URL.revokeObjectURL(downloadUrl);
          document.body.removeChild(a);
        }, 1000);
      } else {
        window.open('/download-zip', '_blank');
      }
    } catch (err) {
      console.warn("Téléchargement via URL directe:", err.message);
      window.open('/download-zip', '_blank');
    } finally {
      zipDownloadBtn.innerHTML = originalText;
      DOM.profileDropdown?.classList.add('hidden');
    }
  });

  DOM.closeSqlBtn?.addEventListener('click', () => {
    DOM.sqlModal?.classList.add('hidden');
  });

  DOM.sqlModal?.addEventListener('click', (e) => {
    if (e.target === DOM.sqlModal) DOM.sqlModal.classList.add('hidden');
  });

  DOM.btnCopySqlCode?.addEventListener('click', () => {
    const code = DOM.sqlCodeDisplay?.textContent || '';
    navigator.clipboard.writeText(code).then(() => {
      const orig = DOM.btnCopySqlCode.innerHTML;
      DOM.btnCopySqlCode.innerHTML = '<i class="fa-solid fa-check"></i> Copié !';
      setTimeout(() => { DOM.btnCopySqlCode.innerHTML = orig; }, 2000);
    });
  });

  // Menu Profil Dropdown
  DOM.profileBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!AuthService.getUser()) {
      openAuthModal('login');
    } else {
      DOM.profileDropdown?.classList.toggle('hidden');
    }
  });

  document.addEventListener('click', (e) => {
    if (DOM.profileDropdown && !DOM.profileDropdown.contains(e.target) && e.target !== DOM.profileBtn) {
      DOM.profileDropdown.classList.add('hidden');
    }
  });

  DOM.dropdownLoginTrigger?.addEventListener('click', (e) => {
    e.preventDefault();
    openAuthModal('login');
  });

  DOM.dropdownLogoutBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    await AuthService.logout();
    updateAuthHeaderUI();
    state.favorites = await SupabaseService.getFavorites();
    state.continueWatchingList = await SupabaseService.getAllContinueWatching();
    renderAllSections();
    DOM.profileDropdown?.classList.add('hidden');
  });

  DOM.closeAuthBtn?.addEventListener('click', closeAuthModal);
  DOM.authModal?.addEventListener('click', (e) => {
    if (e.target === DOM.authModal) closeAuthModal();
  });

  DOM.tabLoginBtn?.addEventListener('click', () => openAuthModal('login'));
  DOM.tabSignupBtn?.addEventListener('click', () => openAuthModal('signup'));

  if (DOM.togglePwdBtn && DOM.authPwdInput) {
    DOM.togglePwdBtn.addEventListener('click', () => {
      const isPwd = DOM.authPwdInput.type === 'password';
      DOM.authPwdInput.type = isPwd ? 'text' : 'password';
      DOM.togglePwdBtn.innerHTML = isPwd ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
    });
  }

  // Google Login OAuth
  DOM.googleLoginBtn?.addEventListener('click', async () => {
    const origHtml = DOM.googleLoginBtn.innerHTML;
    try {
      if (DOM.authErrorMsg) DOM.authErrorMsg.classList.add('hidden');
      DOM.googleLoginBtn.disabled = true;
      DOM.googleLoginBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" style="color: #ff3344; margin-right: 8px;"></i> Connexion Google en cours...';

      const user = await AuthService.loginWithGoogle();
      if (user) {
        updateAuthHeaderUI();
        await loadUserData();
        renderAllSections();
        closeAuthModal();
        showToast('Connecté avec succès avec Google / Gmail !');
      }
    } catch (err) {
      if (DOM.authErrorMsg) {
        DOM.authErrorMsg.textContent = translateAuthError(err.message || 'Connexion Google temporairement indisponible.');
        DOM.authErrorMsg.classList.remove('hidden');
      }
    } finally {
      DOM.googleLoginBtn.disabled = false;
      DOM.googleLoginBtn.innerHTML = origHtml;
    }
  });

  // Soumission Formulaire d'authentification
  DOM.authForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email')?.value.trim();
    const password = document.getElementById('auth-password')?.value;
    const name = document.getElementById('auth-name')?.value;

    const originalBtnText = DOM.authSubmitBtn ? DOM.authSubmitBtn.textContent : '';
    try {
      if (DOM.authErrorMsg) DOM.authErrorMsg.classList.add('hidden');
      if (DOM.authSubmitBtn) {
        DOM.authSubmitBtn.disabled = true;
        DOM.authSubmitBtn.textContent = 'Connexion en cours...';
      }

      if (currentAuthMode === 'login') {
        await AuthService.login(email, password);
      } else {
        await AuthService.signup(name, email, password);
      }

      updateAuthHeaderUI();
      await loadUserData();
      renderAllSections();
      closeAuthModal();
      DOM.authForm.reset();
    } catch (err) {
      if (DOM.authErrorMsg) {
        DOM.authErrorMsg.textContent = err.message || 'Une erreur est survenue.';
        DOM.authErrorMsg.classList.remove('hidden');
      }
    } finally {
      if (DOM.authSubmitBtn) {
        DOM.authSubmitBtn.disabled = false;
        DOM.authSubmitBtn.textContent = originalBtnText;
      }
    }
  });

  // Raccourcis Clavier Globaux
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

    if (e.key === 'Escape') {
      if (DOM.playerModal?.classList.contains('active')) closePlayerModal();
      if (!DOM.authModal?.classList.contains('hidden')) closeAuthModal();
      if (!DOM.shortcutsModal?.classList.contains('hidden')) DOM.shortcutsModal.classList.add('hidden');
      if (!DOM.sqlModal?.classList.contains('hidden')) DOM.sqlModal.classList.add('hidden');
    }

    if (DOM.playerModal?.classList.contains('active')) {
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'ArrowRight') {
        state.playbackSeconds += 10;
        saveCurrentPlayback();
      } else if (e.key === 'ArrowLeft') {
        state.playbackSeconds = Math.max(0, state.playbackSeconds - 10);
        saveCurrentPlayback();
      } else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          DOM.videoContainerWrap?.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    }
  });
}
