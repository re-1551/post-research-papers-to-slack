import logging
import os
from typing import Optional

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import FastAPI

from database.database import Database
from config import DATABASE_NAME, DISCORD_WEBHOOK_URL
from utils.utilts import fetch_interesting_points, fetch_summary, get_papers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()],
)

logger = logging.getLogger(__name__)


app = FastAPI()

db = Database(DATABASE_NAME)
db.init_database()


def _truncate_for_discord(message: str, limit: int = 1900) -> str:
    if len(message) <= limit:
        return message
    return message[:limit].rstrip() + "\n... (truncated)"


def post_to_discord(text: str) -> None:
    payload = {"content": _truncate_for_discord(text)}
    try:
        response = httpx.post(DISCORD_WEBHOOK_URL, json=payload, timeout=10.0)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("Error posting to Discord: %s", exc)


@app.get("/")
def health_check():
    return {"status": "OK"}


def run_job() -> None:
    paper = get_papers(db)
    if not paper:
        logger.info("No new papers found.")
        return

    summary: Optional[str] = fetch_summary(paper)
    interesting_points: Optional[str] = fetch_interesting_points(paper)

    if not summary or not interesting_points:
        logger.warning("Skipping Discord post because content generation failed.")
        return

    message = (
        f"**タイトル:** {paper.title}\n\n"
        f"**概要**\n{summary}\n\n"
        f"**リンク**\n{paper.url}\n\n"
        f"**提出日**\n{paper.submitted}\n\n"
        f"**気になるポイント**\n{interesting_points}\n\n"
        "ChatPDF で読む: https://www.chatpdf.com/\n"
        f"PDF: {paper.url}.pdf"
    )

    post_to_discord(message)
    logger.info("Posted a paper to Discord: %s", paper.title)


scheduler = AsyncIOScheduler(timezone="Asia/Tokyo")
scheduler.add_job(run_job, IntervalTrigger(hours=3))
scheduler.start()


@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
