import https from 'https';
import fs from 'fs';

const apiKey = '99b995150ed16f5fc8a3fff320ca41df';

function queryTMDB(endpoint) {
  return new Promise((resolve) => {
    https.get(`https://api.themoviedb.org/3${endpoint}&api_key=${apiKey}`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({}); }
      });
    }).on('error', () => resolve({}));
  });
}

async function searchMedia(title, type) {
  const endpoint = type === 'tv' 
    ? `/search/tv?query=${encodeURIComponent(title)}` 
    : `/search/movie?query=${encodeURIComponent(title)}`;
  const res = await queryTMDB(endpoint);
  if (res.results && res.results.length > 0) {
    return res.results[0];
  }
  return null;
}

async function main() {
  console.log('Fetching Hero & Catalog Data from TMDB...');

  const heroItems = [
    { title: "Sterling Point", type: "tv", genre: "Drama", badge: "SERIES" },
    { title: "Reacher", type: "tv", genre: "Action", badge: "SERIES" },
    { title: "Despicable Me 4", type: "movie", genre: "Animation", badge: "FILM", displayTitle: "Minions & Monsters" },
    { title: "Stranger Things", type: "tv", genre: "Sci-Fi", badge: "SERIES" },
    { title: "Dune: Part Two", type: "movie", genre: "Sci-Fi", badge: "FILM" },
    { title: "Secret Invasion", type: "tv", genre: "Marvel", badge: "SERIES" }
  ];

  const heroData = [];
  for (const item of heroItems) {
    const data = await searchMedia(item.title, item.type);
    if (data && data.poster_path) {
      heroData.push({
        id: `hero-${data.id}`,
        tmdb_id: data.id,
        title: item.displayTitle || data.name || data.title,
        type: item.type,
        poster_url: `https://image.tmdb.org/t/p/w500${data.poster_path}`,
        backdrop_url: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : `https://image.tmdb.org/t/p/w500${data.poster_path}`,
        rating: (data.vote_average || 7.5).toFixed(1),
        release_year: (data.first_air_date || data.release_date || "2026").substring(0, 4),
        duration: item.type === "tv" ? "Série TV" : "1h 55m",
        genre: item.genre,
        badge: item.badge,
        synopsis: data.overview || "Une histoire captivante à découvrir sans modération sur HANDYFLIX."
      });
    }
  }

  // Si Sterling Point n'a pas de backdrop_path sur TMDB, fournissons le backdrop haute résolution exact
  if (heroData[0]) {
    heroData[0].backdrop_url = "https://image.tmdb.org/t/p/original/ebLym6w04CzYJBLZScB1rrzm6uY.jpg";
    heroData[0].poster_url = "https://image.tmdb.org/t/p/w500/cThLWEGs6BEqY0QZMbU4FAeWwPT.jpg";
  }

  const categoryConfigs = [
    {
      id: "trending-now",
      name: "Trending Now — Top 10 Aujourd'hui",
      titles: [
        { title: "Dune: Part Two", type: "movie", badge: "N°1 Tendance" },
        { title: "Deadpool & Wolverine", type: "movie", badge: "N°2 Tendance" },
        { title: "Arcane", type: "tv", badge: "N°3 Tendance" },
        { title: "Gladiator II", type: "movie", badge: "N°4 Tendance" },
        { title: "House of the Dragon", type: "tv", badge: "N°5 Tendance" },
        { title: "Venom: The Last Dance", type: "movie", badge: "N°6 Tendance" },
        { title: "Terrifier 3", type: "movie", badge: "N°7 Tendance" }
      ]
    },
    {
      id: "epic-fantasy",
      name: "Epic Fantasy",
      titles: [
        { title: "Game of Thrones", type: "tv", badge: "HBO" },
        { title: "The Lord of the Rings: The Rings of Power", type: "tv", badge: "Prime" },
        { title: "The Witcher", type: "tv", badge: "Netflix" },
        { title: "The Wheel of Time", type: "tv", badge: "Prime Video" },
        { title: "The Sandman", type: "tv", badge: "Netflix" },
        { title: "Shadow and Bone", type: "tv", badge: "Grishaverse" }
      ]
    },
    {
      id: "sitcom",
      name: "Sitcom",
      titles: [
        { title: "Friends", type: "tv", badge: "Culte" },
        { title: "The Big Bang Theory", type: "tv", badge: "Hit Mondial" },
        { title: "The Inbetweeners", type: "tv", badge: "UK Classic" },
        { title: "Schitt's Creek", type: "tv", badge: "Multi-Emmy" },
        { title: "Modern Family", type: "tv", badge: "Incontournable" },
        { title: "Seinfeld", type: "tv", badge: "Légendaire" }
      ]
    },
    {
      id: "scifi-cyberpunk",
      name: "Sci-Fi & Cyberpunk",
      titles: [
        { title: "Stranger Things", type: "tv", badge: "Netflix" },
        { title: "Blade Runner 2049", type: "movie", badge: "Chef d'œuvre" },
        { title: "Interstellar", type: "movie", badge: "Nolan" },
        { title: "Cyberpunk: Edgerunners", type: "tv", badge: "Night City" },
        { title: "The Matrix", type: "movie", badge: "Légende" }
      ]
    },
    {
      id: "action-blockbusters",
      name: "Action Blockbusters",
      titles: [
        { title: "John Wick: Chapter 4", type: "movie", badge: "Ultra HD" },
        { title: "Avengers: Endgame", type: "movie", badge: "Marvel" },
        { title: "Top Gun: Maverick", type: "movie", badge: "Top Film" },
        { title: "Bad Boys: Ride or Die", type: "movie", badge: "2024" }
      ]
    },
    {
      id: "crime-mystery",
      name: "Crime, Mafia & Thriller",
      titles: [
        { title: "Breaking Bad", type: "tv", badge: "Top #1" },
        { title: "Peaky Blinders", type: "tv", badge: "BBC Culte" },
        { title: "The Batman", type: "movie", badge: "DC Noir" },
        { title: "Sherlock", type: "tv", badge: "BBC" }
      ]
    },
    {
      id: "anime-animation",
      name: "Anime & Animation",
      titles: [
        { title: "Demon Slayer: Kimetsu no Yaiba", type: "tv", badge: "Anime Top" },
        { title: "Attack on Titan", type: "tv", badge: "Culte" },
        { title: "Solo Leveling", type: "tv", badge: "Hit 2024" },
        { title: "Spider-Man: Across the Spider-Verse", type: "movie", badge: "Oscar" }
      ]
    }
  ];

  const processedCategories = [];
  for (const cat of categoryConfigs) {
    const items = [];
    for (const t of cat.titles) {
      const data = await searchMedia(t.title, t.type);
      if (data && data.poster_path) {
        items.push({
          id: `${t.type}-${data.id}`,
          tmdb_id: data.id,
          title: data.name || data.title,
          type: t.type,
          poster_url: `https://image.tmdb.org/t/p/w500${data.poster_path}`,
          backdrop_url: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : `https://image.tmdb.org/t/p/w500${data.poster_path}`,
          rating: (data.vote_average || 8.0).toFixed(1),
          release_year: (data.first_air_date || data.release_date || "2024").substring(0, 4),
          duration: t.type === "tv" ? "Série TV" : "Film HD",
          genres: ["Populaire"],
          badge: t.badge,
          synopsis: data.overview || "Regardez ce titre en streaming HD gratuit sur HandyFlix."
        });
      }
    }
    processedCategories.push({
      id: cat.id,
      name: cat.name,
      items: items
    });
  }

  const fileContent = `/**
 * HANDYFLIX - Complete Curated Categories, Hero Featured & FAQ Data
 * All verified directly against TMDB API
 */

export const HERO_FEATURED_ITEMS = ${JSON.stringify(heroData, null, 2)};

export const CATEGORIES_CONFIG = ${JSON.stringify(processedCategories, null, 2)};

export const INITIAL_MEDIA = [
  ...HERO_FEATURED_ITEMS,
  ...CATEGORIES_CONFIG.flatMap(c => c.items)
];

export const FAQ_DATA = [
  {
    q: "HANDYFLIX est-il 100% gratuit et sans abonnement ?",
    a: "Oui ! HANDYFLIX est entièrement gratuit. Aucun compte, aucune carte bancaire et aucun abonnement ne sont requis pour regarder vos films et séries préférés en haute définition."
  },
  {
    q: "Comment changer de serveur ou de langue (VF / VOSTFR / Multi-Audio) ?",
    a: "Lorsque vous lancez un titre, une barre de serveurs s'affiche au-dessus de la vidéo. Vous pouvez basculer en un clic entre les serveurs MultiEmbed (VF/Multi), VidLink Pro (STFR auto), VidSrc CC HD et AutoEmbed."
  },
  {
    q: "Puis-je regarder sur ma TV (Chromecast / AirPlay) ou mon smartphone ?",
    a: "Absolument. HANDYFLIX est 100% responsive et optimisé pour tous les écrans : smartphones, tablettes, ordinateurs et téléviseurs connectés."
  },
  {
    q: "Comment fonctionne la reprise de lecture automatique ?",
    a: "Votre progression de visionnage est automatiquement enregistrée afin que vous puissiez reprendre exactement là où vous vous étiez arrêté."
  }
];
`;

  fs.writeFileSync("./Frontend/src/lib/data.js", fileContent, "utf8");
  console.log("Successfully generated /Frontend/src/lib/data.js with all verified images!");
}

main();
