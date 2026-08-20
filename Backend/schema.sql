-- ======================================================
-- SPACE FLIX - BASE DE DONNÉES SUPABASE (SQL EDITOR SCRIPT)
-- Copiez-collez l'intégralité de ce script dans Supabase > SQL Editor > Run
-- ======================================================

-- 1. Active l'extension uuid-ossp si besoin
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Réinitialisation des tables existantes (Évite l'erreur UUID sur media.id si la table existe déjà)
DROP TABLE IF EXISTS public.favorites CASCADE;
DROP TABLE IF EXISTS public.user_history CASCADE;
DROP TABLE IF EXISTS public.episodes CASCADE;
DROP TABLE IF EXISTS public.media CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 3. Table des Médias (Films & Séries) avec ID de type TEXT (ex: 'm-dune-2', '693134')
CREATE TABLE public.media (
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

-- 4. Table des Épisodes (Pour les séries)
CREATE TABLE public.episodes (
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

-- 5. Table des Favoris ("Ma Liste")
CREATE TABLE public.favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id TEXT REFERENCES public.media(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_favorite UNIQUE(user_id, media_id)
);

-- 6. Table de Reprise de Lecture Automatique & Historique (Continue Watching)
CREATE TABLE public.user_history (
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

-- 7. Table des Profils Utilisateurs
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour la rapidité des requêtes
CREATE INDEX IF NOT EXISTS idx_media_type ON public.media(type);
CREATE INDEX IF NOT EXISTS idx_media_trending ON public.media(is_trending);
CREATE INDEX IF NOT EXISTS idx_media_featured ON public.media(is_featured);
CREATE INDEX IF NOT EXISTS idx_episodes_media ON public.episodes(media_id, season_number);
CREATE INDEX IF NOT EXISTS idx_history_user ON public.user_history(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON public.favorites(user_id);

-- ======================================================
-- FONCTIONS & TRIGGERS
-- ======================================================

-- Crée automatiquement le profil utilisateur à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger automatique de mise à jour timestamp updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_user_history_updated_at ON public.user_history;
CREATE TRIGGER set_user_history_updated_at
    BEFORE UPDATE ON public.user_history
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ======================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ======================================================

ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour le catalogue
DROP POLICY IF EXISTS "Public Read Access for Media" ON public.media;
CREATE POLICY "Public Read Access for Media" 
ON public.media FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Read Access for Episodes" ON public.episodes;
CREATE POLICY "Public Read Access for Episodes" 
ON public.episodes FOR SELECT USING (true);

-- Polices pour les Favoris
DROP POLICY IF EXISTS "Users can view their own favorites" ON public.favorites;
CREATE POLICY "Users can view their own favorites" 
ON public.favorites FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert into their own favorites" ON public.favorites;
CREATE POLICY "Users can insert into their own favorites" 
ON public.favorites FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete from their own favorites" ON public.favorites;
CREATE POLICY "Users can delete from their own favorites" 
ON public.favorites FOR DELETE USING (auth.uid() = user_id);

-- Polices pour l'historique et la reprise de lecture
DROP POLICY IF EXISTS "Users can view their history" ON public.user_history;
CREATE POLICY "Users can view their history" 
ON public.user_history FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their history" ON public.user_history;
CREATE POLICY "Users can insert their history" 
ON public.user_history FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their history" ON public.user_history;
CREATE POLICY "Users can update their history" 
ON public.user_history FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their history" ON public.user_history;
CREATE POLICY "Users can delete their history" 
ON public.user_history FOR DELETE USING (auth.uid() = user_id);

-- Polices pour les profils
DROP POLICY IF EXISTS "Public read access for profiles" ON public.profiles;
CREATE POLICY "Public read access for profiles" 
ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ======================================================
-- DONNÉES DE DÉPART (SEED DATA)
-- ======================================================

INSERT INTO public.media (
    id, title, slug, type, synopsis, poster_url, backdrop_url, rating, release_year, duration, genres, languages, is_trending, is_featured, video_servers
) VALUES 
(
    'm-dune-2',
    'Dune: Deuxième Partie',
    'dune-deuxieme-partie',
    'movie',
    'Paul Atreides s''unit à Chani et aux Fremen tout en menant une quête de vengeance contre les conspirateurs qui ont détruit sa famille. Face à un choix entre l''amour de sa vie et le destin de l''univers, il s''efforce d''empêcher un futur terrible.',
    'https://image.tmdb.org/t/p/w500/1pdfLPoLMag8St86TjKVChLvisE.jpg',
    'https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fKSuV0vqv.jpg',
    8.6,
    2024,
    '2h 46m',
    ARRAY['Science-Fiction', 'Aventure', 'Action'],
    ARRAY['VF', 'VOSTFR'],
    true,
    true,
    '[
        {"name": "Serveur VF 1 (HD)", "url": "https://vidsrc.to/embed/movie/693134", "quality": "1080p", "lang": "VF"},
        {"name": "Serveur VF 2 (Fast)", "url": "https://vidsrc.me/embed/movie?imdb=tt15239678", "quality": "1080p", "lang": "VF"},
        {"name": "Serveur VOSTFR", "url": "https://vidsrc.to/embed/movie/693134", "quality": "1080p", "lang": "VOSTFR"}
    ]'::jsonb
),
(
    's-arcane',
    'Arcane',
    'arcane',
    'tv',
    'Au cœur du conflit entre les villes jumelles de Piltover et Zaun, deux sœurs se battent dans les camps opposés d''une guerre entre technologies magiques et convictions incompatibles.',
    'https://image.tmdb.org/t/p/w500/abR6I0n3z6p2N46T30wN5s0X7l.jpg',
    'https://image.tmdb.org/t/p/original/q82L4W4clyc0w7bY9rJzE3L0M0r.jpg',
    9.1,
    2024,
    '2 Saisons',
    ARRAY['Animation', 'Action', 'Science-Fiction', 'Drame'],
    ARRAY['VF', 'VOSTFR'],
    true,
    true,
    '[]'::jsonb
),
(
    'm-deadpool-wolverine',
    'Deadpool & Wolverine',
    'deadpool-and-wolverine',
    'movie',
    'Un Deadpool apathique rejoint un Wolverine blessé et réticent pour sauver leur univers d''une menace existentielle majeure.',
    'https://image.tmdb.org/t/p/w500/8cdWjvZ276Y097hR3aVl856hA02.jpg',
    'https://image.tmdb.org/t/p/original/yDHYTfA3R0jFYba16jBB12vYwG1.jpg',
    7.9,
    2024,
    '2h 08m',
    ARRAY['Action', 'Comédie', 'Science-Fiction'],
    ARRAY['VF', 'VOSTFR'],
    true,
    false,
    '[
        {"name": "Serveur VF 1 (Ultra HD)", "url": "https://vidsrc.to/embed/movie/533535", "quality": "4K", "lang": "VF"},
        {"name": "Serveur VF 2", "url": "https://vidsrc.me/embed/movie?imdb=tt6263850", "quality": "1080p", "lang": "VF"},
        {"name": "Serveur VOSTFR", "url": "https://vidsrc.cc/v2/embed/movie/533535", "quality": "1080p", "lang": "VOSTFR"}
    ]'::jsonb
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.episodes (media_id, season_number, episode_number, title, synopsis, still_path, video_servers)
VALUES 
(
    's-arcane',
    1,
    1,
    'Saison 1 - Épisode 1: Le chaos s''invite chez nous',
    'Vi et Powder tentent le casse du siècle dans un laboratoire huppé du haut Piltover, sans se douter des conséquences explosives.',
    'https://image.tmdb.org/t/p/w500/v9D4s8f22z4aW4rT72bX8c9e.jpg',
    '[{"name": "Serveur VF 1", "url": "https://vidsrc.to/embed/tv/94605/1/1", "quality": "1080p", "lang": "VF"}]'::jsonb
),
(
    's-arcane',
    1,
    2,
    'Saison 1 - Épisode 2: Tout le monde veut être mon ennemi',
    'Alors que les autorités traquent les coupables, le mystérieux Hextech commence à attirer les convoitises de l''académie.',
    'https://image.tmdb.org/t/p/w500/w7rT73x98e8s9Xz12y4a.jpg',
    '[{"name": "Serveur VF 1", "url": "https://vidsrc.to/embed/tv/94605/1/2", "quality": "1080p", "lang": "VF"}]'::jsonb
) ON CONFLICT (media_id, season_number, episode_number) DO NOTHING;
