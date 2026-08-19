/**
 * HANDYFLIX PRO - Complete Application Controller
 * Gère le Hero Spotlight (Sterling Point, Reacher, etc.), les miniatures Hero,
 * la capsule navigation (Home, Trending, List, TV), les carrousels de catégories,
 * le moteur de recherche Spotlight (⌘K), les tiroirs et le lecteur multi-serveurs HD.
 */

import { HERO_FEATURED_ITEMS, CATEGORIES_CONFIG, INITIAL_MEDIA, FAQ_DATA } from '../lib/data.js';
import { TMDB } from '../lib/tmdbClient.js';
import { SupabaseService } from '../lib/supabaseClient.js';

// Configuration Multi-Serveurs
const CONFIG = {
  PROVIDERS: window.SPACE_FLIX_CONFIG?.AUTHORIZED_EMBED_PROVIDERS || [
    {
      name: 'Serveur 1 - VidSrc CC (1080P VF/FR)',
      movie: 'https://vidsrc.cc/v2/embed/movie/{tmdb_id}?ds_lang=fr',
      tv: 'https://vidsrc.cc/v2/embed/tv/{tmdb_id}/{season}/{episode}?ds_lang=fr'
    },
    {
      name: 'Serveur 2 - VidLink (Multi-Audio VF)',
      movie: 'https://vidlink.pro/movie/{tmdb_id}?primaryColor=e50914',
      tv: 'https://vidlink.pro/tv/{tmdb_id}/{season}/{episode}?primaryColor=e50914'
    },
    {
      name: 'Serveur 3 - FrenchEmbed (100% VF)',
      movie: 'https://frembed.icu/api/film.php?id={tmdb_id}',
      tv: 'https://frembed.icu/api/serie.php?id={tmdb_id}&sa={season}&epi={episode}'
    },
    {
      name: 'Serveur 4 - VidSrc Pro (HD Fast)',
      movie: 'https://vidsrc.xyz/embed/movie/{tmdb_id}',
      tv: 'https://vidsrc.xyz/embed/tv/{tmdb_id}/{season}/{episode}'
    },
    {
      name: 'Serveur 5 - SmashyStream (FR)',
      movie: 'https://player.smashy.stream/movie/{tmdb_id}',
      tv: 'https://player.smashy.stream/tv/{tmdb_id}?s={season}&e={episode}'
    }
  ]
};

// État Global de l'Application
const STATE = {
  currentNav: 'all',
  currentHeroIndex: 0,
  heroAutoRotateTimer: null,
  currentMedia: null,
  currentSeason: 1,
  currentEpisode: 1,
  currentServerIndex: 0,
  allMediaList: [...INITIAL_MEDIA],
  dynamicCategories: [...CATEGORIES_CONFIG]
};

// =========================================================================
// 1. SPLASH SCREEN & INITIALISATION DYNAMIQUE
// =========================================================================

async function initSplashScreen() {
  const splash = document.getElementById('app-splash-screen');
  const letters = document.querySelectorAll('.splash-letter');
  const progressFill = document.getElementById('splash-progress-fill');
  const statusText = document.getElementById('splash-status-text');

  setTimeout(() => {
    letters.forEach((l) => l.classList.add('revealed'));
  }, 100);

  const updateProgress = (target, text) => {
    if (progressFill) progressFill.style.width = `${target}%`;
    if (statusText && text) statusText.textContent = text;
  };

  updateProgress(30, 'Connexion aux flux HD...');

  // Rendu instantané initial
  setupHeroSpotlight();
  renderAllCategoryRows(STATE.dynamicCategories);
  renderFAQ();
  updateProgress(60, 'Synchronisation TMDB en direct...');

  // Chargement asynchrone des flux en temps réel
  loadLiveTMDBData().then(() => {
    updateProgress(90, 'Catalogue actualisé en direct');
  }).catch(() => {}).finally(() => {
    updateProgress(100, 'Prêt');
    setTimeout(() => {
      if (splash) {
        splash.classList.add('fade-out');
        setTimeout(() => splash.remove(), 600);
      }
    }, 250);
  });
}

/**
 * Charge dynamiquement les flux TMDB en temps réel (Tendances, Populaires, Séries, Sorties)
 */
