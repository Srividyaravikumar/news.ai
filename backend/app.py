from flask import Flask, request, jsonify
from flask_cors import CORS
import feedparser
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import os
import time

app = Flask(__name__)

# CORS: wide open during dev; lock it to your GH Pages origin after deploy
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "*")
CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGIN}})

# Settings
MAX_ARTICLES = int(os.getenv("MAX_ARTICLES", "10"))
EXTRACT_CHAR_LIMIT = int(os.getenv("EXTRACT_CHAR_LIMIT", "1500"))
SUMMARY_CHAR_LIMIT = int(os.getenv("SUMMARY_CHAR_LIMIT", "400"))
REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "6.0"))

HEADERS = {
    "User-Agent": "NewsSummarizerBot/1.0 (+https://example.com)"
}

def http_get(url, retries=2, backoff=0.6):
    last_err = None
    for i in range(retries + 1):
        try:
            return requests.get(url, timeout=REQUEST_TIMEOUT, headers=HEADERS)
        except Exception as e:
            last_err = e
            time.sleep(backoff * (2 ** i))
    raise last_err

@app.route("/")
def home():
    return (
        "<h2>News Summarizer API is running</h2>"
        "<p>Try: /api/feed?url=&lt;RSS_URL&gt;</p>"
    )

def extract_text_from_link(url):
    """Extract main page text with basic cleanup and length cap."""
    try:
        res = http_get(url)
        # basic content-type guard
        ctype = res.headers.get("Content-Type", "")
        if "text/html" not in ctype:
            return None

        soup = BeautifulSoup(res.text, "html.parser")  # or "lxml" if installed
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        text = " ".join(s.strip() for s in soup.stripped_strings)
        return text[:EXTRACT_CHAR_LIMIT]
    except Exception as e:
        app.logger.warning(f"extract_text_from_link error: {e}")
        return None

@app.route("/api/feed", methods=["GET"])
def get_feed():
    rss_url = request.args.get("url", "").strip()
    if not rss_url:
        return jsonify({"error": "Missing URL parameter"}), 400

    # quick sanity check on URL
    parsed = urlparse(rss_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return jsonify({"error": "Invalid URL"}), 400

    feed = feedparser.parse(rss_url)
    if not getattr(feed, "entries", None):
        return jsonify({"error": "Failed to parse feed"}), 400

    articles = []
    for entry in feed.entries[:MAX_ARTICLES]:
        title = entry.get("title", "Untitled")
        link = entry.get("link", "")
        summary = entry.get("summary", "") or entry.get("description", "")

        if (not summary) and link:
            text = extract_text_from_link(link)
            summary = (text[:SUMMARY_CHAR_LIMIT] if text else "No summary available.")

        articles.append({
            "title": title,
            "link": link,
            "summary": summary,
            "published": entry.get("published", "") or entry.get("updated", ""),
        })

    feed_title = getattr(feed.feed, "title", "Feed")
    return jsonify({"feed": feed_title, "articles": articles})

# Note: no debug in production; gunicorn will run this module.
if __name__ == "__main__":
    app.run(port=8000, debug=True)
