import os
from dotenv import load_dotenv

load_dotenv()

DISCORD_WEBHOOK_URL = os.environ["DISCORD_WEBHOOK_URL"]
GOOGLE_API_KEY = os.environ["GOOGLE_API_KEY"]
DATABASE_NAME = os.environ.get("DATABASE_NAME", "papers.db")

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")

RATE_LIMIT_PER_MINUTE_REQUESTS = int(os.environ.get("RATE_LIMIT_PER_MINUTE_REQUESTS", 15))
RATE_LIMIT_PER_MINUTE_TOKENS = int(os.environ.get("RATE_LIMIT_PER_MINUTE_TOKENS", 1_000_000))
RATE_LIMIT_PER_DAY_REQUESTS = int(os.environ.get("RATE_LIMIT_PER_DAY_REQUESTS", 200))

SEARCH_KEYWORDS = ["LLM", "GPT", "LFM", "prompt"]
SEARCH_AUTHORS = []  # ["John Doe", "Jane Smith"] のように検索する著者名を追加できます（完全一致検索）