async function loadLiveTMDBData() {
  try {
    const [trending, popMovies, popTV, nowPlaying] = await Promise.allSettled([
      TMDB.getTrending('day'),
      TMDB.getPopularMovies(1),
      TMDB.getPopularTV(1),
      TMDB.getNowPlayingMovies(1)
    ]);

    const liveTrending = trending.status === 'fulfilled' && trending.value?.length ? trending.value : [];
    const liveMovies = popMovies.status === 'fulfilled' && popMovies.value?.length ? popMovies.value : [];
    const liveTV = popTV.status === 'fulfilled' && popTV.value?.length ? popTV.value : [];
    const liveNowPlaying = nowPlaying.status === 'fulfilled' && nowPlaying.value?.length ? nowPlaying.value : [];

    // Fusionner dans la liste globale
    const allFetched = [...liveTrending, ...liveMovies, ...liveTV, ...liveNowPlaying];
    const uniqueMap = new Map();
    [...allFetched, ...INITIAL_MEDIA].forEach(item => {
      if (!uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item);
      }
    });
    STATE.allMediaList = Array.from(uniqueMap.values());

    // Mettre à jour les catégories dynamiques
    const dynamicCats = [];

    if (liveTrending.length > 0) {
      dynamicCats.push({
        id: 'trending-now',
        name: 'Tendances du Jour (En Direct TMDB)',
        items: liveTrending.slice(0, 12)
      });
    }

    if (liveNowPlaying.length > 0) {
      dynamicCats.push({
        id: 'now-playing',
        name: 'Nouveautés & Sorties Récentes HD',
        items: liveNowPlaying.slice(0, 12)
      });
    }

    if (liveTV.length > 0) {
      dynamicCats.push({
        id: 'popular-tv',
        name: 'Séries TV Populaires en Streaming',
        items: liveTV.slice(0, 12)
      });
    }

    if (liveMovies.length > 0) {
      dynamicCats.push({
        id: 'popular-movies',
        name: 'Films Incontournables & Mieux Notés',
        items: liveMovies.slice(0, 12)
      });
    }

    // Si des catégories ont été récupérées, mettre à jour l'affichage
    if (dynamicCats.length > 0) {
      STATE.dynamicCategories = dynamicCats;
      renderAllCategoryRows(STATE.dynamicCategories);
    }

    // Mettre à jour le Hero Spotlight avec les 5 meilleurs films en tendance
    if (liveTrending.length >= 3) {
      setupHeroSpotlight(liveTrending.slice(0, 5));
    }
  } catch (err) {
    console.warn('[HANDYFLIX] Synchronisation TMDB automatique en arrière-plan:', err);
  }
}

// =========================================================================
// 2. HERO FEATURED SPOTLIGHT (AUTO-ROTATIF & DYNAMIQUE)
// =========================================================================

function setupHeroSpotlight(customItems = null) {
  const heroItems = customItems || (HERO_FEATURED_ITEMS && HERO_FEATURED_ITEMS.length > 0
    ? HERO_FEATURED_ITEMS
    : STATE.allMediaList.slice(0, 6));

  if (!heroItems || heroItems.length === 0) return;

  STATE.currentHeroIndex = Math.min(STATE.currentHeroIndex, heroItems.length - 1);
  renderHeroActiveItem(heroItems[STATE.currentHeroIndex]);
  renderHeroThumbnails(heroItems);

  // Auto-rotation du Hero toutes les 7 secondes
  if (STATE.heroAutoRotateTimer) clearInterval(STATE.heroAutoRotateTimer);
  STATE.heroAutoRotateTimer = setInterval(() => {
    STATE.currentHeroIndex = (STATE.currentHeroIndex + 1) % heroItems.length;
    renderHeroActiveItem(heroItems[STATE.currentHeroIndex]);
    const thumbs = document.querySelectorAll('.hero-thumb-card');
    thumbs.forEach((t, idx) => {
      t.classList.toggle('active', idx === STATE.currentHeroIndex);
    });
  }, 7000);

  // Bouton "Watch now" dans le Hero
  const watchBtn = document.getElementById('hero-watch-now-btn');
  if (watchBtn) {
    watchBtn.onclick = () => {
      const activeItem = heroItems[STATE.currentHeroIndex];
      if (activeItem) openStreamModal(activeItem);
    };
  }

  // Bouton "+" dans le Hero
  const plusBtn = document.getElementById('hero-plus-btn');
  if (plusBtn) {
    plusBtn.onclick = async () => {
      const activeItem = heroItems[STATE.currentHeroIndex];
      if (!activeItem) return;
      const added = await SupabaseService.toggleFavorite(activeItem.id);
      plusBtn.innerHTML = added
        ? '<i class="fa-solid fa-check" style="color:#4ade80;"></i>'
        : '<i class="fa-solid fa-plus"></i>';
      showToast(added ? `Ajouté à votre liste : ${activeItem.title}` : `Retiré de votre liste`);
    };
  }
}

