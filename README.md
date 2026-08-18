# 🚀 Space Flix — Streaming Films & Séries HD Gratuit (VF & VOSTFR)

Space Flix est une application web moderne de streaming de films et séries TV en haute définition, intégrant un lecteur vidéo spatial sur mesure, un système de **reprise de lecture automatique** synchronisé avec Supabase et le stockage local, une gestion multi-serveurs HD (VF & VOSTFR) et l'authentification utilisateur.

---

## 🌟 Fonctionnalités Principales

1. **Reprise de lecture automatique (Auto-Resume / Continue Watching)** :
   - Mémorise la position exacte (`currentTime`) du visionnage toutes les 5 secondes, à la pause ou à la fermeture du lecteur.
   - Synchronisation bidirectionnelle avec la table Supabase `public.user_history` et le `localStorage` pour les invités.
   - Bandeau interactif dans le lecteur : `Reprendre là où vous vous étiez arrêté (MM:SS) ?` avec options *Reprendre* ou *Du début*.
   - Section dédiée **"Reprendre la lecture"** sur la page d'accueil et dans "Ma Liste" avec barres de progression animées et durées restantes.

2. **Lecteur Vidéo Spatial Sur Mesure** :
   - Sélecteur multi-serveurs avec drapeaux de langue (Serveur VF 1 HD, Serveur VF 2 Rapide, Serveur VOSTFR HD, SuperEmbed).
   - Contrôleur de vitesse de lecture (0.75x, 1x, 1.25x, 1.5x, 2x).
   - Mode Cinéma / Mode Large et bascule Plein écran natif (`F`).
   - Raccourcis clavier complets :
     - `Espace` : Lecture / Pause
     - `→` / `←` : Avancer / Reculer de 10s
     - `F` : Plein écran
     - `Échap` : Fermer le lecteur

3. **Authentification & Synchronisation** :
   - Connexion et Inscription par e-mail et mot de passe via Supabase Auth.
   - Connexion OAuth Google en 1 clic.
   - Mode Invité fluide : aucun compte obligatoire, les favoris et l'historique restent sauvegardés localement.

4. **Catalogue & Moteur de Recherche** :
   - Connexion hybride TMDB (The Movie Database) + Base Supabase + Bibliothèque de secours 2024-2026.
   - Filtres par types (Films, Séries, Nouveautés, Top 10, Ma Liste) et par Genres (Action, Sci-Fi, Drame, Animation, Horreur, etc.).
   - Recherche en temps réel.

5. **Téléchargement ZIP Instantané** :
   - Route `/download-zip` et `/api/download-zip` permettant de télécharger le projet complet en archive ZIP.

---

## 🗄️ SQL Editor Supabase (Script à copier-coller)

Copiez l'intégralité du script ci-dessous et exécutez-le dans **Supabase Dashboard > SQL Editor > New query > Run** :

```sql
-- 1. Active l'extension uuid-ossp
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Table des Médias (Films & Séries)
CREATE TABLE IF NOT EXISTS public.media (
    id TEXT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('movie', 'tv')),
    synopsis TEXT,
    poster_url TEXT NOT NULL,
    backdrop_url TEXT,
    rating NUMERIC(3, 1) DEFAULT 8.0,
    release_year INT NOT NULL,
    duration VARCHAR(50),
    genres TEXT[] NOT NULL DEFAULT '{}',
    languages TEXT[] NOT NULL DEFAULT '{"VF", "VOSTFR"}',
    is_trending BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    video_servers JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Table des Épisodes (Pour les séries)
CREATE TABLE IF NOT EXISTS public.episodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    media_id TEXT REFERENCES public.media(id) ON DELETE CASCADE,
    season_number INT NOT NULL,
    episode_number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    synopsis TEXT,
    still_path TEXT,
    video_servers JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_episode_per_season UNIQUE(media_id, season_number, episode_number)
);

-- 4. Table des Favoris ("Ma Liste")
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id TEXT REFERENCES public.media(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_favorite UNIQUE(user_id, media_id)
);

-- 5. Table de Reprise de Lecture Automatique & Historique (Continue Watching)
CREATE TABLE IF NOT EXISTS public.user_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id TEXT NOT NULL,
    media_title VARCHAR(255),
    media_type VARCHAR(20) DEFAULT 'movie',
    poster_url TEXT,
    season_number INT DEFAULT 1,
    episode_number INT DEFAULT 1,
    episode_title VARCHAR(255),
    current_time_seconds NUMERIC(10, 2) DEFAULT 0,
    duration_seconds NUMERIC(10, 2) DEFAULT 0,
    progress_percent INT DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_media_playback UNIQUE(user_id, media_id, season_number, episode_number)
);

-- 6. Table des Profils Utilisateurs
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_media_type ON public.media(type);
CREATE INDEX IF NOT EXISTS idx_media_trending ON public.media(is_trending);
CREATE INDEX IF NOT EXISTS idx_episodes_media ON public.episodes(media_id, season_number);
CREATE INDEX IF NOT EXISTS idx_history_user ON public.user_history(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);

-- Activation de la sécurité Row Level Security (RLS)
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Polices d'accès RLS
CREATE POLICY "Public Read Access for Media" ON public.media FOR SELECT USING (true);
CREATE POLICY "Public Read Access for Episodes" ON public.episodes FOR SELECT USING (true);
CREATE POLICY "Public read access for profiles" ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can manage favorites" ON public.favorites FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage history" ON public.user_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can update profile" ON public.profiles FOR ALL USING (auth.uid() = id);
```

---

## 🛠️ Lancement du Projet en Local

```bash
# Installer les dépendances
npm install

# Démarrer le serveur Space Flix
npm start
# Le serveur démarre sur http://localhost:3000
```
