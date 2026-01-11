"""CLI interface for Plex Poster Set Helper."""

import sys
import threading
from typing import List
from concurrent.futures import ThreadPoolExecutor, as_completed

from ..core.config import ConfigManager
from ..services.plex_service import PlexService
from ..services.poster_upload_service import PosterUploadService
from ..scrapers.scraper_factory import ScraperFactory
from ..utils.text_utils import parse_urls, is_comment


class PlexPosterCLI:
    """Command-line interface for the application."""
    
    def __init__(self):
        """Initialize the CLI."""
        self.config_manager = ConfigManager()
        self.config = self.config_manager.load()
        
        self.plex_service: PlexService = None
        self.upload_service: PosterUploadService = None
        self.scraper_factory: ScraperFactory = None
    
    def run(self):
        """Run the interactive CLI loop."""
        sys.stdout.reconfigure(encoding='utf-8')
        
        while True:
            print("\n--- Plex Poster Set Helper ---")
            print("1. Enter a URL (ThePosterDB/MediUX set or user URL)")
            print("2. Run Bulk Import from file")
            print("3. Launch GUI")
            print("4. Exit")
            
            choice = input("\nSelect an option (1-4): ").strip()
            
            if choice == '1':
                self._handle_single_url()
            elif choice == '2':
                self._handle_bulk_import()
            elif choice == '3':
                self._launch_gui()
                break
            elif choice == '4':
                print("Exiting...")
                break
            else:
                print("Invalid choice. Please select an option between 1 and 4.")
    
    def process_url(self, url: str):
        """Process a single URL.
        
        Args:
            url: URL to process.
        """
        self._setup_services()
        
        if not self._check_libraries():
            return
        
        try:
            print(f"\nScraping: {url}")
            movie_posters, show_posters, collection_posters = self.scraper_factory.scrape_url(url)
            
            print(f"Found {len(collection_posters)} collection posters, {len(movie_posters)} movie posters, {len(show_posters)} show posters.")
            
            # Process all posters
            all_posters = collection_posters + movie_posters + show_posters
            for poster in all_posters:
                self.upload_service.process_poster(poster)
            
            print(f"\nCompleted processing: {url}")
        
        except Exception as e:
            print(f"Error processing URL: {str(e)}")
    
    def process_bulk_file(self, file_path: str, concurrent: bool = True):
        """Process bulk import file.
        
        Args:
            file_path: Path to bulk import file.
            concurrent: Whether to use concurrent processing (default True).
        """
        import os
        from ..utils.helpers import get_exe_dir
        
        # Convert relative path to absolute for cross-platform compatibility
        if not os.path.isabs(file_path):
            file_path = os.path.join(get_exe_dir(), file_path)
        
        self._setup_services()
        
        if not self._check_libraries():
            return
        
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                urls = file.readlines()
            
            valid_urls = []
            for url in urls:
                url = url.strip()
                if not is_comment(url):
                    valid_urls.append(url)
            
            if not valid_urls:
                print("No valid URLs found in file.")
                return
            
            total_urls = len(valid_urls)
            max_workers = getattr(self.config, 'max_workers', 3)
            
            print(f"\nProcessing {total_urls} URLs from {file_path}...")
            
            if concurrent and total_urls > 1:
                print(f"Using {max_workers} concurrent workers for parallel processing\n")
                self._process_urls_concurrent(valid_urls, max_workers)
            else:
                print("Using sequential processing\n")
                self._process_urls_sequential(valid_urls)
            
            print("\nBulk import completed.")
        
        except FileNotFoundError:
            print(f"File not found: {file_path}")
        except Exception as e:
            print(f"Error reading file: {str(e)}")
    
    def _process_urls_sequential(self, urls: List[str]):
        """Process URLs sequentially.
        
        Args:
            urls: List of URLs to process.
        """
        for i, url in enumerate(urls, 1):
            print(f"[{i}/{len(urls)}] Processing: {url}")
            
            try:
                movie_posters, show_posters, collection_posters = self.scraper_factory.scrape_url(url)
                
                # Process all posters
                all_posters = collection_posters + movie_posters + show_posters
                for poster in all_posters:
                    self.upload_service.process_poster(poster)
                
                print(f"✓ Completed: {url}")
            
            except Exception as e:
                print(f"✗ Error processing {url}: {str(e)}")
    
    def _process_urls_concurrent(self, urls: List[str], max_workers: int):
        """Process URLs concurrently using thread pool.
        
        Args:
            urls: List of URLs to process.
            max_workers: Maximum number of concurrent workers.
        """
        total_urls = len(urls)
        completed = 0
        total_posters = 0
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_url = {
                executor.submit(self._scrape_and_upload_url, url): url 
                for url in urls
            }
            
            for future in as_completed(future_to_url):
                url = future_to_url[future]
                completed += 1
                
                try:
                    poster_count, error = future.result()
                    
                    if error:
                        print(f"✗ [{completed}/{total_urls}] Error: {error}")
                    else:
                        total_posters += poster_count
                        print(f"✓ [{completed}/{total_urls}] Completed {url} - Uploaded {poster_count} posters")
                
                except Exception as e:
                    print(f"✗ [{completed}/{total_urls}] Exception processing {url}: {str(e)}")
        
        print(f"\n📊 Total: {total_posters} posters uploaded from {total_urls} URLs")
    
    def _scrape_and_upload_url(self, url: str):
        """Scrape and upload posters from a single URL (thread-safe).
        
        Args:
            url: URL to process.
            
        Returns:
            Tuple of (poster_count, error_message or None)
        """
        try:
            movie_posters, show_posters, collection_posters = self.scraper_factory.scrape_url(url)
            
            # Process all posters
            all_posters = collection_posters + movie_posters + show_posters
            for poster in all_posters:
                self.upload_service.process_poster(poster)
            
            return (len(all_posters), None)
        
        except Exception as e:
            return (0, f"{url} - {str(e)}")
    
    def _handle_single_url(self):
        """Handle single URL input."""
        url = input("Enter the URL: ").strip()
        if url:
            self.process_url(url)
        else:
            print("No URL provided.")
    
    def _handle_bulk_import(self):
        """Handle bulk import from file."""
        # Show available bulk files
        if self.config.bulk_files and len(self.config.bulk_files) > 1:
            print("\nAvailable bulk import files:")
            for i, filename in enumerate(self.config.bulk_files, 1):
                print(f"  {i}. {filename}")
            print(f"  {len(self.config.bulk_files) + 1}. Enter custom path")
            
            choice = input(f"\nSelect a file (1-{len(self.config.bulk_files) + 1}) or press [Enter] for default: ").strip()
            
            if not choice:
                file_path = self.config.bulk_files[0]
            elif choice.isdigit():
                idx = int(choice) - 1
                if 0 <= idx < len(self.config.bulk_files):
                    file_path = self.config.bulk_files[idx]
                elif idx == len(self.config.bulk_files):
                    file_path = input("Enter custom file path: ").strip()
                else:
                    print("Invalid selection.")
                    return
            else:
                file_path = choice
        else:
            file_path = input(f"Enter the path to the bulk import file, or press [Enter] to use '{self.config.bulk_files[0] if self.config.bulk_files else 'bulk_import.txt'}': ").strip()
            if not file_path:
                file_path = self.config.bulk_files[0] if self.config.bulk_files else "bulk_import.txt"
        
        self.process_bulk_file(file_path)
    
    def _launch_gui(self):
        """Launch the GUI."""
        print("Launching GUI...")
        from ..ui.gui import PlexPosterGUI
        gui = PlexPosterGUI()
        gui.run()
    
    def _setup_services(self):
        """Setup Plex and scraper services."""
        if not self.plex_service:
            self.plex_service = PlexService(self.config)
            tv, movies = self.plex_service.setup(gui_mode=False)
            
            if not tv and not movies:
                print("\nError: Unable to setup Plex connection.")
                print("Please check your config.json file and ensure base_url and token are correct.")
                sys.exit(1)
        
        if not self.upload_service:
            self.upload_service = PosterUploadService(self.plex_service)
        
        if not self.scraper_factory:
            self.scraper_factory = ScraperFactory(self.config, use_playwright=True)
    
    def _check_libraries(self) -> bool:
        """Check if libraries are initialized.
        
        Returns:
            True if libraries are initialized, False otherwise.
        """
        if not self.plex_service.tv_libraries:
            print("Warning: No TV libraries initialized. Verify 'tv_library' in config.json.")
        
        if not self.plex_service.movie_libraries:
            print("Warning: No movie libraries initialized. Verify 'movie_library' in config.json.")
        
        return bool(self.plex_service.tv_libraries or self.plex_service.movie_libraries)