function renderHeroActiveItem(item) {
  if (!item) return;

  const backdropImg = document.getElementById('hero-backdrop-img');
  const mainTitle = document.getElementById('hero-main-title');
  const ratingVal = document.getElementById('hero-rating-val');
  const yearVal = document.getElementById('hero-year-val');
  const genreVal = document.getElementById('hero-genre-val');
  const synopsisVal = document.getElementById('hero-synopsis-val');
  const posterImg = document.getElementById('hero-poster-img');
  const badgeTag = document.getElementById('hero-badge-tag');
  const typeLabel = document.getElementById('hero-type-label');

  if (backdropImg) {
    backdropImg.src = item.backdrop_url || item.poster_url;
    backdropImg.onerror = () => {
      backdropImg.src = 'https://image.tmdb.org/t/p/original/ebLym6w04CzYJBLZScB1rrzm6uY.jpg';
    };
  }

  if (mainTitle) mainTitle.textContent = item.title;
  if (ratingVal) ratingVal.textContent = item.rating || '8.2';
  if (yearVal) yearVal.textContent = item.release_year || '2026';
  const genreTxt = Array.isArray(item.genres) ? item.genres.join(', ') : (item.genre || 'Action, Thriller');
  if (genreVal) genreVal.textContent = genreTxt;
  if (synopsisVal) synopsisVal.textContent = item.synopsis || 'Découvrez ce titre incontournable en haute définition sur HANDYFLIX.';

  if (posterImg) {
    posterImg.src = item.poster_url;
    posterImg.onerror = () => {
      posterImg.src = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80';
    };
  }

  if (badgeTag) badgeTag.textContent = 'NOW SHOWING';
  if (typeLabel) typeLabel.textContent = item.type === 'tv' ? 'SERIES' : 'MOVIE';
}

function renderHeroThumbnails(items) {
  const carousel = document.getElementById('hero-thumbnails-carousel');
  if (!carousel) return;

  carousel.innerHTML = items.map((item, idx) => `
    <div class="hero-thumb-card ${idx === STATE.currentHeroIndex ? 'active' : ''}" data-index="${idx}">
      <img src="${item.backdrop_url || item.poster_url}" alt="${item.title}" class="hero-thumb-img" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80';">
    </div>
  `).join('');

  carousel.querySelectorAll('.hero-thumb-card').forEach(card => {
    card.addEventListener('click', () => {
      carousel.querySelectorAll('.hero-thumb-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      STATE.currentHeroIndex = Number(card.dataset.index);
      renderHeroActiveItem(items[STATE.currentHeroIndex]);
    });
  });
}

// =========================================================================
// 3. RENDU DES CATÉGORIES (CARROUSELS HORIZONTAUX AVEC ICÔNES SVG)
// =========================================================================

function getCategoryIconSVG(catId) {
  if (catId.includes('trending')) {
    // Fire / Trending Flame SVG
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4b55" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:text-bottom; margin-right:8px; filter: drop-shadow(0 0 6px rgba(255,75,85,0.5));"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
  } else if (catId.includes('now') || catId.includes('movie')) {
    // Film Clapper / Cinema Reel SVG
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:text-bottom; margin-right:8px; filter: drop-shadow(0 0 6px rgba(56,189,248,0.5));"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>`;
  } else if (catId.includes('tv') || catId.includes('serie')) {
    // TV Monitor Screen SVG
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:text-bottom; margin-right:8px; filter: drop-shadow(0 0 6px rgba(168,85,247,0.5));"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>`;
  } else if (catId.includes('popular') || catId.includes('top')) {
    // Star Rating SVG
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:text-bottom; margin-right:8px; filter: drop-shadow(0 0 6px rgba(251,191,36,0.5));"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  } else if (catId.includes('list') || catId.includes('fav')) {
    // Bookmark / List SVG
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="#38bdf8" stroke="#38bdf8" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:text-bottom; margin-right:8px; filter: drop-shadow(0 0 6px rgba(56,189,248,0.5));"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
  }
  // Default Play Stream SVG
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:text-bottom; margin-right:8px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
}

function renderAllCategoryRows(categories) {
  const container = document.getElementById('main-catalog-container');
  if (!container) return;

  container.innerHTML = categories.map(cat => `
    <section class="category-row" id="row-${cat.id}">
      <div class="category-header">
        <div class="category-title-wrap">
          <h2 class="category-title">${getCategoryIconSVG(cat.id)}${cat.name}</h2>
          <div class="category-accent-bar"></div>
        </div>
        <div class="carousel-nav-arrows">
          <button class="carousel-arrow-btn prev-btn" data-target="carousel-${cat.id}" aria-label="Précédent">
            <i class="fa-solid fa-chevron-left"></i>
          </button>
          <button class="carousel-arrow-btn next-btn" data-target="carousel-${cat.id}" aria-label="Suivant">
            <i class="fa-solid fa-chevron-right"></i>
          </button>
        </div>
      </div>

      <div class="category-carousel" id="carousel-${cat.id}">
        ${cat.items.map(createPosterCardHTML).join('')}
      </div>
    </section>
  `).join('');

  // Clic sur les affiches
  container.querySelectorAll('.pro-card').forEach(card => {
    card.addEventListener('click', () => {
      const mediaId = card.dataset.id;
      const media = STATE.allMediaList.find(m => String(m.id) === String(mediaId));
      if (media) openStreamModal(media);
    });
  });

  // Flèches de défilement horizontal
  container.querySelectorAll('.carousel-arrow-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const carousel = document.getElementById(targetId);
      if (!carousel) return;
      const scrollAmount = carousel.clientWidth * 0.75;
      if (btn.classList.contains('prev-btn')) {
        carousel.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        carousel.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    });
  });
}

