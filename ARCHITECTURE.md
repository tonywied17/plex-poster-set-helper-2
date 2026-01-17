# Plex Poster Set Helper - Architecture Documentation

> **A comprehensive visual guide to the application's layered architecture**

## Table of Contents
- [System Overview](#-system-overview)
- [Architecture Layers](#-architecture-layers)
- [Data Flow](#-data-flow)
- [Component Interaction](#-component-interaction)
- [Technology Stack](#-technology-stack)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PLEX POSTER SET HELPER                               │
│                                                                         │
│  Purpose: Automated poster scraping and uploading for Plex libraries   │
│  Pattern: Layered Architecture with Service-Oriented Design            │
│  Interfaces: Dual-mode (CLI + GUI)                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Layers

### Layer 0: Entry Point
```
┌─────────────────────────────────────────────────────────────────┐
│                          main.py                                │
├─────────────────────────────────────────────────────────────────┤
│  Responsibilities:                                              │
│  • Application bootstrap and initialization                     │
│  • Playwright browser dependency check & installation           │
│  • Command-line argument routing                                │
│  • Cleanup & lifecycle management                               │
│                                                                 │
│  Entry Modes:                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │   GUI   │  │   CLI   │  │  BULK   │  │   URL   │          │
│  │  mode   │  │  mode   │  │  mode   │  │  mode   │          │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘          │
│       │            │             │             │                │
│       └────────────┴─────────────┴─────────────┘                │
│                         ▼                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

### Layer 1: User Interface Layer

```
┌────────────────────────────────────────────────────────────────────────┐
│                          UI LAYER (src/ui/)                            │
├───────────────────────────────┬────────────────────────────────────────┤
│         GUI MODULE            │          CLI MODULE                    │
│    (CustomTkinter-based)      │      (Interactive Terminal)            │
├───────────────────────────────┼────────────────────────────────────────┤
│                               │                                        │
│  ┌─────────────────────────┐ │  ┌──────────────────────────────────┐ │
│  │   PlexPosterGUI         │ │  │   PlexPosterCLI                  │ │
│  │   (app.py)              │ │  │   (app.py)                       │ │
│  └───────┬─────────────────┘ │  └────────┬─────────────────────────┘ │
│          │                    │           │                           │
│  ┌───────▼─────────────────┐ │  ┌────────▼───────────────────────┐  │
│  │  Tab Components:        │ │  │  Handler Components:           │  │
│  │                         │ │  │                                │  │
│  │  • PosterScrapeTab      │ │  │  • URLHandler                  │  │
│  │  • BulkImportTab        │ │  │  • MappingHandler              │  │
│  │  • TitleMappingsTab     │ │  │  • ResetHandler                │  │
│  │  • ManageLabelsTab      │ │  │  • StatsHandler                │  │
│  │  • SettingsTab          │ │  │                                │  │
│  └───────┬─────────────────┘ │  └────────┬───────────────────────┘  │
│          │                    │           │                           │
│  ┌───────▼─────────────────┐ │           │                           │
│  │  UI Handlers:           │ │           │                           │
│  │                         │ │           │                           │
│  │  • ScrapeHandler        │ │           │                           │
│  │  • LabelHandler         │ │           │                           │
│  └───────┬─────────────────┘ │           │                           │
│          │                    │           │                           │
│  ┌───────▼─────────────────┐ │           │                           │
│  │  Widgets:               │ │           │                           │
│  │                         │ │           │                           │
│  │  • DynamicList          │ │           │                           │
│  │  • DoubleEntryRow       │ │           │                           │
│  │  • EntryRow             │ │           │                           │
│  │  • SliderControl        │ │           │                           │
│  │  • UIHelpers            │ │           │                           │
│  └─────────────────────────┘ │           │                           │
│                               │           │                           │
└───────────────┬───────────────┴───────────┬───────────────────────────┘
                │                           │
                └───────────┬───────────────┘
                            ▼
```

**UI Layer Features:**
- **Dual Interface Support**: Both GUI (CustomTkinter) and CLI (Terminal-based)
- **Modular Tab System**: Separated concerns for different functionalities
- **Reusable Widgets**: Custom UI components for consistency
- **Handler Pattern**: Business logic separated from UI rendering

---

### Layer 2: Service Layer

```
┌────────────────────────────────────────────────────────────────────────┐
│                   SERVICE LAYER (src/services/)                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐ │
│  │   PlexService                │    │  PosterUploadService         │ │
│  │   (plex_service.py)          │    │  (poster_upload_service.py)  │ │
│  ├──────────────────────────────┤    ├──────────────────────────────┤ │
│  │  Responsibilities:           │    │  Responsibilities:           │ │
│  │  • Server connection mgmt    │    │  • Poster image download     │ │
│  │  • Library discovery         │    │  • Temp file management      │ │
│  │  • Media item search         │    │  • Plex upload coordination  │ │
│  │  • Title matching & fuzzy    │    │  • Rate limiting (0.5-1s)    │ │
│  │  • Label management          │    │  • Source-based labels       │ │
│  │  • Statistics gathering      │    │  • Batch processing          │ │
│  │                              │    │  • Error handling            │ │
│  │  Key Methods:                │    │                              │ │
│  │  • setup()                   │    │  Key Methods:                │ │
│  │  • find_movie()              │    │  • upload_poster()           │ │
│  │  • find_tv_show()            │    │  • _download_image()         │ │
│  │  • find_collection()         │    │  • _cleanup_temp_file()      │ │
│  │  • fuzzy_match()             │    │  • _rate_limit()             │ │
│  │  • get_all_labels()          │    │  • _add_source_labels()      │ │
│  │  • remove_labels()           │    │  • process_posters()         │ │
│  │  • gather_stats()            │    │                              │ │
│  │                              │    │                              │ │
│  │  Dependencies:               │    │  Dependencies:               │ │
│  │  • plexapi library           │    │  • requests library          │ │
│  │  • FuzzyWuzzy matching       │    │  • tempfile module           │ │
│  └──────────────┬───────────────┘    └───────────┬──────────────────┘ │
│                 │                                 │                    │
│                 └─────────────┬───────────────────┘                    │
└───────────────────────────────┼────────────────────────────────────────┘
                                │
                                ▼
```

**Service Layer Characteristics:**
- **Business Logic Hub**: Core operations isolated from UI
- **PlexAPI Integration**: Direct communication with Plex Media Server
- **Stateful Services**: Maintain connections and configurations
- **Error Handling**: Comprehensive exception management

---

### Layer 3: Scraper Layer

```
┌────────────────────────────────────────────────────────────────────────┐
│                   SCRAPER LAYER (src/scrapers/)                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                     ScraperFactory                               │ │
│  │                  (scraper_factory.py)                            │ │
│  ├──────────────────────────────────────────────────────────────────┤ │
│  │  • URL routing and detection                                     │ │
│  │  • Scraper instance creation                                     │ │
│  │  • Thread-safe operations                                        │ │
│  │  • Local HTML file support                                       │ │
│  └───────┬──────────────────────────────────────────────────────────┘ │
│          │                                                            │
│          │          Factory Pattern                                  │
│          │                                                            │
│  ┌───────▼────────────────────────────────────────────────┐          │
│  │              BaseScraper (ABC)                         │          │
│  │           (base_scraper.py)                            │          │
│  ├────────────────────────────────────────────────────────┤          │
│  │  Provides:                                             │          │
│  │  • Playwright browser automation                       │          │
│  │  • Anti-detection measures:                            │          │
│  │    - User agent rotation (7 variants)                  │          │
│  │    - Viewport randomization (5 sizes)                  │          │
│  │    - Random delays & human-like timing                 │          │
│  │    - Stealth mode configuration                        │          │
│  │  • Rate limiting & batch delays                        │          │
│  │  • Context manager protocol                            │          │
│  │  • Abstract methods for implementation                 │          │
│  │                                                         │          │
│  │  Configuration:                                        │          │
│  │  • Min delay: 0.1s (configurable)                      │          │
│  │  • Max delay: 0.5s (configurable)                      │          │
│  │  • Batch delay: 2.0s every 10 requests                 │          │
│  │  • Page wait: 0.0-0.5s for JS execution                │          │
│  └───────┬─────────────────────────────────┬──────────────┘          │
│          │                                 │                          │
│  ┌───────▼─────────────┐         ┌────────▼────────────┐             │
│  │  PosterDBScraper    │         │  MediuxScraper      │             │
│  │  (posterdb_scraper) │         │  (mediux_scraper)   │             │
│  ├─────────────────────┤         ├─────────────────────┤             │
│  │  Sources:           │         │  Sources:           │             │
│  │  • Set pages        │         │  • Set collections  │             │
│  │  • User profiles    │         │  • Poster galleries │             │
│  │  • Single posters   │         │                     │             │
│  │                     │         │  Capabilities:      │             │
│  │  Capabilities:      │         │  • Multi-page nav   │             │
│  │  • Multi-page scrape│         │  • Image extraction │             │
│  │  • Metadata extract │         │  • Title parsing    │             │
│  │  • Season/Episode   │         │                     │             │
│  │  • Collections      │         │                     │             │
│  └─────────────────────┘         └─────────────────────┘             │
│                                                                        │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
                                 ▼
```

**Scraper Layer Intelligence:**
- **Playwright-Powered**: Full browser automation with JavaScript support
- **Multi-Source Support**: ThePosterDB, MediUX, Local HTML
- **Anti-Scraping Bypass**: Human-like behavior simulation
- **Parallel Safe**: Thread-safe design for concurrent operations

---

### Layer 4: Core Layer

```
┌────────────────────────────────────────────────────────────────────────┐
│                      CORE LAYER (src/core/)                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│  │   ConfigManager  │  │    Logger        │  │   PosterInfo     │    │
│  │   (config.py)    │  │  (logger.py)     │  │   (models.py)    │    │
│  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤    │
│  │ • JSON storage   │  │ • Centralized    │  │ • Data class     │    │
│  │ • Config schema  │  │ • File logging   │  │ • Type hints     │    │
│  │ • Validation     │  │ • Debug levels   │  │ • Metadata       │    │
│  │ • Defaults       │  │ • UTF-8 support  │  │                  │    │
│  │                  │  │                  │  │ Fields:          │    │
│  │ Settings:        │  │ Output:          │  │ • title: str     │    │
│  │ • base_url       │  │ • debug.log      │  │ • url: str       │    │
│  │ • token          │  │ • Console echo   │  │ • source: str    │    │
│  │ • libraries      │  │                  │  │ • year: int?     │    │
│  │ • bulk_files     │  │                  │  │ • season: any?   │    │
│  │ • mappings       │  │                  │  │ • episode: any?  │    │
│  │ • max_workers    │  │                  │  │                  │    │
│  │ • scraper delays │  │                  │  │ Methods:         │    │
│  │ • log_file       │  │                  │  │ • is_tv_show()   │    │
│  │                  │  │                  │  │ • is_movie()     │    │
│  │                  │  │                  │  │ • is_collection()│    │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

**Core Components:**
- **Configuration Management**: Centralized JSON-based settings
- **Logging Infrastructure**: Detailed debug and operation tracking
- **Data Models**: Type-safe domain objects

---

### Layer 5: Utilities Layer

```
┌────────────────────────────────────────────────────────────────────────┐
│                    UTILITIES LAYER (src/utils/)                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────────────┐    ┌──────────────────────────────┐  │
│  │   Helpers                   │    │   TextUtils                  │  │
│  │   (helpers.py)              │    │   (text_utils.py)            │  │
│  ├─────────────────────────────┤    ├──────────────────────────────┤  │
│  │  • resource_path()          │    │  • parse_urls()              │  │
│  │  • get_exe_dir()            │    │  • URL extraction from text  │  │
│  │  • Path resolution          │    │  • Multi-line support        │  │
│  │  • Asset loading            │    │  • Format validation         │  │
│  └─────────────────────────────┘    └──────────────────────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Complete User Journey: Scraping and Uploading Posters

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           DATA FLOW DIAGRAM                              │
└──────────────────────────────────────────────────────────────────────────┘

    USER INPUT
       │
       │  (1) URL or Bulk File
       ▼
┌──────────────┐
│  Entry Point │  main.py
│  (Layer 0)   │  • Validates Playwright installation
└──────┬───────┘  • Routes to appropriate interface
       │
       │  (2) Command routing
       ▼
┌──────────────────────────────────┐
│    UI Layer (Layer 1)            │
│  ┌────────────┐  ┌─────────────┐ │
│  │ GUI (Tabs) │  │ CLI (Menu)  │ │
│  └─────┬──────┘  └──────┬──────┘ │
└────────┼─────────────────┼────────┘
         │                 │
         │  (3) User selects scraping operation
         ▼
┌─────────────────────────────────────────┐
│   Scraper Factory (Layer 3)             │
│   • Detects URL type                    │
│   • Creates appropriate scraper         │
└─────────────┬───────────────────────────┘
              │
              │  (4) URL analysis
              ▼
┌─────────────────────────────────────────┐
│   Specific Scraper (Layer 3)            │
│  ┌──────────────┐  ┌─────────────┐      │
│  │ PosterDB     │  │  MediUX     │      │
│  │ Scraper      │  │  Scraper    │      │
│  └──────┬───────┘  └──────┬──────┘      │
└─────────┼──────────────────┼─────────────┘
          │                  │
          │  (5) Playwright automation
          ▼
    ┌─────────────────┐
    │  External Site  │  ThePosterDB.com / MediUX.pro
    │                 │  • HTML parsing
    │                 │  • Image URLs extracted
    │                 │  • Metadata scraped
    └────────┬────────┘
             │
             │  (6) Returns PosterInfo objects
             ▼
    ┌──────────────────────────┐
    │  PosterInfo List         │
    │  (Core Layer - Layer 4)  │
    │  [PosterInfo(...),       │
    │   PosterInfo(...),       │
    │   PosterInfo(...)]       │
    └────────┬─────────────────┘
             │
             │  (7) Passes to upload service
             ▼
    ┌────────────────────────────────────┐
    │  PosterUploadService (Layer 2)     │
    │  • Iterates poster list            │
    │  • Downloads each image            │
    │  • Creates temp files              │
    └────────┬───────────────────────────┘
             │
             │  (8) For each poster
             ▼
    ┌────────────────────────────┐
    │  PlexService (Layer 2)     │
    │  • Searches media library  │
    │  • Matches title (fuzzy)   │
    │  • Identifies media item   │
    └────────┬───────────────────┘
             │
             │  (9) Media item found
             ▼
    ┌────────────────────────────┐
    │  Upload Operation          │
    │  • item.uploadPoster()     │
    │  • Add source labels       │
    │  • Apply rate limiting     │
    │  • Cleanup temp file       │
    └────────┬───────────────────┘
             │
             │  (10) PlexAPI call
             ▼
    ┌─────────────────────┐
    │   Plex Media Server │  External
    │   • Poster updated  │
    │   • Labels added    │
    └─────────────────────┘
             │
             │  (11) Success/Error
             ▼
    ┌─────────────────────┐
    │  Logger (Layer 4)   │
    │  • Records to file  │
    │  • Console output   │
    └─────────────────────┘
             │
             │  (12) Visual feedback
             ▼
    ┌─────────────────────┐
    │  UI Layer           │
    │  • Progress update  │
    │  • Success count    │
    │  • Error reporting  │
    └─────────────────────┘
             │
             ▼
         USER
```

---

## Component Interaction

### Dependency Graph

```
┌────────────────────────────────────────────────────────────────┐
│                  COMPONENT DEPENDENCIES                        │
└────────────────────────────────────────────────────────────────┘

┌─────────────┐
│   main.py   │ Entry Point
└──────┬──────┘
       │
       ├─────────────────────────────────┐
       │                                 │
       ▼                                 ▼
┌──────────────┐                  ┌─────────────┐
│ PlexPosterGUI│                  │PlexPosterCLI│
└──────┬───────┘                  └──────┬──────┘
       │                                 │
       ├─────────────────────────────────┤
       │                                 │
       ├──────────┬──────────────────────┤
       │          │                      │
       ▼          ▼                      ▼
┌─────────┐ ┌─────────────┐  ┌──────────────────┐
│ Plex    │ │   Poster    │  │  Scraper         │
│ Service │ │   Upload    │  │  Factory         │
│         │ │   Service   │  │                  │
└────┬────┘ └──────┬──────┘  └────────┬─────────┘
     │             │                  │
     │             │                  ▼
     │             │         ┌─────────────────┐
     │             │         │  PosterDB/      │
     │             │         │  Mediux Scraper │
     │             │         └────────┬────────┘
     │             │                  │
     ▼             ▼                  ▼
┌────────────────────────────────────────┐
│         Core Components:               │
│  • ConfigManager                       │
│  • Logger                              │
│  • PosterInfo                          │
└────────────────────────────────────────┘
     │             │
     ▼             ▼
┌────────────────────────────────────────┐
│      External Dependencies:            │
│  • plexapi (Plex server)               │
│  • playwright (Browser automation)     │
│  • requests (HTTP client)              │
│  • customtkinter (GUI)                 │
│  • beautifulsoup4 (HTML parsing)       │
│  • fuzzywuzzy (Fuzzy matching)         │
└────────────────────────────────────────┘
```

### Interaction Patterns

#### 1. **Observer Pattern** (GUI Event Handling)
```
User Action (Button Click)
    │
    ▼
Tab Component Event Handler
    │
    ▼
Handler Class (ScrapeHandler/LabelHandler)
    │
    ▼
Service Layer Methods
    │
    ▼
UI Callback (Update Progress/Status)
```

#### 2. **Factory Pattern** (Scraper Creation)
```
ScraperFactory.scrape_url(url)
    │
    ├─ if "theposterdb.com" → PosterDBScraper
    ├─ if "mediux.pro" → MediuxScraper
    └─ if ".html" → Local HTML Parser
```

#### 3. **Context Manager Pattern** (Resource Management)
```python
with PosterDBScraper(use_playwright=True) as scraper:
    posters = scraper.scrape(url)
    # Browser automatically cleaned up
```

#### 4. **Service Pattern** (Business Logic Encapsulation)
```
UI Layer ──calls──> Service Layer ──manages──> External APIs
                        │
                        └──uses──> Core Models/Config
```

---

## Technology Stack

### Core Technologies

```
┌──────────────────────────────────────────────────────────────┐
│                    TECHNOLOGY STACK                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Language:  Python 3.10+                                     │
│                                                              │
│  UI Frameworks:                                              │
│  ├─ CustomTkinter (Modern GUI)                               │
│  └─ Native Terminal (CLI)                                    │
│                                                              │
│  Web Automation:                                             │
│  ├─ Playwright (Browser automation)                          │
│  ├─ BeautifulSoup4 (HTML parsing)                            │
│  └─ Requests (HTTP client)                                   │
│                                                              │
│  Plex Integration:                                           │
│  └─ PlexAPI (Official Plex library)                          │
│                                                              │
│  Data Processing:                                            │
│  ├─ FuzzyWuzzy (Fuzzy string matching)                       │
│  └─ Python-Levenshtein (String distance)                     │
│                                                              │
│  Utilities:                                                  │
│  ├─ Pillow (Image processing)                                │
│  ├─ Dataclasses (Type-safe models)                           │
│  └─ Threading (Concurrent operations)                        │
│                                                              │
│  Development:                                                │
│  ├─ PyInstaller (Executable packaging)                       │
│  └─ setuptools (Package distribution)                        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Design Patterns Summary

| Pattern | Location | Purpose |
|---------|----------|---------|
| **Layered Architecture** | Entire App | Separation of concerns |
| **Factory** | ScraperFactory | Dynamic scraper creation |
| **Strategy** | BaseScraper + Implementations | Pluggable scraping algorithms |
| **Service** | PlexService, UploadService | Business logic encapsulation |
| **Repository** | ConfigManager | Data persistence abstraction |
| **Observer** | GUI Event System | Event-driven UI updates |
| **Context Manager** | Scrapers | Resource lifecycle management |
| **Singleton** | Logger | Centralized logging |
| **Handler Chain** | CLI/GUI Handlers | Request processing pipeline |

---

## Key Features by Layer

### Layer Responsibilities Matrix

```
╔═══════════════════╦══════════════════════════════════════════════════════╗
║     Layer         ║                  Responsibilities                    ║
╠═══════════════════╬══════════════════════════════════════════════════════╣
║ Entry Point       ║ • Bootstrap & dependency check                       ║
║ (main.py)         ║ • Command routing                                    ║
║                   ║ • Application lifecycle                              ║
╠═══════════════════╬══════════════════════════════════════════════════════╣
║ UI Layer          ║ • User interaction                                   ║
║ (src/ui/)         ║ • Input validation                                   ║
║                   ║ • Visual feedback & progress                         ║
║                   ║ • Dual interface (GUI/CLI)                           ║
╠═══════════════════╬══════════════════════════════════════════════════════╣
║ Service Layer     ║ • Business logic                                     ║
║ (src/services/)   ║ • Plex API integration                               ║
║                   ║ • Media matching & search                            ║
║                   ║ • Poster download/upload                             ║
║                   ║ • Rate limiting & concurrency                        ║
╠═══════════════════╬══════════════════════════════════════════════════════╣
║ Scraper Layer     ║ • Web scraping automation                            ║
║ (src/scrapers/)   ║ • Anti-detection measures                            ║
║                   ║ • Multi-source support                               ║
║                   ║ • Metadata extraction                                ║
╠═══════════════════╬══════════════════════════════════════════════════════╣
║ Core Layer        ║ • Configuration management                           ║
║ (src/core/)       ║ • Logging infrastructure                             ║
║                   ║ • Data models & types                                ║
╠═══════════════════╬══════════════════════════════════════════════════════╣
║ Utilities Layer   ║ • Helper functions                                   ║
║ (src/utils/)      ║ • Text processing                                    ║
║                   ║ • Path resolution                                    ║
╚═══════════════════╩══════════════════════════════════════════════════════╝
```

---

## Configuration Flow

```
config.json (File System)
        │
        │ Read/Write
        ▼
┌──────────────────┐
│  ConfigManager   │
│  • Loads JSON    │
│  • Validates     │
│  • Provides      │
│    defaults      │
└────────┬─────────┘
         │
         │ Creates Config object
         ▼
┌──────────────────┐
│  Config          │
│  (Dataclass)     │
│  • base_url      │
│  • token         │
│  • libraries     │
│  • mappings      │
│  • delays        │
│  • etc...        │
└────────┬─────────┘
         │
         │ Injected into
         ▼
┌──────────────────────────────┐
│  All Services & Components   │
│  • PlexService               │
│  • Scrapers                  │
│  • Upload Service            │
│  • UI Components             │
└──────────────────────────────┘
```

---

## Execution Modes

### 1. GUI Mode
```
$ python main.py gui

┌─────────────────────────────────┐
│  CustomTkinter Window Opens     │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Poster Scrape Tab         │  │
│  │ • URL input               │  │
│  │ • Library selection       │  │
│  │ • Scrape button           │  │
│  └───────────────────────────┘  │
│                                 │
│  Threading for async ops        │
│  Real-time progress updates     │
└─────────────────────────────────┘
```

### 2. CLI Interactive Mode
```
$ python main.py cli

╔═══════════════════════════════════════╗
║   PLEX POSTER SET HELPER - CLI        ║
╠═══════════════════════════════════════╣
║  1. Scrape single URL                 ║
║  2. Bulk import from file             ║
║  3. Manage title mappings             ║
║  4. Reset labels/posters              ║
║  5. View statistics                   ║
║  6. Settings                          ║
║  7. Exit                              ║
╚═══════════════════════════════════════╝
```

### 3. Bulk Processing Mode
```
$ python main.py bulk [file.txt]

• Reads URLs from file
• Processes sequentially
• Automated execution
• No user interaction needed
```

### 4. Single URL Mode
```
$ python main.py https://theposterdb.com/set/12345

• Direct URL processing
• Quick one-off scrapes
• Scriptable
```

---

## Performance Characteristics

### Concurrency Model

```
┌─────────────────────────────────────────────────────────────┐
│              CONCURRENCY & THREADING                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Main Thread (UI)                                           │
│  └─ GUI rendering / CLI interaction                         │
│                                                             │
│  Worker Threads (max_workers: 3)                            │
│  ├─ Thread 1: Scraping operations                           │
│  ├─ Thread 2: Upload operations                             │
│  └─ Thread 3: Background tasks                              │
│                                                             │
│  Rate Limiting:                                             │
│  • PosterDB: 0.5s per request                               │
│  • MediUX: 1.0s per request                                 │
│  • Batch delay: 2.0s every 10 items                         │
│                                                             │
│  Thread Safety:                                             │
│  • ScraperFactory uses threading.Lock                       │
│  • Services are thread-safe                                 │
│  • Config is read-only after init                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Error Handling Strategy

```
┌──────────────────────────────────────────────────────┐
│            ERROR HANDLING LAYERS                     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Layer 1: Input Validation                           │
│  ├─ URL format checking                              │
│  ├─ Configuration validation                         │
│  └─ User input sanitization                          │
│                                                      │
│  Layer 2: Service Level                              │
│  ├─ Plex connection errors                           │
│  ├─ Network timeout handling                         │
│  ├─ API authentication failures                      │
│  └─ Graceful degradation                             │
│                                                      │
│  Layer 3: Scraper Level                              │
│  ├─ Page load failures                               │
│  ├─ Element not found                                │
│  ├─ Playwright crashes                               │
│  └─ Retry mechanisms                                 │
│                                                      │
│  Layer 4: Logging & Recovery                         │
│  ├─ Exception capture                                │
│  ├─ Debug log writing                                │
│  ├─ User-friendly error messages                     │
│  └─ Cleanup on failure                               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Future Architecture Considerations

### Potential Enhancements

1. **Plugin System**
   - Dynamic scraper loading
   - Custom source integration
   - User-defined processors

2. **Database Layer**
   - SQLite for cache
   - Scraping history
   - Faster lookups

3. **API Layer**
   - RESTful API endpoint
   - Web interface
   - Remote control

4. **Microservices**
   - Separate scraping service
   - Queue-based architecture
   - Horizontal scaling

---

## File Structure Mapping

```
plex-poster-set-helper/
│
├─ main.py ................................. Entry Point (Layer 0)
├─ config.json ............................. Configuration Storage
├─ requirements.txt ........................ Dependencies
├─ setup.py ................................ Installation Script
│
├─ src/
│  ├─ __init__.py
│  │
│  ├─ ui/ .................................. UI Layer (Layer 1)
│  │  ├─ cli/
│  │  │  ├─ app.py ......................... CLI Application
│  │  │  └─ handlers/
│  │  │     ├─ url_handler.py
│  │  │     ├─ mapping_handler.py
│  │  │     ├─ reset_handler.py
│  │  │     └─ stats_handler.py
│  │  │
│  │  └─ gui/
│  │     ├─ app.py ......................... GUI Application
│  │     ├─ tabs/ .......................... Tab Components
│  │     ├─ handlers/ ...................... Business Handlers
│  │     └─ widgets/ ....................... Reusable Widgets
│  │
│  ├─ services/ ............................ Service Layer (Layer 2)
│  │  ├─ plex_service.py ................... Plex Integration
│  │  └─ poster_upload_service.py .......... Upload Logic
│  │
│  ├─ scrapers/ ............................ Scraper Layer (Layer 3)
│  │  ├─ base_scraper.py ................... Abstract Base
│  │  ├─ scraper_factory.py ................ Factory
│  │  ├─ posterdb_scraper.py ............... PosterDB Implementation
│  │  └─ mediux_scraper.py ................. MediUX Implementation
│  │
│  ├─ core/ ................................ Core Layer (Layer 4)
│  │  ├─ config.py ......................... Configuration
│  │  ├─ logger.py ......................... Logging
│  │  └─ models.py ......................... Data Models
│  │
│  └─ utils/ ............................... Utilities Layer (Layer 5)
│     ├─ helpers.py ........................ Helper Functions
│     └─ text_utils.py ..................... Text Processing
│
└─ build/ .................................. Build Artifacts
   └─ icons/ ............................... Application Icons
```

---

## Quick Reference: Component Communication

| From Component | To Component | Communication Method | Data Passed |
|----------------|--------------|---------------------|-------------|
| main.py | GUI/CLI App | Direct instantiation | Config object |
| UI Tabs | Handlers | Method calls | User input |
| Handlers | Services | Service methods | Processing requests |
| Services | ScraperFactory | Factory method | URL string |
| ScraperFactory | Specific Scraper | Context manager | Config object |
| Scraper | External Site | Playwright/Requests | HTTP requests |
| Scraper | UI | Return value | PosterInfo list |
| UploadService | PlexService | Method calls | PosterInfo objects |
| PlexService | Plex Server | PlexAPI | API calls |
| All Components | Logger | Logger calls | Log messages |
| All Components | ConfigManager | Config access | Settings retrieval |

---

## Architecture Principles

### SOLID Principles Applied

- **S**ingle Responsibility: Each class has one clear purpose
- **O**pen/Closed: Scrapers extend BaseScraper without modification
- **L**iskov Substitution: Any scraper can replace another
- **I**nterface Segregation: Thin, focused interfaces
- **D**ependency Inversion: Depend on abstractions (BaseScraper)

### Additional Patterns

- **Separation of Concerns**: Clear layer boundaries
- **DRY** (Don't Repeat Yourself): Shared utilities and base classes
- **Convention over Configuration**: Sensible defaults
- **Fail-Fast**: Early validation and error detection

---

## Legend

```
┌─────────────────────────────────────────────────────┐
│  Symbol Guide                                       │
├─────────────────────────────────────────────────────┤
│  ┌───┐  Component/Module                            │
│  │   │                                              │
│  └───┘                                              │
│                                                     │
│   │    Data flow / Dependency                       │
│   ▼                                                 │
│                                                     │
│   ├─   Relationship / Contains                      │
│                                                     │
│   •    Bullet point / Feature                       │
│                                                     │
│   ═    Strong boundary                              │
│   ─    Weak boundary                                │
└─────────────────────────────────────────────────────┘
```

---

**Document Version:** 1.0  
**Last Updated:** January 15, 2026  
**Application Version:** Based on current codebase snapshot  

---

> **Tip**: This architecture is designed for maintainability and extensibility. When adding new features, identify the appropriate layer and follow existing patterns for consistency.
