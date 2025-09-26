import logging
import time
from collections import deque
from threading import Lock
from typing import List, Optional

import arxiv
import google.generativeai as genai
import pytz
from google.api_core.exceptions import GoogleAPIError, ResourceExhausted
from pydantic import BaseModel

from config import (
    GEMINI_MODEL,
    GOOGLE_API_KEY,
    RATE_LIMIT_PER_DAY_REQUESTS,
    RATE_LIMIT_PER_MINUTE_REQUESTS,
    RATE_LIMIT_PER_MINUTE_TOKENS,
    SEARCH_AUTHORS,
    SEARCH_KEYWORDS,
)

logger = logging.getLogger(__name__)


genai.configure(api_key=GOOGLE_API_KEY)
genai_model = genai.GenerativeModel(GEMINI_MODEL)


class RateLimiter:
    def __init__(
        self,
        per_minute_requests: int,
        per_minute_tokens: int,
        per_day_requests: int,
    ) -> None:
        self.per_minute_requests = per_minute_requests
        self.per_minute_tokens = per_minute_tokens
        self.per_day_requests = per_day_requests
        self.minute_requests: deque[float] = deque()
        self.day_requests: deque[float] = deque()
        self.minute_tokens: deque[tuple[float, int]] = deque()
        self.lock = Lock()

    def _prune(self, now_monotonic: float, now_wall: float) -> None:
        minute_threshold = now_monotonic - 60
        while self.minute_requests and self.minute_requests[0] <= minute_threshold:
            self.minute_requests.popleft()

        while self.minute_tokens and self.minute_tokens[0][0] <= minute_threshold:
            self.minute_tokens.popleft()

        day_threshold = now_wall - 86_400
        while self.day_requests and self.day_requests[0] <= day_threshold:
            self.day_requests.popleft()

    def acquire(self, tokens_needed: int) -> bool:
        if tokens_needed <= 0:
            tokens_needed = 1

        while True:
            with self.lock:
                now_monotonic = time.monotonic()
                now_wall = time.time()
                self._prune(now_monotonic, now_wall)

                minute_token_usage = sum(token for _, token in self.minute_tokens)

                minute_capacity_available = (
                    len(self.minute_requests) < self.per_minute_requests
                )
                token_capacity_available = (
                    minute_token_usage + tokens_needed <= self.per_minute_tokens
                )
                daily_capacity_available = (
                    len(self.day_requests) < self.per_day_requests
                )

                if (
                    minute_capacity_available
                    and token_capacity_available
                    and daily_capacity_available
                ):
                    self.minute_requests.append(now_monotonic)
                    self.day_requests.append(now_wall)
                    self.minute_tokens.append((now_monotonic, tokens_needed))
                    return True

                wait_times: list[float] = []

                if not minute_capacity_available:
                    wait_times.append(60 - (now_monotonic - self.minute_requests[0]))

                if not token_capacity_available and self.minute_tokens:
                    wait_times.append(60 - (now_monotonic - self.minute_tokens[0][0]))

                if not daily_capacity_available:
                    reset_seconds = 86_400 - (now_wall - self.day_requests[0])
                    logger.warning(
                        "Daily Gemini request cap reached (remaining %.0fs). Skipping.",
                        max(reset_seconds, 0),
                    )
                    return False

            sleep_for = max(max(wait_times, default=1.0), 0.5)
            time.sleep(sleep_for)

    def record_additional_tokens(self, tokens: int) -> None:
        if tokens <= 0:
            return
        with self.lock:
            now_monotonic = time.monotonic()
            self.minute_tokens.append((now_monotonic, tokens))
            self._prune(now_monotonic, time.time())


rate_limiter = RateLimiter(
    per_minute_requests=RATE_LIMIT_PER_MINUTE_REQUESTS,
    per_minute_tokens=RATE_LIMIT_PER_MINUTE_TOKENS,
    per_day_requests=RATE_LIMIT_PER_DAY_REQUESTS,
)