export function getFallbackPoster(title = 'Film HD') {
  const safe = (title || 'Film').replace(/</g, '').replace(/>/g, '').replace(/"/g, '').slice(0, 24);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090a12"/>
        <stop offset="60%" stop-color="#151624"/>
        <stop offset="100%" stop-color="#0284c7"/>
      </linearGradient>
    </defs>
    <rect width="500" height="750" fill="url(#bg)"/>
    <circle cx="250" cy="320" r="60" fill="rgba(56,189,248,0.12)" stroke="#38bdf8" stroke-width="2"/>
    <polygon points="242,295 272,320 242,345" fill="#38bdf8"/>
    <text x="250" y="440" fill="#ffffff" font-family="sans-serif" font-size="24" font-weight="bold" text-anchor="middle">${safe}</text>
    <text x="250" y="480" fill="#94a3b8" font-family="sans-serif" font-size="16" text-anchor="middle">STREAMING HD</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Intercepteur global des erreurs de chargement d'images
window.addEventListener('error', (e) => {
  if (e.target && e.target.tagName === 'IMG') {
    const img = e.target;
    if (!img.dataset.fallbackApplied) {
      img.dataset.fallbackApplied = 'true';
      const alt = img.getAttribute('alt') || 'Titre';
      img.src = getFallbackPoster(alt);
    }
  }
}, true);

function createPosterCardHTML(item) {
  const typeBadge = item.badge || (item.type === 'tv' ? 'Série' : 'Film');
  const rating = item.rating || '8.0';

  return `
    <div class="pro-card" data-id="${item.id}" id="card-${item.id}">
      <div class="pro-poster-wrapper">
        <img src="${item.poster_url}" alt="${item.title}" class="pro-poster-img" loading="lazy">
        <span class="pro-card-badge">${typeBadge}</span>
        <span class="pro-card-quality">1080P</span>
        <span class="pro-card-rating"><i class="fa-solid fa-star"></i> ${rating}</span>
        <div class="pro-card-play-overlay">
          <div class="pro-card-play-icon"><i class="fa-solid fa-play"></i></div>
        </div>
      </div>
    </div>
  `;
}

// =========================================================================
// 4. FAQ ACCORDION
// =========================================================================

function renderFAQ() {
  const container = document.getElementById('faq-accordion-list');
  if (!container) return;

  container.innerHTML = FAQ_DATA.map((item, idx) => `
    <div class="faq-acc-item ${idx === 0 ? 'active' : ''}">
      <button class="faq-acc-trigger">
        <span>${item.q}</span>
        <i class="fa-solid fa-chevron-down faq-acc-icon"></i>
      </button>
      <div class="faq-acc-content">
        <p>${item.a}</p>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.faq-acc-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.faq-acc-item');
      parent.classList.toggle('active');
    });
  });
}

// =========================================================================
// 5. SPOTLIGHT SEARCH (CMD+K AVEC RECHERCHE TMDB EN DIRECT)
// =========================================================================

function setupSpotlightSearch() {
  const backdrop = document.getElementById('spotlight-modal');
  const searchTrigger = document.getElementById('btn-open-search');
  const input = document.getElementById('spotlight-search-input');
  const resultsContainer = document.getElementById('spotlight-results-container');

  if (!backdrop || !input || !resultsContainer) return;

  let debounceTimer = null;

  const openSearch = () => {
    backdrop.classList.remove('hidden');
    input.value = '';
    renderSearchResults(STATE.allMediaList.slice(0, 8));
    input.focus();
  };

  const closeSearch = () => {
    backdrop.classList.add('hidden');
  };

  if (searchTrigger) {
    searchTrigger.addEventListener('click', openSearch);
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (backdrop.classList.contains('hidden')) {
        openSearch();
      } else {
        closeSearch();
      }
    } else if (e.key === 'Escape' && !backdrop.classList.contains('hidden')) {
      closeSearch();
    }
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeSearch();
  });

  input.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (!query) {
      renderSearchResults(STATE.allMediaList.slice(0, 8));
      return;
    }

    // Filtrage instantané local
    const qLower = query.toLowerCase();
    const localMatches = STATE.allMediaList.filter(item => 
      item.title.toLowerCase().includes(qLower) ||
      (item.genres && item.genres.some(g => g.toLowerCase().includes(qLower)))
    );
    renderSearchResults(localMatches);

    // Requête asynchrone live TMDB après 250ms de pause dans la frappe
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        const liveResults = await TMDB.searchMulti(query);
        if (liveResults && liveResults.length > 0) {
          // Fusionner résultats sans doublons
          const combined = [...localMatches];
          liveResults.forEach(res => {
            if (!combined.some(c => c.tmdb_id === res.tmdb_id)) {
              combined.push(res);
              // Ajouter aussi à la liste globale pour pouvoir lancer le stream immédiatement
              if (!STATE.allMediaList.some(m => m.id === res.id)) {
                STATE.allMediaList.push(res);
              }
            }
          });
          renderSearchResults(combined.slice(0, 15));
        }
      } catch (err) {
        console.warn('Erreur recherche live:', err);
      }
    }, 250);
  });

  function renderSearchResults(items) {
    if (!items || items.length === 0) {
      resultsContainer.innerHTML = `
        <div style="padding: 2.5rem; text-align: center; color: #64748b;">
          <i class="fa-solid fa-magnifying-glass" style="font-size: 1.8rem; margin-bottom: 0.75rem; opacity: 0.5;"></i>
          <p style="font-size: 0.95rem;">Aucun titre trouvé. Essayez un autre titre de film ou série.</p>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = items.map(item => `
      <div class="spotlight-item" data-id="${item.id}">
        <img src="${item.poster_url}" alt="${item.title}" class="spotlight-thumb" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80';">
        <div class="spotlight-info">
          <div class="spotlight-item-title">${item.title}</div>
          <div class="spotlight-item-meta">
            <span>${item.type === 'tv' ? 'Série TV' : 'Film HD'}</span> • 
            <span>${item.release_year || '2026'}</span> • 
            <span><i class="fa-solid fa-star" style="color: #fbbf24;"></i> ${item.rating || '8.0'}</span>
          </div>
        </div>
      </div>
    `).join('');

    resultsContainer.querySelectorAll('.spotlight-item').forEach(el => {
      el.addEventListener('click', () => {
        const item = STATE.allMediaList.find(m => String(m.id) === String(el.dataset.id));
        if (item) {
          closeSearch();
          openStreamModal(item);
        }
      });
    });
  }
}

// =========================================================================
// 6. TIROIRS NOTIFICATIONS & TÉLÉCHARGEMENTS
// =========================================================================

function setupDrawers() {
  const notifBtn = document.getElementById('btn-notifications');
  const notifDrawer = document.getElementById('notifications-drawer');
  const closeNotif = document.getElementById('close-notif-btn');

  const downloadBtn = document.getElementById('btn-downloads-tray');
  const downloadDrawer = document.getElementById('downloads-drawer');
  const closeDownload = document.getElementById('close-download-btn');

  if (notifBtn && notifDrawer) {
    notifBtn.onclick = () => notifDrawer.classList.remove('hidden');
  }
  if (closeNotif && notifDrawer) {
    closeNotif.onclick = () => notifDrawer.classList.add('hidden');
    notifDrawer.onclick = (e) => { if (e.target === notifDrawer) notifDrawer.classList.add('hidden'); };
  }

  if (downloadBtn && downloadDrawer) {
    downloadBtn.onclick = () => downloadDrawer.classList.remove('hidden');
  }
  if (closeDownload && downloadDrawer) {
    closeDownload.onclick = () => downloadDrawer.classList.add('hidden');
    downloadDrawer.onclick = (e) => { if (e.target === downloadDrawer) downloadDrawer.classList.add('hidden'); };
  }
}

// =========================================================================
// 7. LECTEUR VIDÉO MULTI-SERVEURS & MODAL DÉTAILS
// =========================================================================

async function openStreamModal(media, season = 1, episode = 1) {
  STATE.currentMedia = media;
  STATE.currentSeason = season;
  STATE.currentEpisode = episode;

  const modal = document.getElementById('stream-modal');
  if (!modal) return;

  modal.classList.remove('hidden');
  modal.scrollTop = 0;
  document.body.style.overflow = 'hidden';

  const backdropImg = document.getElementById('stream-backdrop-img');
  const titleElem = document.getElementById('stream-title');
  const posterImg = document.getElementById('stream-poster-img');
  const posterTypeBadge = document.getElementById('stream-poster-type-badge');
  const ratingBadge = document.getElementById('stream-badge-rating');
  const yearBadge = document.getElementById('stream-badge-year');
  const durationBadge = document.getElementById('stream-badge-duration');
  const qualityBadge = document.getElementById('stream-badge-type');
  const synopsisElem = document.getElementById('stream-synopsis');
  const genresContainer = document.getElementById('stream-genres-container');

  if (backdropImg) {
    backdropImg.src = media.backdrop_url || media.poster_url || 'https://images.unsplash.com/photo-1574267432553-4b4628081c31?w=1600&auto=format&fit=crop&q=80';
    backdropImg.onerror = () => {
      backdropImg.src = 'https://images.unsplash.com/photo-1574267432553-4b4628081c31?w=1600&auto=format&fit=crop&q=80';
    };
  }

  if (titleElem) titleElem.textContent = media.title;

  if (posterImg) {
    posterImg.src = media.poster_url;
    posterImg.onerror = () => {
      posterImg.src = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80';
    };
  }

  if (posterTypeBadge) {
    posterTypeBadge.textContent = media.type === 'tv' ? 'SÉRIE' : 'FILM';
  }

  if (ratingBadge) {
    ratingBadge.innerHTML = `<i class="fa-solid fa-star" style="color: #fbbf24; margin-right: 4px;"></i> ${media.rating || '8.4'}`;
  }

  if (yearBadge) {
    yearBadge.innerHTML = `<i class="fa-regular fa-calendar" style="color: #38bdf8; margin-right: 5px;"></i> ${media.release_year || '2026'}`;
  }

  if (durationBadge) {
    durationBadge.innerHTML = `<i class="fa-regular fa-clock" style="color: #38bdf8; margin-right: 5px;"></i> ${media.duration || (media.type === 'tv' ? '8 Saisons' : '1h 51m')}`;
  }

  if (qualityBadge) {
    qualityBadge.textContent = '1080p';
  }

  if (genresContainer) {
    const genresList = media.genre ? media.genre.split(',').map(g => g.trim()) : ['Action', 'Thriller', 'Cinéma HD'];
    genresContainer.innerHTML = genresList.map(g => `<span class="genre-pill">${g}</span>`).join('');
  }

  if (synopsisElem) {
    synopsisElem.textContent = media.synopsis || 'Profitez de ce titre en haute définition gratuit sur HandyFlix.';
  }

  // Play Now CTA Click Scroll & Auto-Play Handler
  const launchPlayer = () => {
    const playerSection = document.getElementById('movie-player-section');
    if (playerSection) {
      playerSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    updateIframeSource();
    showToast(`Lecture lancée : ${media.title} (1080P VF)`);
  };

  const playCtaBtn = document.getElementById('movie-play-now-cta-btn');
  if (playCtaBtn) {
    playCtaBtn.onclick = launchPlayer;
  }

  const posterCardWrap = document.querySelector('.movie-poster-card-wrap');
  if (posterCardWrap) {
    posterCardWrap.style.cursor = 'pointer';
    posterCardWrap.onclick = launchPlayer;
  }

  // Boutons de serveurs
  renderServerPills();
  updateIframeSource();

  // Actions
  const addListBtn = document.getElementById('modal-add-list-btn');
  if (addListBtn) {
    const isFav = await SupabaseService.isFavorite(media.id);
    addListBtn.innerHTML = isFav 
      ? '<i class="fa-solid fa-check" style="color:#4ade80;"></i> <span>Dans ma liste</span>'
      : '<i class="fa-solid fa-plus"></i> <span>Ma Liste</span>';

    addListBtn.onclick = async () => {
      const added = await SupabaseService.toggleFavorite(media.id);
      addListBtn.innerHTML = added
        ? '<i class="fa-solid fa-check" style="color:#4ade80;"></i> <span>Dans ma liste</span>'
        : '<i class="fa-solid fa-plus"></i> <span>Ma Liste</span>';
      showToast(added ? `Ajouté à votre liste : ${media.title}` : `Retiré de votre liste`);
    };
  }

  const castBtn = document.getElementById('modal-cast-btn');
  if (castBtn) {
    castBtn.onclick = () => {
      showToast('Prêt pour la diffusion Chromecast / AirPlay / Smart TV');
    };
  }

  const shareBtn = document.getElementById('modal-share-btn');
  if (shareBtn) {
    shareBtn.onclick = () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.origin);
        showToast('Lien copié dans le presse-papiers !');
      }
    };
  }

  const downloadBtn = document.getElementById('modal-download-btn');
  if (downloadBtn) {
    downloadBtn.onclick = () => {
      showToast('Téléchargement haute définition initialisé...');
    };
  }

  // Tags audio doublages
  document.querySelectorAll('.dub-tag').forEach(tag => {
    tag.onclick = () => {
      document.querySelectorAll('.dub-tag').forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      showToast(`Piste audio sélectionnée : ${tag.textContent}`);
    };
  });

  // Gestion des séries TV
  const seriesWrap = document.getElementById('stream-series-wrapper');
  if (media.type === 'tv') {
    if (seriesWrap) seriesWrap.style.display = 'block';
    setupSeriesEpisodes(media);
  } else {
    if (seriesWrap) seriesWrap.style.display = 'none';
  }

  // Rendu de la section More Like This
  renderMoreLikeThis(media);

  // Progression
  SupabaseService.saveWatchProgress({
    media_id: media.id,
    media: media,
    season: STATE.currentSeason,
    episode: STATE.currentEpisode
  });
}

