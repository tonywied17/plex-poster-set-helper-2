"""Main entry point for Plex Poster Set Helper."""

import sys
import atexit

from src.ui.gui import PlexPosterGUI
from src.ui.cli import PlexPosterCLI


# Interactive CLI mode flag
INTERACTIVE_CLI = True  # Set to False when building executable for GUI default


def cleanup():
    """Cleanup function called on exit."""
    print("Exiting application. Cleanup complete.")


def main():
    """Main application entry point."""
    # Register cleanup function
    atexit.register(cleanup)
    
    # Check for command-line arguments
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        
        if command == 'gui':
            # Launch GUI
            app = PlexPosterGUI()
            app.run()
        
        elif command == 'cli':
            # Launch interactive CLI
            cli = PlexPosterCLI()
            cli.run()
        
        elif command == 'bulk':
            # Process bulk import file
            cli = PlexPosterCLI()
            
            if len(sys.argv) > 2:
                file_path = sys.argv[2]
            else:
                # Use first bulk file from config or default
                file_path = cli.config.bulk_files[0] if cli.config.bulk_files else "bulk_import.txt"
            
            cli.process_bulk_file(file_path)
        
        elif command.startswith('http'):
            # Process single URL
            cli = PlexPosterCLI()
            cli.process_url(command)
        
        else:
            print("Usage:")
            print("  python main.py gui              - Launch GUI")
            print("  python main.py cli              - Launch interactive CLI")
            print("  python main.py bulk [file]      - Process bulk import file")
            print("  python main.py <url>            - Process single URL")
            sys.exit(1)
    
    else:
        # No arguments provided
        if INTERACTIVE_CLI:
            # Launch interactive CLI
            cli = PlexPosterCLI()
            cli.run()
        else:
            # Launch GUI by default (for built executable)
            app = PlexPosterGUI()
            app.run()


if __name__ == "__main__":
    main()
