"""Base scraper class with Playwright support."""

from abc import ABC, abstractmethod
from typing import List, Tuple
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, Page, Browser

from ..core.models import PosterInfo


class BaseScraper(ABC):
    """Base class for all scrapers."""
    
    def __init__(self, use_playwright: bool = True):
        """Initialize base scraper.
        
        Args:
            use_playwright: Whether to use Playwright for scraping (default True).
        """
        self.use_playwright = use_playwright
        self._playwright = None
        self._browser: Browser = None
        self._page: Page = None
    
    def __enter__(self):
        """Context manager entry."""
        if self.use_playwright:
            self._start_playwright()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        if self.use_playwright:
            self._stop_playwright()
    
    def _start_playwright(self):
        """Start Playwright browser."""
        if not self._playwright:
            import os
            import sys
            import platform
            
            self._playwright = sync_playwright().start()
            
            # Common browser launch arguments for cross-platform compatibility
            browser_args = [
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
            
            # Handle PyInstaller frozen executable
            if getattr(sys, 'frozen', False):
                # Running in PyInstaller bundle
                # Try to use system Chrome/Chromium first (cross-platform)
                try:
                    # Detect platform and use appropriate browser channel
                    system = platform.system()
                    channel = "chrome" if system in ["Windows", "Darwin"] else "chromium"
                    
                    self._browser = self._playwright.chromium.launch(
                        channel=channel,  # Use system browser
                        headless=True,
                        args=browser_args
                    )
                except:
                    # Fallback to regular chromium (requires playwright install)
                    self._browser = self._playwright.chromium.launch(
                        headless=True,
                        args=browser_args
                    )
            else:
                # Running as script - normal launch
                self._browser = self._playwright.chromium.launch(
                    headless=True,
                    args=browser_args
                )
            
            # Create context with realistic settings
            context = self._browser.new_context(
                viewport={'width': 1920, 'height': 1080},
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                locale='en-US',
                timezone_id='America/New_York'
            )
            
            self._page = context.new_page()
            
            # Remove webdriver detection
            self._page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined
                });
                # Navigate to the page
                self._page.goto(url, wait_until="networkidle", timeout=60000)
                
                # For MediUX, wait for scripts to load
                if "mediux.pro" in url:
                    try:
                        # Wait for the script tags that contain the data
                        self._page.wait_for_selector('script', timeout=10000)
                        # Additional wait for JavaScript execution
                        self._page.wait_for_timeout(3000)
                        
                        # Try to detect if content loaded by checking for specific elements
                        self._page.wait_for_function(
                            "document.body.innerText.includes('files') || document.scripts.length > 5",
                            timeout=5000
                        )
                    except:
                        print("Warning: Timeout waiting for MediUX content, proceeding anyway...")
                else:
                    # For other sites, wait a bit for dynamic content
                    self._page.wait_for_timeout(2000)
                
                html_content = self._page.content()
                
                # Debug: Check if we got content
                if len(html_content) < 1000:
                    print(f"Warning: Page content seems too short ({len(html_content)} bytes)")
                
                
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5]
                });
                
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en']
                });
            """)
    
    def _stop_playwright(self):
        """Stop Playwright browser."""
        if self._browser:
            self._browser.close()
        if self._playwright:
            self._playwright.stop()
        self._browser = None
        self._playwright = None
        self._page = None
    
    def fetch_page(self, url: str) -> BeautifulSoup:
        """Fetch page content using Playwright or requests.
        
        Args:
            url: URL to fetch.
            
        Returns:
            BeautifulSoup object with page content.
        """
        if self.use_playwright and self._page:
            try:
                self._page.goto(url, wait_until="domcontentloaded", timeout=30000)
                # Wait a bit for dynamic content
                self._page.wait_for_timeout(2000)
                html_content = self._page.content()
                return BeautifulSoup(html_content, 'html.parser')
            except Exception as e:
                print(f"Playwright error, falling back to requests: {str(e)}")
                return self._fetch_with_requests(url)
        else:
            return self._fetch_with_requests(url)
    
    def _fetch_with_requests(self, url: str) -> BeautifulSoup:
        """Fetch page using requests library (fallback).
        
        Args:
            url: URL to fetch.
            
        Returns:
            BeautifulSoup object with page content.
        """
        import requests
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': 'Windows'
        }
        
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200 or (response.status_code == 500 and "mediux.pro" in url):
            return BeautifulSoup(response.text, 'html.parser')
        else:
            raise Exception(f"Failed to retrieve the page. Status code: {response.status_code}")
    
    @abstractmethod
    def scrape(self, url: str) -> Tuple[List[PosterInfo], List[PosterInfo], List[PosterInfo]]:
        """Scrape posters from URL.
        
        Args:
            url: URL to scrape.
            
        Returns:
            Tuple of (movie_posters, show_posters, collection_posters).
        """
        pass