async function renderMoreLikeThis(currentMedia) {
  const carousel = document.getElementById('more-like-carousel');
  if (!carousel) return;

  // Affichage immédiat de secours avec les titres du catalogue
  const others = STATE.allMediaList.filter(m => m.id !== currentMedia.id);
  const fallbackRelated = others.length >= 8 ? others.slice(0, 10) : INITIAL_MEDIA;

  const renderItems = (items) => {
    carousel.innerHTML = items.map(item => `
      <div class="more-like-item-card" data-id="${item.id}">
        <div class="more-like-poster-wrap">
          <img src="${item.poster_url}" alt="${item.title}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80';">
        </div>
        <span class="more-like-title">${item.title}</span>
      </div>
    `).join('');

    carousel.querySelectorAll('.more-like-item-card').forEach(card => {
      card.addEventListener('click', () => {
        const mediaId = card.dataset.id;
        const found = STATE.allMediaList.find(m => m.id === mediaId) || items.find(m => m.id === mediaId);
        if (found) {
          openStreamModal(found);
        }
      });
    });
  };

  renderItems(fallbackRelated);

  // Appel dynamique TMDB pour charger les vrais films/séries similaires
  if (currentMedia.tmdb_id) {
    try {
      const details = await TMDB.getDetails(currentMedia.tmdb_id, currentMedia.type);
      if (details && details.similar && details.similar.length > 0) {
        // Enregistrer les nouveaux titres dans la liste globale
        details.similar.forEach(sim => {
          if (!STATE.allMediaList.some(m => m.id === sim.id)) {
            STATE.allMediaList.push(sim);
          }
        });
        renderItems(details.similar.slice(0, 12));
      }
    } catch (e) {
      console.warn('Erreur chargement similar:', e);
    }
  }

  const nextBtn = document.getElementById('more-like-next-btn');
  if (nextBtn) {
    nextBtn.onclick = () => {
      carousel.scrollBy({ left: 360, behavior: 'smooth' });
    };
  }

  const seeAllLink = document.getElementById('more-like-see-all');
  if (seeAllLink) {
    seeAllLink.onclick = (e) => {
      e.preventDefault();
      const modal = document.getElementById('stream-modal');
      if (modal) modal.classList.add('hidden');
      document.body.style.overflow = '';
      showToast('Affichage du catalogue complet');
    };
  }
}

