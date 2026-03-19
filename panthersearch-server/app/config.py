from pathlib import Path
import os
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

GOSOLAR_BASE_URL = os.getenv('GOSOLAR_BASE_URL', 'https://registration.gosolar.gsu.edu/StudentRegistrationSsb/ssb')
RMP_GRAPHQL_URL = os.getenv('RMP_GRAPHQL_URL', 'https://www.ratemyprofessors.com/graphql')
REDDIT_BASE_URL = os.getenv('REDDIT_BASE_URL', 'https://www.reddit.com')
CACHE_TTL_SECONDS = int(os.getenv('CACHE_TTL_SECONDS', '86400'))
DEFAULT_TERM = os.getenv('DEFAULT_TERM', '202605')
USER_AGENT = 'Mozilla/5.0 (compatible; PantherSearch student tool)'
CACHE_DIR = BASE_DIR / 'app' / 'cache'
DATA_DIR = BASE_DIR / 'app' / 'data'
VIEWS_FILE = DATA_DIR / 'views.json'
GRADES_FILE = DATA_DIR / 'grades.json'
RATEMYPROFESSOR_CACHE_FILE = DATA_DIR / 'ratemyprofessor_cache.json'
SEATS_REFRESH_SECONDS = int(os.getenv('SEATS_REFRESH_SECONDS', str(6 * 60 * 60)))
RMP_REFRESH_SECONDS = int(os.getenv('RMP_REFRESH_SECONDS', str(24 * 60 * 60)))
ACTIVE_TERM_HINTS = [term.strip() for term in os.getenv('ACTIVE_TERM_HINTS', '202605,202608').split(',') if term.strip()]
