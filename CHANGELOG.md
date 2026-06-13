# Changelog

Release notes for Plex Poster Set Helper 2. The Build & Release workflow reads the
section whose heading matches the pushed tag and uses it as the GitHub release body,
so keep each version under its own `## What's new in vX.Y.Z` heading.

## What's new in v2.0.24

### Smarter matching for manual scrapes and bulk lists
Pasted MediUX links and saved bulk lists now match your library by **TMDB id** - the same exact matching the Library Browser uses - instead of guessing by title and year. That means fewer "not in library" misses and wrong-title applies, especially for TVDB/IMDb-agent libraries (such as anime via HAMA).

### Collection sets apply to the whole collection by default
Applying a MediUX collection set now spreads across every movie in the collection that's in your library, plus the collection poster, right out of the box. The per-set toggle still lets you narrow it back to just the title you're viewing.

### Redesigned manual import
- A cleaner tabbed header (**Scrape URLs** / **Bulk Files**) with a sliding indicator.
- A themed paste box - the stray white resize grip and chunky native scrollbar are gone.
- Quick **Browse** buttons open ThePosterDB and MediUX in your browser, right where you paste links.

### In-app Docker update guide
Docker and unraid builds can't self-update, and the container has no desktop to open a link on. The update notice now opens an in-app guide with copy-ready **pull, rebuild, restart** commands for unraid, Windows, Mac/Linux, and Compose.

### Now on unraid Community Applications
Install it straight from the unraid **Apps** tab - search _Plex Poster Helper_. It pulls the prebuilt Docker Hub image and gives you a WebUI button, no commands needed.

## What's new in v2.0.23

### Redesigned navigation: bottom dock
The left sidebar is gone, replaced by a floating dock at the bottom of the window. Navigation stays out of the way, pages get the full width, and the whole layout feels cleaner and more focused.

### Instant search (Ctrl/Cmd+F)
A new command palette puts everything a keystroke away. Press **Ctrl+F** (**Cmd+F** on macOS) from anywhere to:
- Jump straight to any page or Settings section
- Find a movie or show across all your libraries and open its MediUX sets
- Open a MediUX creator
No more hunting through menus.

### Smarter TMDB ID matching (optional API key)
Library matching now prefers exact TMDB IDs instead of guessing by title and year. Add a free TMDB v3 API key in **Settings** and the tool will:
- Match titles by ID, fixing most matching and title-mapping issues automatically
- Resolve TVDB/IMDb-agent libraries (such as anime via HAMA) to the correct TMDB entries

The key is optional. Without it, matching falls back to title and year as before.