function renderServerPills() {
  const container = document.getElementById('stream-servers-container');
  if (!container) return;

  container.innerHTML = CONFIG.PROVIDERS.map((p, idx) => `
    <button class="server-pill ${idx === STATE.currentServerIndex ? 'active' : ''}" data-idx="${idx}">
      <i class="fa-solid fa-server"></i>
      <span>${p.name}</span>
    </button>
  `).join('');

  container.querySelectorAll('.server-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.server-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.currentServerIndex = Number(btn.dataset.idx);
      updateIframeSource();
      showToast(`Serveur actif : ${CONFIG.PROVIDERS[STATE.currentServerIndex].name}`);
    });
  });
}

function updateIframeSource() {
  const iframe = document.getElementById('stream-video-iframe');
  if (!iframe || !STATE.currentMedia) return;

  const provider = CONFIG.PROVIDERS[STATE.currentServerIndex] || CONFIG.PROVIDERS[0];
  const tmdbId = STATE.currentMedia.tmdb_id;
  const isTv = STATE.currentMedia.type === 'tv';

  let url = isTv ? provider.tv : provider.movie;
  url = url
    .replace('{tmdb_id}', tmdbId)
    .replace('{season}', STATE.currentSeason)
    .replace('{episode}', STATE.currentEpisode);

  iframe.src = url;
}

