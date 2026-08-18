/**
 * Space Flix - Catalogue de données de démonstration et fallback
 * Fournit une bibliothèque complète de films, séries et animes en VF et VOSTFR.
 */

export const GENRES_LIST = [
  'Tous',
  'Action',
  'Aventure',
  'Animation',
  'Comédie',
  'Drame',
  'Science-Fiction',
  'Fantastique',
  'Horreur',
  'Thriller',
  'Crime',
  'Mystère',
  'Romance'
];

export const INITIAL_MEDIA = [
  {
    id: "m-dune-2",
    title: "Dune: Deuxième Partie",
    slug: "dune-deuxieme-partie",
    type: "movie",
    synopsis: "Paul Atreides s'unit à Chani et aux Fremen tout en menant une quête de vengeance contre les conspirateurs qui ont détruit sa famille. Face à un choix entre l'amour de sa vie et le destin de l'univers, il s'efforce d'empêcher un futur terrible que lui seul peut prédire.",
    poster_url: "https://image.tmdb.org/t/p/w500/1pdfLPoLMag8St86TjKVChLvisE.jpg",
    backdrop_url: "https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fKSuV0vqv.jpg",
    rating: 8.6,
    release_year: 2024,
    duration: "2h 46m",
    genres: ["Science-Fiction", "Aventure", "Action"],
    languages: ["VF", "VOSTFR"],
    is_trending: true,
    is_featured: true,
    video_servers: [
      { name: "Serveur VF 1 (HD)", url: "https://vidsrc.to/embed/movie/693134", quality: "1080p", lang: "VF" },
      { name: "Serveur VF 2 (Fast)", url: "https://vidsrc.me/embed/movie?imdb=tt15239678", quality: "1080p", lang: "VF" },
      { name: "Serveur VOSTFR", url: "https://vidsrc.cc/v2/embed/movie/693134", quality: "1080p", lang: "VOSTFR" }
    ]
  },
  {
    id: "s-arcane",
    title: "Arcane",
    slug: "arcane",
    type: "tv",
    synopsis: "Au cœur du conflit entre les villes jumelles de Piltover et Zaun, deux sœurs se battent dans les camps opposés d'une guerre entre technologies magiques et convictions incompatibles.",
    poster_url: "https://image.tmdb.org/t/p/w500/abR6I0n3z6p2N46T30wN5s0X7l.jpg",
    backdrop_url: "https://image.tmdb.org/t/p/original/q82L4W4clyc0w7bY9rJzE3L0M0r.jpg",
    rating: 9.1,
    release_year: 2024,
    duration: "2 Saisons",
    genres: ["Animation", "Action", "Science-Fiction", "Drame"],
    languages: ["VF", "VOSTFR"],
    is_trending: true,
    is_featured: true,
    seasons: [
      {
        season_number: 1,
        episodes: [
          {
            episode_number: 1,
            title: "Le chaos s'invite chez nous",
            synopsis: "Vi et Powder tentent le casse du siècle dans un laboratoire huppé du haut Piltover, sans se douter des conséquences explosives.",
            still_path: "https://image.tmdb.org/t/p/w500/v9D4s8f22z4aW4rT72bX8c9e.jpg",
            video_servers: [
              { name: "Serveur VF 1", url: "https://vidsrc.to/embed/tv/94605/1/1", quality: "1080p", lang: "VF" },
              { name: "Serveur VOSTFR", url: "https://vidsrc.me/embed/tv?imdb=tt11116142&season=1&episode=1", quality: "1080p", lang: "VOSTFR" }
            ]
          },
          {
            episode_number: 2,
            title: "Tout le monde veut être mon ennemi",
            synopsis: "Alors que les autorités traquent les coupables, le mystérieux Hextech commence à attirer les convoitises de l'académie.",
            still_path: "https://image.tmdb.org/t/p/w500/w7rT73x98e8s9Xz12y4a.jpg",
            video_servers: [
              { name: "Serveur VF 1", url: "https://vidsrc.to/embed/tv/94605/1/2", quality: "1080p", lang: "VF" }
            ]
          },
          {
            episode_number: 3,
            title: "La violence est la seule réponse",
            synopsis: "Une confrontation tragique dans les bas-fonds de Zaun change à jamais le destin des deux sœurs.",
            still_path: "https://image.tmdb.org/t/p/w500/uD2X0wQ7p8W9Z1X2Y3a.jpg",
            video_servers: [
              { name: "Serveur VF 1", url: "https://vidsrc.to/embed/tv/94605/1/3", quality: "1080p", lang: "VF" }
            ]
          }
        ]
      },
      {
        season_number: 2,
        episodes: [
          {
            episode_number: 1,
            title: "Poids de la couronne",
            synopsis: "Après l'attaque dévastatrice du conseil, Piltover décrète la loi martiale sous la pression de Caitlyn.",
            still_path: "https://image.tmdb.org/t/p/w500/q82L4W4clyc0w7bY9rJzE3L0M0r.jpg",
            video_servers: [
              { name: "Serveur VF 1", url: "https://vidsrc.to/embed/tv/94605/2/1", quality: "1080p", lang: "VF" }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "m-deadpool-wolverine",
    title: "Deadpool & Wolverine",
    slug: "deadpool-and-wolverine",
    type: "movie",
    synopsis: "Un Deadpool apathique rejoint un Wolverine blessé et réticent pour sauver leur univers d'une menace existentielle majeure au sein du Tribunal des Variations Anachroniques.",
    poster_url: "https://image.tmdb.org/t/p/w500/8cdWjvZ276Y097hR3aVl856hA02.jpg",
    backdrop_url: "https://image.tmdb.org/t/p/original/yDHYTfA3R0jFYba16jBB12vYwG1.jpg",
    rating: 7.9,
    release_year: 2024,
    duration: "2h 08m",
    genres: ["Action", "Comédie", "Science-Fiction"],
    languages: ["VF", "VOSTFR"],
    is_trending: true,
    is_featured: false,
    video_servers: [
      { name: "Serveur VF (4K UHD)", url: "https://vidsrc.to/embed/movie/533535", quality: "4K", lang: "VF" },
      { name: "Serveur VF 2", url: "https://vidsrc.me/embed/movie?imdb=tt6263850", quality: "1080p", lang: "VF" },
      { name: "Serveur VOSTFR", url: "https://vidsrc.cc/v2/embed/movie/533535", quality: "1080p", lang: "VOSTFR" }
    ]
  },
  {
    id: "m-oppenheimer",
    title: "Oppenheimer",
    slug: "oppenheimer",
    type: "movie",
    synopsis: "L'histoire captivante du physicien J. Robert Oppenheimer et de sa direction du projet Manhattan qui a donné naissance à la première bombe atomique.",
    poster_url: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    backdrop_url: "https://image.tmdb.org/t/p/original/fm6K8Oi23Nm9vpyWhbuve29wTJx.jpg",
    rating: 8.9,
    release_year: 2023,
    duration: "3h 00m",
    genres: ["Drame", "Histoire", "Biopic"],
    languages: ["VF", "VOSTFR"],
    is_trending: true,
    is_featured: false,
    video_servers: [
      { name: "Serveur VF 1", url: "https://vidsrc.to/embed/movie/872585", quality: "1080p", lang: "VF" },
      { name: "Serveur VOSTFR", url: "https://vidsrc.me/embed/movie?imdb=tt15398776", quality: "1080p", lang: "VOSTFR" }
    ]
  },
  {
    id: "s-the-last-of-us",
    title: "The Last of Us",
    slug: "the-last-of-us",
    type: "tv",
    synopsis: "Quand la terre est ravagée par un champignon mutant, Joel est engagé pour faire sortir Ellie, 14 ans, d'une zone de quarantaine oppressive.",
    poster_url: "https://image.tmdb.org/t/p/w500/uKvVjHNqB5VmjuAwe2E26ykWVq7.jpg",
    backdrop_url: "https://image.tmdb.org/t/p/original/uDgy6hyPd82sOHhZivmEv3DzoJH.jpg",
    rating: 8.8,
    release_year: 2023,
    duration: "1 Saison",
    genres: ["Drame", "Action", "Horreur", "Science-Fiction"],
    languages: ["VF", "VOSTFR"],
    is_trending: true,
    is_featured: false,
    seasons: [
      {
        season_number: 1,
        episodes: [
          {
            episode_number: 1,
            title: "Quand tu es perdu dans les ténèbres",
            synopsis: "Vingt ans après l'effondrement de la civilisation, Joel est chargé d'escorter la jeune Ellie.",
            still_path: "https://image.tmdb.org/t/p/w500/uDgy6hyPd82sOHhZivmEv3DzoJH.jpg",
            video_servers: [
              { name: "Serveur VF 1", url: "https://vidsrc.to/embed/tv/100088/1/1", quality: "1080p", lang: "VF" }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "s-house-of-the-dragon",
    title: "House of the Dragon",
    slug: "house-of-the-dragon",
    type: "tv",
    synopsis: "L'histoire de la maison Targaryen, 200 ans avant les événements de Game of Thrones, et la guerre civile connue sous le nom de Danse des Dragons.",
    poster_url: "https://image.tmdb.org/t/p/w500/1X4h40yBSDipuWic46R4KZqFxVJ.jpg",
    backdrop_url: "https://image.tmdb.org/t/p/original/etj8E2o0VisualBackdrop.jpg",
    rating: 8.5,
    release_year: 2024,
    duration: "2 Saisons",
    genres: ["Fantastique", "Action", "Drame"],
    languages: ["VF", "VOSTFR"],
    is_trending: true,
    is_featured: false,
    seasons: [
      {
        season_number: 1,
        episodes: [
          {
            episode_number: 1,
            title: "Les héritiers du dragon",
            synopsis: "Le roi Viserys organise un tournoi pour célébrer la naissance imminente de son second enfant.",
            still_path: "https://image.tmdb.org/t/p/w500/cx9e9W22s8a8461h51a3.jpg",
            video_servers: [
              { name: "Serveur VF", url: "https://vidsrc.to/embed/tv/94997/1/1", quality: "1080p", lang: "VF" }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "m-avatar-2",
    title: "Avatar: La Voie de l'eau",
    slug: "avatar-la-voie-de-leau",
    type: "movie",
    synopsis: "Jake Sully et Neytiri ont formé une famille et font tout pour rester ensemble. Cependant, ils doivent quitter leur foyer et explorer les régions de Pandora.",
    poster_url: "https://image.tmdb.org/t/p/w500/t6HIfvMGNVRXZw2WKuEwwhotHQ3.jpg",
    backdrop_url: "https://image.tmdb.org/t/p/original/vL5LR6WdxWPjCqvKV8XA6WIIsW5.jpg",
    rating: 7.7,
    release_year: 2022,
    duration: "3h 12m",
    genres: ["Science-Fiction", "Aventure", "Action"],
    languages: ["VF", "VOSTFR"],
    is_trending: false,
    is_featured: false,
    video_servers: [
      { name: "Serveur VF 1", url: "https://vidsrc.to/embed/movie/76600", quality: "1080p", lang: "VF" }
    ]
  },
  {
    id: "s-solo-leveling",
    title: "Solo Leveling",
    slug: "solo-leveling",
    type: "tv",
    synopsis: "Dans un monde où des chasseurs aux pouvoirs magiques doivent affronter des monstres mortels, Sung Jinwoo, le chasseur le plus faible de tous, obtient un moyen unique de monter de niveau sans limite.",
    poster_url: "https://image.tmdb.org/t/p/w500/geCRueV3ElhRTr1viPtiNV2vYm1.jpg",
    backdrop_url: "https://image.tmdb.org/t/p/original/j3Z3d3v48X0a.jpg",
    rating: 8.7,
    release_year: 2024,
    duration: "1 Saison",
    genres: ["Animation", "Action", "Fantastique"],
    languages: ["VF", "VOSTFR"],
    is_trending: true,
    is_featured: false,
    seasons: [
      {
        season_number: 1,
        episodes: [
          {
            episode_number: 1,
            title: "Il a l'habitude",
            synopsis: "Jinwoo rejoint un donjon de rang D pour subvenir aux besoins de sa famille, mais le donjon cache un secret mortel.",
            still_path: "https://image.tmdb.org/t/p/w500/geCRueV3ElhRTr1viPtiNV2vYm1.jpg",
            video_servers: [
              { name: "Serveur VF 1", url: "https://vidsrc.to/embed/tv/120998/1/1", quality: "1080p", lang: "VF" }
            ]
          }
        ]
      }
    ]
  }
];

export const GENRES_LIST = [
  "Tous",
  "Action",
  "Aventure",
  "Comédie",
  "Crime",
  "Drame",
  "Fantastique",
  "Histoire",
  "Horreur",
  "Médical",
  "Mystère",
  "Romance",
  "Sci-Fi",
  "Thriller",
  "Animation",
  "Biopic"
];
