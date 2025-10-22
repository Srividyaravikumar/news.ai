from flask import Flask, request, jsonify
import feedparser
import requests
from bs4 import BeautifulSoup
from flask_cors import CORS
app = Flask(__name__)
CORS(app)
@app.route("/")
def home():
    return "<h2>News Summarizer API is running 🚀</h2><p>Use /api/feed?url=&lt;RSS_URL&gt;</p>"

def extract_text_from_link(url):
    """Try to extract main article text from the link."""
    try:
        res = requests.get(url, timeout=5)
        soup = BeautifulSoup(res.text, "html.parser")
        # remove scripts & styles
        for tag in soup(["script", "style"]):
            tag.decompose()
        text = " ".join(soup.stripped_strings)
        return text[:1500]  # limit length for summarizer
    except Exception as e:
        print("Error extracting article:", e)
        return None

@app.route("/api/feed", methods=["GET"])
def get_feed():
    url = request.args.get("url")
    if not url:
        return jsonify({"error": "Missing URL parameter"}), 400

    feed = feedparser.parse(url)
    if not feed.entries:
        return jsonify({"error": "Failed to parse feed"}), 400

    articles = []
    for entry in feed.entries[:10]:  # limit to 10 per feed
        summary = entry.get("summary", "")
        if not summary and "link" in entry:
            text = extract_text_from_link(entry.link)
            summary = text[:400] if text else "No summary available."
        articles.append({
            "title": entry.title,
            "link": entry.link,
            "summary": summary,
            "published": entry.get("published", "")
        })

    return jsonify({"feed": feed.feed.title, "articles": articles})

if __name__ == "__main__":
    app.run(port=8000, debug=True)