async function setupSeriesEpisodes(media) {
  const select = document.getElementById('stream-season-select');
  const grid = document.getElementById('stream-episodes-grid');
  if (!select || !grid) return;

  let seasons = [];
  try {
    const details = await TMDB.getDetails(media.tmdb_id, 'tv');
    if (details && details.seasons && details.seasons.length > 0) {
      seasons = details.seasons;
    }
  } catch (e) {
    console.warn('Erreur récupération saisons TMDB:', e);
  }

  const seasonCount = seasons.length > 0 ? seasons.length : 5;
  select.innerHTML = Array.from({ length: seasonCount }, (_, i) => `
    <option value="${i + 1}" ${i + 1 === STATE.currentSeason ? 'selected' : ''}>Saison ${i + 1}</option>
  `).join('');

  const renderEpisodesForSeason = async (sNum) => {
    let episodeCount = 10;
    const currentSeasonObj = seasons.find(s => s.season_number === sNum);
    if (currentSeasonObj && currentSeasonObj.episode_count) {
      episodeCount = currentSeasonObj.episode_count;
    }

    grid.innerHTML = Array.from({ length: Math.min(episodeCount, 24) }, (_, i) => `
      <button class="ep-btn ${i + 1 === STATE.currentEpisode ? 'active' : ''}" data-ep="${i + 1}">
        Épisode ${i + 1}
      </button>
    `).join('');

    grid.querySelectorAll('.ep-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        STATE.currentEpisode = Number(btn.dataset.ep);
        updateIframeSource();
        showToast(`Lecture S${STATE.currentSeason}:E${STATE.currentEpisode}`);
      });
    });
  };

  select.onchange = (e) => {
    STATE.currentSeason = Number(e.target.value);
    STATE.currentEpisode = 1;
    renderEpisodesForSeason(STATE.currentSeason);
  };

  renderEpisodesForSeason(STATE.currentSeason);
}