def estimate_tokens(*texts: Optional[str]) -> int:
    total_chars = sum(len(text) for text in texts if text)
    estimated_tokens = max(total_chars // 4, 1)
    return estimated_tokens


def retry_on_error(retries: int = 3, delay: int = 5):
    def decorator(func):
        def wrapper(*args, **kwargs):
            last_error: Optional[Exception] = None
            for attempt in range(1, retries + 1):
                try:
                    return func(*args, **kwargs)
                except (ResourceExhausted, GoogleAPIError) as error:
                    last_error = error
                    logger.warning(
                        "Gemini API error: %s (attempt %s/%s). Retrying in %ss...",
                        error,
                        attempt,
                        retries,
                        delay,
                    )
                    time.sleep(delay)
            logger.error("Exceeded Gemini retry limit: %s", last_error)
            return None

        return wrapper

    return decorator


class ArxivResponse(BaseModel):
    entry_id: str
    title: str
    summary: str
    url: str
    submitted: str


@retry_on_error()
def fetch_interesting_points(result: ArxivResponse) -> Optional[str]:
    prompt = (
        "以下の論文がなぜ面白く、初心者にも魅力的に映るのかを3つの箇条書きで説明してください。"
        "各ポイントは2文以内で簡潔に書き、最後に読むべき理由を一言でまとめてください。\n"
        f"論文タイトル: {result.title}\n"
        f"概要: {result.summary}"
    )

    tokens_needed = estimate_tokens(prompt)
    if not rate_limiter.acquire(tokens_needed):
        logger.warning("Gemini rate limit reached. Skipping interesting points generation.")
        return None

    response = genai_model.generate_content(prompt)
    text = (getattr(response, "text", "") or "").strip()
    if not text:
        logger.error("Gemini returned empty interesting points response.")
        return None

    rate_limiter.record_additional_tokens(estimate_tokens(text))
    return text


@retry_on_error()
def fetch_summary(result: ArxivResponse) -> Optional[str]:
    prompt = (
        "以下の論文を日本語で5つ以内の箇条書きにまとめてください。各行は80文字以内で簡潔にしてください。\n"
        f"論文タイトル: {result.title}\n"
        f"概要: {result.summary}"
    )

    tokens_needed = estimate_tokens(prompt)
    if not rate_limiter.acquire(tokens_needed):
        logger.warning("Gemini rate limit reached. Skipping summary generation.")
        return None

    response = genai_model.generate_content(prompt)
    text = (getattr(response, "text", "") or "").strip()
    if not text:
        logger.error("Gemini returned empty summary response.")
        return None

    rate_limiter.record_additional_tokens(estimate_tokens(text))
    return text


def get_papers(
    db,
    keyword: List[str] = SEARCH_KEYWORDS,
    authors: List[str] = SEARCH_AUTHORS,
    max_results: int = 20,
):
    title_query = " OR ".join([f'ti:"{k}"' for k in keyword])
    if authors:
        author_query = " OR ".join([f'au:"{a}"' for a in authors])
        query = f"({title_query}) OR ({author_query})"
    else:
        query = title_query

    exclude_ids = set(db.get_excluded_papers())

    search = arxiv.Search(
        query=query,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.SubmittedDate,
        sort_order=arxiv.SortOrder.Descending,
    )

    results = []
    for result in search.results():
        if result.entry_id in exclude_ids:
            continue
        submitted_jst = result.published.astimezone(pytz.timezone("Asia/Tokyo"))
        submitted_formatted = submitted_jst.strftime("%Y年%m月%d日 %H時%M分%S秒")
        results.append(
            ArxivResponse(
                entry_id=result.entry_id,
                title=result.title,
                summary=result.summary,
                url=result.pdf_url,
                submitted=submitted_formatted,
            )
        )

    if not results:
        return None

    picked_paper = results[0]
    db.add_paper(picked_paper.entry_id)
    logger.info("INSERT : %s / %s", picked_paper.entry_id, picked_paper.title)

    return picked_paper
