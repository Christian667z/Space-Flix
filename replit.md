# SpaceFlix

## Vue d’ensemble

SpaceFlix est une application web de catalogue et de lecture de films et séries. Le serveur Express sert directement le dossier `Frontend/`, tandis que l’interface utilise des modules JavaScript natifs et les données TMDB/Supabase déjà prévues par le projet.

## Lancer le projet

```bash
npm start
```

Le serveur écoute sur le port fourni par `PORT` (3000 en local). La page principale de navigation est `Frontend/index.html`; la page des filtres et du lecteur est `Frontend/filters.html`.

## Préférences du projet

- Conserver la stack existante (Express + HTML/CSS/JavaScript natif).
- Utiliser les chemins relatifs pour les appels entre le frontend et le serveur.
- Garder l’interface en français.
- Ne pas déplacer le projet vers un framework ou une architecture monorepo sans demande explicite.