function setupModalCloseListeners() {
  const modal = document.getElementById('stream-modal');
  const closeBtn = document.getElementById('btn-close-stream-modal');
  const iframe = document.getElementById('stream-video-iframe');

  const closeModal = () => {
    if (!modal) return;
    if (iframe) iframe.src = 'about:blank';
    modal.classList.add('hidden');
    document.body.style.overflow = '';
  };

  if (closeBtn) closeBtn.onclick = closeModal;

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });
}

// =========================================================================
// 8. CAPSULE NAVIGATION & FILTRES (MATCHING PHOTO 2)
// =========================================================================

function setupNavigation() {
  document.querySelectorAll('.capsule-nav-item[data-nav]').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.capsule-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const nav = item.dataset.nav;
      STATE.currentNav = nav;

      const heroSection = document.getElementById('hero-spotlight-section');

      if (nav === 'home' || nav === 'all') {
        if (heroSection) heroSection.style.display = 'flex';
        renderAllCategoryRows(STATE.dynamicCategories);
      } else if (nav === 'trending') {
        if (heroSection) heroSection.style.display = 'flex';
        const trendingRow = STATE.dynamicCategories.filter(c => c.id === 'trending-now');
        renderAllCategoryRows(trendingRow.length ? trendingRow : STATE.dynamicCategories);
      } else if (nav === 'tv') {
        if (heroSection) heroSection.style.display = 'flex';
        const tvItems = STATE.allMediaList.filter(i => i.type === 'tv');
        const tvCategory = [{
          id: 'tv-all',
          name: 'Toutes les Séries TV en Streaming HD',
          items: tvItems.length > 0 ? tvItems : STATE.allMediaList.filter(i => i.type === 'tv')
        }];
        renderAllCategoryRows(tvCategory);
      } else if (nav === 'favorites') {
        if (heroSection) heroSection.style.display = 'none';
        SupabaseService.getFavorites().then(favs => {
          let favItems = [];
          if (favs && favs.length > 0) {
            favItems = STATE.allMediaList.filter(m => favs.some(f => f.media_id === m.id));
          }
          if (favItems.length === 0) {
            favItems = STATE.allMediaList.slice(0, 6);
          }
          const favRow = [{
            id: 'my-list-row',
            name: 'Ma Liste de Favoris (Synchronisée Cloud)',
            items: favItems
          }];
          renderAllCategoryRows(favRow);
        });
      }
    });
  });
}

// =========================================================================
// 9. TOAST NOTIFICATIONS
// =========================================================================

function showToast(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: rgba(10, 11, 18, 0.95);
    border: 1px solid rgba(56, 189, 248, 0.3);
    border-left: 4px solid #38bdf8;
    color: #ffffff;
    padding: 0.85rem 1.25rem;
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.8);
    font-size: 0.9rem;
    font-family: 'Plus Jakarta Sans', sans-serif;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    backdrop-filter: blur(12px);
    transform: translateX(100%);
    opacity: 0;
    transition: all 0.35s cubic-bezier(0.32, 0.72, 0, 1);
    pointer-events: auto;
  `;

  toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#38bdf8;"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  }, 50);

  setTimeout(() => {
    toast.style.transform = 'translateX(100%)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// =========================================================================
// 10. DÉMARRAGE DE L'APPLICATION
// =========================================================================

function startApp() {
  initSplashScreen();
  setupSpotlightSearch();
  setupDrawers();
  setupModalCloseListeners();
  setupNavigation();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
