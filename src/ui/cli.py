"""CLI interface for Plex Poster Set Helper."""

import sys
import threading
from typing import List
from concurrent.futures import ThreadPoolExecutor, as_completed

from ..core.config import ConfigManager
from ..core.logger import get_logger
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
        
        # Initialize logger with config
        self.logger = get_logger()
        self.logger.configure(log_file=self.config.log_file)
        self.logger.info("CLI Application initializing...")
        
        self.plex_service: PlexService = None
        self.upload_service: PosterUploadService = None
        self.scraper_factory: ScraperFactory = None
    
    def run(self):
        """Run the interactive CLI loop."""
        sys.stdout.reconfigure(encoding='utf-8')
        
        while True:
            self._display_main_menu()
            
            choice = input("\nSelect an option (1-7): ").strip()
            
            if choice == '1':
                self._handle_single_url()
            elif choice == '2':
                self._handle_bulk_import()
            elif choice == '3':
                self._handle_title_mappings()
            elif choice == '4':
                self._handle_reset_posters()
            elif choice == '5':
                self._handle_view_stats()
            elif choice == '6':
                self._launch_gui()
                break
            elif choice == '7':
                print("Exiting...")
                break
            else:
                print("Invalid choice. Please select an option between 1 and 7.")
    
    def _display_main_menu(self):
        """Display the main menu with stats."""
        print("\n" + "="*60)
        print("         Plex Poster Set Helper - Main Menu")
        print("="*60)
        
        # Try to show quick stats if Plex is connected
        try:
            if not self.plex_service:
                self.plex_service = PlexService(self.config)
                self.plex_service.setup(gui_mode=False)
            
            if self.plex_service:
                # Get labeled items count quickly
                labeled_items = self.plex_service.get_items_by_label("Plex_poster_set_helper")
                if labeled_items:
                    print(f"\n📊 Quick Stats: {len(labeled_items)} items with custom posters")
        except:
            pass  # Silently skip stats if Plex not connected
        
        print("\n1. Enter a URL (ThePosterDB/MediUX set or user URL)")
        print("2. Run Bulk Import from file")
        print("3. Manage Title Mappings")
        print("4. Reset Posters to Default")
        print("5. View Detailed Stats")
        print("6. Launch GUI")
        print("7. Exit")
    
    def process_url(self, url: str):
        """Process a single URL.
        
        Args:
            url: URL to process.
        """
        self._setup_services()
        
        if not self._check_libraries():
            return
        
        try:
            self.logger.info(f"Processing URL: {url}")
            print(f"\nScraping: {url}")
            movie_posters, show_posters, collection_posters = self.scraper_factory.scrape_url(url)
            
            self.logger.debug(f"Scraped {len(collection_posters)} collections, {len(movie_posters)} movies, {len(show_posters)} shows")
            print(f"Found {len(collection_posters)} collection posters, {len(movie_posters)} movie posters, {len(show_posters)} show posters.")
            
            # Process all posters
            all_posters = collection_posters + movie_posters + show_posters
            for poster in all_posters:
                self.upload_service.process_poster(poster)
            
            self.logger.info(f"Successfully completed processing: {url}")
            print(f"\nCompleted processing: {url}")
        
        except Exception as e:
            self.logger.exception(f"Error processing URL {url}: {str(e)}")
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
    
    def _handle_title_mappings(self):
        """Handle title mappings management."""
        while True:
            print("\n" + "="*60)
            print("         Title Mappings Management")
            print("="*60)
            print("\nCurrent Mappings:")
            
            if self.config.title_mappings:
                for i, (original, plex_title) in enumerate(self.config.title_mappings.items(), 1):
                    print(f"  {i}. '{original}' → '{plex_title}'")
            else:
                print("  (No mappings configured)")
            
            print("\nOptions:")
            print("1. Add New Mapping")
            print("2. Remove Mapping")
            print("3. Clear All Mappings")
            print("4. Back to Main Menu")
            
            choice = input("\nSelect an option (1-4): ").strip()
            
            if choice == '1':
                self._add_title_mapping()
            elif choice == '2':
                self._remove_title_mapping()
            elif choice == '3':
                self._clear_title_mappings()
            elif choice == '4':
                break
            else:
                print("Invalid choice. Please select an option between 1 and 4.")
    
    def _add_title_mapping(self):
        """Add a new title mapping."""
        print("\nAdd Title Mapping")
        print("-" * 60)
        original = input("Enter the original title (from poster source): ").strip()
        if not original:
            print("Original title cannot be empty.")
            return
        
        plex_title = input("Enter the Plex library title: ").strip()
        if not plex_title:
            print("Plex title cannot be empty.")
            return
        
        # Add to config
        if not self.config.title_mappings:
            self.config.title_mappings = {}
        
        self.config.title_mappings[original] = plex_title
        
        if self.config_manager.save(self.config):
            print(f"✓ Added mapping: '{original}' → '{plex_title}'")
        else:
            print("✗ Error saving title mapping.")
    
    def _remove_title_mapping(self):
        """Remove a title mapping."""
        if not self.config.title_mappings:
            print("\nNo mappings to remove.")
            return
        
        print("\nRemove Title Mapping")
        print("-" * 60)
        print("Enter the number of the mapping to remove:")
        
        mappings_list = list(self.config.title_mappings.items())
        for i, (original, plex_title) in enumerate(mappings_list, 1):
            print(f"  {i}. '{original}' → '{plex_title}'")
        
        choice = input(f"\nSelect mapping (1-{len(mappings_list)}) or [Enter] to cancel: ").strip()
        
        if not choice:
            return
        
        if choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(mappings_list):
                original, plex_title = mappings_list[idx]
                del self.config.title_mappings[original]
                
                if self.config_manager.save(self.config):
                    print(f"✓ Removed mapping: '{original}' → '{plex_title}'")
                else:
                    print("✗ Error saving changes.")
            else:
                print("Invalid selection.")
        else:
            print("Invalid input.")
    
    def _clear_title_mappings(self):
        """Clear all title mappings."""
        if not self.config.title_mappings:
            print("\nNo mappings to clear.")
            return
        
        confirm = input(f"\nAre you sure you want to delete all {len(self.config.title_mappings)} mappings? (yes/no): ").strip().lower()
        
        if confirm in ['yes', 'y']:
            self.config.title_mappings = {}
            if self.config_manager.save(self.config):
                print("✓ All mappings cleared.")
            else:
                print("✗ Error saving changes.")
        else:
            print("Operation cancelled.")
    
    def _handle_reset_posters(self):
        """Handle reset posters menu."""
        self._setup_services()
        
        while True:
            print("\n" + "="*60)
            print("         Reset Posters to Default")
            print("="*60)
            
            # Load labeled items
            labeled_items = self.plex_service.get_items_by_label("Plex_poster_set_helper")
            
            if not labeled_items:
                print("\nNo items found with custom posters.")
                input("\nPress [Enter] to return to main menu...")
                break
            
            # Calculate stats
            mediux_items = self.plex_service.get_items_by_label("Plex_poster_set_helper_mediux")
            posterdb_items = self.plex_service.get_items_by_label("Plex_poster_set_helper_posterdb")
            
            # Deduplicate by ratingKey
            all_items_dict = {}
            for item in labeled_items + mediux_items + posterdb_items:
                if item.ratingKey not in all_items_dict:
                    # Determine source
                    source = "Unknown"
                    for m_item in mediux_items:
                        if m_item.ratingKey == item.ratingKey:
                            source = "MediUX"
                            break
                    if source == "Unknown":
                        for p_item in posterdb_items:
                            if p_item.ratingKey == item.ratingKey:
                                source = "ThePosterDB"
                                break
                    
                    all_items_dict[item.ratingKey] = {
                        'item': item,
                        'source': source
                    }
            
            items_list = list(all_items_dict.values())
            
            # Display stats
            print(f"\n📊 Found {len(items_list)} items with custom posters")
            print(f"   🌐 MediUX: {len(mediux_items)}")
            print(f"   🎨 ThePosterDB: {len(posterdb_items)}")
            
            # Group by library
            library_counts = {}
            for item_data in items_list:
                item = item_data['item']
                lib_name = item.section().title if hasattr(item, 'section') else 'Unknown'
                library_counts[lib_name] = library_counts.get(lib_name, 0) + 1
            
            print("\n📚 By Library:")
            for lib_name, count in sorted(library_counts.items()):
                print(f"   {lib_name}: {count}")
            
            print("\nOptions:")
            print("1. Browse/Search Items (Filter and Select)")
            print("2. Reset All Items")
            print("3. Back to Main Menu")
            
            choice = input("\nSelect an option (1-3): ").strip()
            
            if choice == '1':
                if self._browse_and_reset_items(items_list):
                    # Items were reset, reload the list by continuing the loop
                    print("\n🔄 Refreshing item list...")
                    continue
            elif choice == '2':
                if self._reset_all_items(items_list):
                    # Items were reset, reload the list by continuing the loop
                    print("\n🔄 Refreshing item list...")
                    continue
            elif choice == '3':
                break
            else:
                print("Invalid choice. Please select an option between 1 and 3.")
    
    def _browse_and_reset_items(self, items_list):
        """Browse and reset items with search/filter functionality."""
        search_text = ""
        filter_mediux = True
        filter_posterdb = True
        
        while True:
            # Apply filters
            filtered_items = self._apply_item_filters(items_list, search_text, filter_mediux, filter_posterdb)
            
            print("\n" + "="*60)
            print("         Browse/Search Items")
            print("="*60)
            
            # Show current filters
            if search_text or not filter_mediux or not filter_posterdb:
                print("\n🔍 Active Filters:")
                if search_text:
                    print(f"   Search: '{search_text}'")
                if not filter_mediux:
                    print("   🌐 MediUX: Hidden")
                if not filter_posterdb:
                    print("   🎨 ThePosterDB: Hidden")
            
            print(f"\n📊 Showing {len(filtered_items)} of {len(items_list)} items")
            
            if not filtered_items:
                print("\n⚠️  No items match the current filters.")
            else:
                # Show items with pagination
                page_size = 15
                print("\nItems:")
                print("-" * 60)
                
                for i in range(min(page_size, len(filtered_items))):
                    item_data = filtered_items[i]
                    item = item_data['item']
                    source = item_data['source']
                    
                    lib_name = item.section().title if hasattr(item, 'section') else 'Unknown'
                    type_icon = "🎬" if item.type == "movie" else "📺" if item.type in ["show", "season", "episode"] else "📚"
                    source_icon = "🌐" if source == "MediUX" else "🎨" if source == "ThePosterDB" else "❓"
                    
                    print(f"  {i+1}. {type_icon} {item.title} {source_icon} [{lib_name}]")
                
                if len(filtered_items) > page_size:
                    print(f"\n... and {len(filtered_items) - page_size} more items")
            
            print("\nOptions:")
            print("1. Search by Title")
            print("2. Toggle MediUX Filter (Currently: {})".format("ON" if filter_mediux else "OFF"))
            print("3. Toggle ThePosterDB Filter (Currently: {})".format("ON" if filter_posterdb else "OFF"))
            print("4. Clear All Filters")
            print("5. Reset Item by Number")
            print("6. Reset All Filtered Items")
            print("7. Back to Previous Menu")
            
            choice = input("\nSelect an option (1-7): ").strip()
            
            if choice == '1':
                search_text = input("Enter search text (or press [Enter] to clear): ").strip()
                print(f"✓ Search filter {'applied' if search_text else 'cleared'}.")
            elif choice == '2':
                filter_mediux = not filter_mediux
                print(f"✓ MediUX filter {'enabled' if filter_mediux else 'disabled'}.")
            elif choice == '3':
                filter_posterdb = not filter_posterdb
                print(f"✓ ThePosterDB filter {'enabled' if filter_posterdb else 'disabled'}.")
            elif choice == '4':
                search_text = ""
                filter_mediux = True
                filter_posterdb = True
                print("✓ All filters cleared.")
            elif choice == '5':
                if filtered_items:
                    if self._reset_item_by_number(filtered_items):
                        # Item was reset, reload the list
                        return True
                else:
                    print("⚠️  No items to reset with current filters.")
            elif choice == '6':
                if filtered_items:
                    if self._reset_filtered_items(filtered_items, len(items_list)):
                        # Items were reset, reload the list
                        return True
                else:
                    print("⚠️  No items to reset with current filters.")
            elif choice == '7':
                break
            else:
                print("Invalid choice. Please select an option between 1 and 7.")
        
        return False
    
    def _apply_item_filters(self, items_list, search_text, filter_mediux, filter_posterdb):
        """Apply search and source filters to items list."""
        filtered = []
        
        for item_data in items_list:
            item = item_data['item']
            source = item_data['source']
            
            # Apply source filters
            if source == "MediUX" and not filter_mediux:
                continue
            if source == "ThePosterDB" and not filter_posterdb:
                continue
            
            # Apply search filter (case-insensitive)
            if search_text:
                if search_text.lower() not in item.title.lower():
                    continue
            
            filtered.append(item_data)
        
        return filtered
    
    def _reset_item_by_number(self, filtered_items):
        """Reset a specific item by its number in the filtered list.
        
        Returns:
            True if item was reset, False otherwise.
        """
        print("\n" + "-"*60)
        print("Reset Item by Number")
        print("-" * 60)
        
        # Show more items for context
        display_count = min(20, len(filtered_items))
        for i in range(display_count):
            item_data = filtered_items[i]
            item = item_data['item']
            source = item_data['source']
            
            lib_name = item.section().title if hasattr(item, 'section') else 'Unknown'
            type_icon = "🎬" if item.type == "movie" else "📺" if item.type in ["show", "season", "episode"] else "📚"
            source_icon = "🌐" if source == "MediUX" else "🎨" if source == "ThePosterDB" else "❓"
            
            print(f"  {i+1}. {type_icon} {item.title} {source_icon} [{lib_name}]")
        
        if len(filtered_items) > display_count:
            print(f"\n... and {len(filtered_items) - display_count} more items")
        
        choice = input(f"\nEnter item number (1-{len(filtered_items)}) or [Enter] to cancel: ").strip()
        
        if not choice:
            return
        
        if choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(filtered_items):
                item_data = filtered_items[idx]
                item = item_data['item']
                
                confirm = input(f"\nReset '{item.title}' to default poster? (yes/no): ").strip().lower()
                
                if confirm in ['yes', 'y']:
                    print(f"Resetting '{item.title}'...")
                    try:
                        self.plex_service.delete_posters_from_items([item])
                        # Remove all three labels (main + source-specific)
                        self.plex_service.remove_label_from_items([item], "Plex_poster_set_helper")
                        self.plex_service.remove_label_from_items([item], "Plex_poster_set_helper_mediux")
                        self.plex_service.remove_label_from_items([item], "Plex_poster_set_helper_posterdb")
                        print(f"✓ Successfully reset '{item.title}' to default poster.")
                        input("\nPress [Enter] to continue...")
                        return True
                    except Exception as e:
                        print(f"✗ Error resetting item: {str(e)}")
                        input("\nPress [Enter] to continue...")
                        return False
                else:
                    print("Operation cancelled.")
            else:
                print("Invalid selection.")
        else:
            print("Invalid input.")
        
        return False
    
    def _reset_filtered_items(self, filtered_items, total_items):
        """Reset all filtered items.
        
        Returns:
            True if items were reset, False otherwise.
        """
        print("\n" + "-"*60)
        print("Reset Filtered Items")
        print("-" * 60)
        
        if len(filtered_items) == total_items:
            confirm = input(f"\n⚠️  Reset ALL {len(filtered_items)} items to default posters?\nThis cannot be undone. (yes/no): ").strip().lower()
        else:
            confirm = input(f"\n⚠️  Reset {len(filtered_items)} filtered items (of {total_items} total) to default posters?\nThis cannot be undone. (yes/no): ").strip().lower()
        
        if confirm in ['yes', 'y']:
            print(f"\nResetting {len(filtered_items)} items...")
            
            items_to_reset = [item_data['item'] for item_data in filtered_items]
            
            try:
                total = len(items_to_reset)
                for i, item in enumerate(items_to_reset, 1):
                    print(f"[{i}/{total}] Resetting '{item.title}'...")
                    self.plex_service.delete_posters_from_items([item])
                    # Remove all three labels (main + source-specific)
                    self.plex_service.remove_label_from_items([item], "Plex_poster_set_helper")
                    self.plex_service.remove_label_from_items([item], "Plex_poster_set_helper_mediux")
                    self.plex_service.remove_label_from_items([item], "Plex_poster_set_helper_posterdb")
                
                print(f"\n✓ Successfully reset {total} items to default posters.")
                input("\nPress [Enter] to continue...")
                return True
            except Exception as e:
                print(f"✗ Error during reset: {str(e)}")
                input("\nPress [Enter] to continue...")
                return False
        else:
            print("Operation cancelled.")
        
        return False
    
    
    def _reset_all_items(self, items_list):
        """Reset all items to default posters.
        
        Returns:
            True if items were reset, False otherwise.
        """
        print("\n" + "="*60)
        print("         Reset All Items")
        print("="*60)
        
        confirm = input(f"\n⚠️  Are you sure you want to reset ALL {len(items_list)} items to default posters?\nThis cannot be undone. (yes/no): ").strip().lower()
        
        if confirm in ['yes', 'y']:
            print(f"\nResetting {len(items_list)} items...")
            
            items_to_reset = [item_data['item'] for item_data in items_list]
            
            try:
                total = len(items_to_reset)
                for i, item in enumerate(items_to_reset, 1):
                    print(f"[{i}/{total}] Resetting '{item.title}'...")
                    self.plex_service.delete_posters_from_items([item])
                    # Remove all three labels (main + source-specific)
                    self.plex_service.remove_label_from_items([item], "Plex_poster_set_helper")
                    self.plex_service.remove_label_from_items([item], "Plex_poster_set_helper_mediux")
                    self.plex_service.remove_label_from_items([item], "Plex_poster_set_helper_posterdb")
                
                print(f"\n✓ Successfully reset all {total} items to default posters.")
                input("\nPress [Enter] to continue...")
                return True
            except Exception as e:
                print(f"✗ Error during reset: {str(e)}")
                input("\nPress [Enter] to continue...")
                return False
        else:
            print("Operation cancelled.")
        
        return False
    
    def _handle_view_stats(self):
        """Handle viewing detailed stats."""
        self._setup_services()
        
        print("\n" + "="*60)
        print("         Detailed Statistics")
        print("="*60)
        
        # Load labeled items
        labeled_items = self.plex_service.get_items_by_label("Plex_poster_set_helper")
        
        if not labeled_items:
            print("\nNo items found with custom posters.")
            input("\nPress [Enter] to return to main menu...")
            return
        
        # Calculate stats
        mediux_items = self.plex_service.get_items_by_label("Plex_poster_set_helper_mediux")
        posterdb_items = self.plex_service.get_items_by_label("Plex_poster_set_helper_posterdb")
        
        # Deduplicate by ratingKey
        all_items_dict = {}
        for item in labeled_items + mediux_items + posterdb_items:
            if item.ratingKey not in all_items_dict:
                # Determine source
                source = "Unknown"
                for m_item in mediux_items:
                    if m_item.ratingKey == item.ratingKey:
                        source = "MediUX"
                        break
                if source == "Unknown":
                    for p_item in posterdb_items:
                        if p_item.ratingKey == item.ratingKey:
                            source = "ThePosterDB"
                            break
                
                all_items_dict[item.ratingKey] = {
                    'item': item,
                    'source': source
                }
        
        items_list = list(all_items_dict.values())
        
        # Display comprehensive stats
        print(f"\n📊 Total Items: {len(items_list)}")
        print("\n" + "-"*60)
        print("Source Breakdown:")
        print(f"  🌐 MediUX: {len(mediux_items)} ({len(mediux_items)*100//len(items_list) if items_list else 0}%)")
        print(f"  🎨 ThePosterDB: {len(posterdb_items)} ({len(posterdb_items)*100//len(items_list) if items_list else 0}%)")
        
        # Group by library
        library_counts = {}
        for item_data in items_list:
            item = item_data['item']
            lib_name = item.section().title if hasattr(item, 'section') else 'Unknown'
            library_counts[lib_name] = library_counts.get(lib_name, 0) + 1
        
        print("\n" + "-"*60)
        print("Library Breakdown:")
        for lib_name, count in sorted(library_counts.items(), key=lambda x: x[1], reverse=True):
            percentage = count * 100 // len(items_list) if items_list else 0
            print(f"  📚 {lib_name}: {count} ({percentage}%)")
        
        # Group by type
        type_counts = {}
        for item_data in items_list:
            item = item_data['item']
            item_type = item.type.capitalize() if hasattr(item, 'type') else 'Unknown'
            type_counts[item_type] = type_counts.get(item_type, 0) + 1
        
        print("\n" + "-"*60)
        print("Media Type Breakdown:")
        for item_type, count in sorted(type_counts.items(), key=lambda x: x[1], reverse=True):
            percentage = count * 100 // len(items_list) if items_list else 0
            type_icon = "🎬" if item_type == "Movie" else "📺" if item_type in ["Show", "Season", "Episode"] else "📚"
            print(f"  {type_icon} {item_type}: {count} ({percentage}%)")
        
        input("\nPress [Enter] to return to main menu...")
    
    
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
