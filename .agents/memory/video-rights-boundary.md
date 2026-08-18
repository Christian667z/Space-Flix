---
name: Video rights boundary
description: Product constraint for full-length video playback sources.
---

Full-length playback sources must be explicitly authorized by the project owner or supplied by a licensed video provider. TMDB is suitable for catalogue metadata and official trailers, but does not provide full-film streaming rights.

**Why:** Catalogue identifiers alone cannot establish distribution rights, and relying on unstable third-party embeds makes playback unreliable.

**How to apply:** Keep configured media sources separate from metadata fallbacks. When no authorized full stream exists, show an official trailer or a clear setup message rather than inventing or silently substituting an unverified stream URL.