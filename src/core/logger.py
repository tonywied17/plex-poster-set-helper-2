"""Application logger: file + console handlers with a singleton wrapper."""

import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional


class AppLogger:
    """Application logger with file and console output."""
    
    _instance: Optional['AppLogger'] = None
    _logger: Optional[logging.Logger] = None
    _log_file_path: Optional[str] = None
    _last_session_emitted_at: Optional[datetime] = None
    
    def __new__(cls):
        """Singleton pattern to ensure only one logger instance."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize the logger (only once). Defaults to append mode to avoid truncating logs on import."""
        if AppLogger._logger is None:
            self._setup_logger(append=True)
    
    def _setup_logger(self, log_file: str = "debug.log", log_level: int = logging.DEBUG, append: bool = True):
        """Set up the logger with file and console handlers.
        
        Args:
            log_file: Name or path of the log file.
            log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL).
        """
        # Create logger
        AppLogger._logger = logging.getLogger("PlexPosterHelper")
        AppLogger._logger.setLevel(log_level)
        
        # Remove previous file/stream handlers so streams are not reused
        if AppLogger._logger.handlers:
            preserved = []
            for h in AppLogger._logger.handlers:
                if isinstance(h, (logging.FileHandler, logging.StreamHandler)):
                    try:
                        h.close()
                    except Exception:
                        pass
                else:
                    preserved.append(h)
            AppLogger._logger.handlers = preserved
        
        # Determine log file path
        if not os.path.isabs(log_file):
            try:
                from ..utils.helpers import get_exe_dir
                log_dir = get_exe_dir()
            except Exception:
                log_dir = os.getcwd()
            
            AppLogger._log_file_path = os.path.join(log_dir, log_file)
        else:
            AppLogger._log_file_path = log_file
        
        # Ensure log directory exists
        log_dir = os.path.dirname(AppLogger._log_file_path)
        if log_dir:
            os.makedirs(log_dir, exist_ok=True)
        
        # Create formatters
        detailed_formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(name)s | %(funcName)s:%(lineno)d | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        console_formatter = logging.Formatter(
            '%(levelname)s: %(message)s'
        )
        
        try:
            mode = 'a' if append else 'w'
            file_handler = logging.FileHandler(AppLogger._log_file_path, mode=mode, encoding='utf-8')
            file_handler.setLevel(logging.DEBUG)
            file_handler.setFormatter(detailed_formatter)
            AppLogger._logger.addHandler(file_handler)

            # Choose a safe stream: prefer the interpreter's original stdout/stderr
            safe_stream = getattr(sys, '__stdout__', None) or getattr(sys, '__stderr__', None) or sys.stderr
            if safe_stream is None:
                try:
                    safe_stream = sys.stdout
                except Exception:
                    try:
                        safe_stream = open(os.devnull, 'w')
                    except Exception:
                        safe_stream = None

            # Repair any existing StreamHandler that has no stream or points to an in-process redirector
            try:
                for h in list(AppLogger._logger.handlers):
                    try:
                        if isinstance(h, logging.StreamHandler):
                            cur = getattr(h, 'stream', None)
                            if cur is None:
                                if safe_stream is not None:
                                    h.stream = safe_stream
                            else:
                                # Detect wrappers (heuristic) and avoid using them as targets
                                if hasattr(cur, 'logger_obj') and hasattr(cur, '_local'):
                                    if safe_stream is not None:
                                        h.stream = safe_stream
                    except Exception:
                        pass
            except Exception:
                pass

            try:
                now = datetime.now()
                if AppLogger._last_session_emitted_at is None or (now - AppLogger._last_session_emitted_at).total_seconds() > 1.0:
                    AppLogger._logger.info("="*80)
                    AppLogger._logger.info(f"NEW SESSION STARTED - {now.strftime('%Y-%m-%d %H:%M:%S')}")
                    AppLogger._logger.info("="*80)
                    AppLogger._last_session_emitted_at = now
            except Exception:
                pass
        except Exception as e:
            print(f"Warning: Could not create log file at {AppLogger._log_file_path}: {e}")

        # Prefer the interpreter's original stdout/stderr if available
        out_stream = getattr(sys, '__stdout__', None) or getattr(sys, '__stderr__', None) or sys.stderr

        # Repair existing stream handlers that lack a stream
        try:
            for existing in list(AppLogger._logger.handlers):
                try:
                    if isinstance(existing, logging.StreamHandler) and getattr(existing, 'stream', None) is None:
                        existing.stream = out_stream
                except Exception:
                    pass
        except Exception:
            pass

        console_handler = logging.StreamHandler(out_stream)
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(console_formatter)
        AppLogger._logger.addHandler(console_handler)
    
    def configure(self, log_file: str = "debug.log", log_level: int = logging.DEBUG, append: bool = True):
        """Reconfigure the logger with new settings.
        
        Args:
            log_file: Name or path of the log file.
            log_level: Logging level.
        """
        self._setup_logger(log_file, log_level, append)
    
    @property
    def logger(self) -> logging.Logger:
        """Get the logger instance."""
        if AppLogger._logger is None:
            self._setup_logger()
        return AppLogger._logger
    
    @property
    def log_file_path(self) -> Optional[str]:
        """Get the current log file path."""
        return AppLogger._log_file_path
    
    def debug(self, message: str, *args, **kwargs):
        """Log a debug message."""
        kw = dict(kwargs)
        if 'stacklevel' not in kw:
            kw['stacklevel'] = 2
        self.logger.debug(message, *args, **kw)
    
    def info(self, message: str, *args, **kwargs):
        """Log an info message."""
        kw = dict(kwargs)
        if 'stacklevel' not in kw:
            kw['stacklevel'] = 2
        self.logger.info(message, *args, **kw)
    
    def warning(self, message: str, *args, **kwargs):
        """Log a warning message."""
        kw = dict(kwargs)
        if 'stacklevel' not in kw:
            kw['stacklevel'] = 2
        self.logger.warning(message, *args, **kw)
    
    def error(self, message: str, *args, **kwargs):
        """Log an error message."""
        kw = dict(kwargs)
        if 'stacklevel' not in kw:
            kw['stacklevel'] = 2
        self.logger.error(message, *args, **kw)
    
    def critical(self, message: str, *args, **kwargs):
        """Log a critical message."""
        kw = dict(kwargs)
        if 'stacklevel' not in kw:
            kw['stacklevel'] = 2
        self.logger.critical(message, *args, **kw)
    
    def exception(self, message: str, *args, **kwargs):
        """Log an exception with traceback."""
        kw = dict(kwargs)
        if 'stacklevel' not in kw:
            kw['stacklevel'] = 2
        self.logger.exception(message, *args, **kw)


# Global logger instance
app_logger = AppLogger()


def get_logger() -> AppLogger:
    """Get the global logger instance.
    
    Returns:
        AppLogger instance.
    """
    return app_logger
