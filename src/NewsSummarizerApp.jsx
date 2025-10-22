import React, { useEffect, useMemo, useState } from "react";

/**
 * Articles-Only UI for the News Summarizer — now with Categories
 * - Frontend-only auto-categorization via keyword scoring
 * - Filter by category + optional grouped layout
 * - Zero backend changes required
 */

const DEFAULT_FEEDS = [
  
 "https://feeds.bbci.co.uk/news/rss.xml",
  "https://www.reuters.com/rssFeed/topNews",
  "https://apnews.com/rss",
  "https://www.aljazeera.com/xml/rss/all.xml",
  "https://www.theverge.com/rss/index.xml",
  "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
  "https://techcrunch.com/feed/",
  "https://feeds.finance.yahoo.com/rss/2.0/headline?s=TSLA&region=US&lang=en-US"
];

const API_BASE = "http://localhost:8000/api/feed?url="; // adjust if needed

// ------- Categories (tweak freely) -------
const CATEGORY_DEFS = [
  {
    id: "tech",
    label: "Tech",
    keywords: [
      "ai","artificial intelligence","machine learning","chip","semiconductor",
      "apple","google","microsoft","meta","openai","nvidia","tesla","startup",
      "software","hardware","app","android","iphone","cyber","hack","data breach",
      "cloud","saas","laptop","gadget","the verge","wired","git","linux"
    ],
  },
  {
    id: "finance",
    label: "Finance",
    keywords: [
      "stocks","stock","shares","market","bonds","inflation","interest rate","fed",
      "ecb","earnings","ipo","merger","acquisition","m&a","fund","portfolio","etf",
      "bitcoin","crypto","revenue","profit","guidance","bank","loan","liquidity",
      "reuters","bloomberg","dow","nasdaq","s&p"
    ],
  },
  {
    id: "world",
    label: "World",
    keywords: [
      "world","global","war","conflict","diplomat","embassy","election","parliament",
      "minister","president","prime minister","un","eu","nato","sanction","border",
      "refugee","al jazeera","bbc world"
    ],
  },
  {
    id: "business",
    label: "Business",
    keywords: [
      "ceo","cfo","layoffs","hiring","supply chain","quarter","q1","q2","q3","q4",
      "forecast","guidance","factory","manufactur","industry","retail","logistics",
      "startup","vc","venture","series a","series b","corporate"
    ],
  },
  {
    id: "science",
    label: "Science",
    keywords: [
      "research","study","paper","peer-reviewed","nasa","space","telescope","quantum",
      "physics","biology","chemistry","astronomy","genome","vaccine","climate model",
      "discovery","experiment","lab"
    ],
  },
  {
    id: "health",
    label: "Health",
    keywords: [
      "covid","pandemic","virus","vaccine","health","hospital","who",
      "mental health","disease","cancer","nutrition","medicine","medical"
    ],
  },
  {
    id: "sports",
    label: "Sports",
    keywords: [
      "match","tournament","league","cup","olympics","fifa","nba","nfl","mlb","nhl",
      "goal","coach","player","score","transfer","grand slam","tennis","cricket","rugby"
    ],
  },
  {
    id: "entertainment",
    label: "Entertainment",
    keywords: [
      "movie","film","box office","actor","actress","tv","series","netflix","disney",
      "trailer","music","album","festival","award","oscars","emmys","hollywood"
    ],
  },
  {
    id: "education",
    label: "Education",
    keywords: [
      "university","college","school","curriculum","tuition","students","professor",
      "scholarship","campus","exam","research funding","edtech","mooc"
    ],
  },
  {
    id: "environment",
    label: "Environment",
    keywords: [
      "climate","emissions","carbon","co2","renewable","wind","solar","sustainability",
      "biodiversity","wildfire","flood","drought","unfccc","cop","net zero","esg"
    ],
  },
  {
    id: "travel",
    label: "Travel",
    keywords: [
      "flight","airport","airline","train","hotel","tourism","visa","travel","trip",
      "destination","itinerary","booking","luggage"
    ],
  },
  {
    id: "general",
    label: "General",
    keywords: [],
  },
];

// Simple cache to avoid re-scoring on re-renders
const scoreCache = new Map(); // key: link|title -> { id, score }

export default function NewsSummarizerApp() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [grouped, setGrouped] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchOne(url) {
  try {
    const API = import.meta.env.VITE_API_BASE;
    const endpoint = `${API}/api/feed?url=${encodeURIComponent(url)}`;

    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.warn("Feed failed:", url, response.status);
      return [];
    }

    const data = await response.json();
    const source = data.feed || new URL(url).hostname;

    return (data.articles || []).map((a) => {
      const enriched = { ...a, source };
      const cat = categorizeArticle(enriched); // your function
      return { ...enriched, category: cat.id, _catScore: cat.score };
    });
  } catch (e) {
    console.warn("Feed error:", url, e);
    return [];
  }
}


    async function loadAll() {
      if (!cancelled) setLoading(true);
      const results = await Promise.all(DEFAULT_FEEDS.map(fetchOne));
      const merged = results.flat();
      merged.sort((a, b) => (new Date(b.published || 0) - new Date(a.published || 0)));

      if (!cancelled) {
        setArticles(merged);
        setError(merged.length ? "" : "Could not load articles. Check backend or feeds.");
        setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  const uniqueSources = useMemo(() => {
    const s = new Set(articles.map((a) => a.source).filter(Boolean));
    return Array.from(s);
  }, [articles]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    for (const { id, label } of CATEGORY_DEFS) {
      if (id === "general") continue; // we'll still compute, just not highlight
      counts[id] = 0;
    }
    for (const a of articles) {
      counts[a.category] = (counts[a.category] || 0) + 1;
    }
    return counts;
  }, [articles]);

  const categoriesForToolbar = useMemo(() => {
    // show only categories that have at least one article (plus All)
    const present = CATEGORY_DEFS.filter(c =>
      c.id === "general" ? false : (categoryCounts[c.id] || 0) > 0
    );
    return present;
  }, [categoryCounts]);

  const filteredArticles = useMemo(() => {
    if (activeCat === "all") return articles;
    return articles.filter(a => a.category === activeCat);
  }, [articles, activeCat]);

  const groupedMap = useMemo(() => {
    if (!grouped) return null;
    const map = new Map();
    for (const a of filteredArticles) {
      const label = getCategoryLabel(a.category);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(a);
    }
    // Keep category groups in a desirable order (as defined)
    const ordered = CATEGORY_DEFS
      .filter(c => c.id !== "general")
      .map(c => [c.label, map.get(c.label) || []])
      .filter(([, arr]) => arr.length > 0);
    return ordered;
  }, [filteredArticles, grouped]);

  return (
    <div className="ns-root">
      <StyleTag />

      <header className="ns-header">
        <div className="ns-container">
          <h1 className="ns-title">Top Stories</h1>
          <p className="ns-sub">A fast digest of today’s news from trusted sources.</p>
        </div>
      </header>

      <main className="ns-container">
        <CategoryToolbar
          counts={categoryCounts}
          active={activeCat}
          onSelect={setActiveCat}
          grouped={grouped}
          setGrouped={setGrouped}
          categories={categoriesForToolbar}
        />

        {loading && <SkeletonGrid />}
        {!loading && error && <div className="ns-error">{error}</div>}

        {!loading && !error && !grouped && (
          <ArticleGrid articles={filteredArticles} />
        )}

        {!loading && !error && grouped && groupedMap && (
          <GroupedArticleGrid groupedEntries={groupedMap} />
        )}

        {!loading && !error && uniqueSources.length > 0 && (
          <div className="ns-sources">
            <span>Sources: </span>
            {uniqueSources.map((s, i) => (
              <span key={s} className="ns-source-chip">
                {s}{i < uniqueSources.length - 1 ? "," : ""}
              </span>
            ))}
          </div>
        )}
      </main>

      <footer className="ns-footer">
        <div className="ns-container">
          <p>
            News Summarizer — frontend auto-categorization with filters.
            Keywords are configurable in-code. Backend changes optional.
          </p>
        </div>
      </footer>
    </div>
  );
}

function CategoryToolbar({ counts, active, onSelect, grouped, setGrouped, categories }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="ns-toolbar">
      <div className="ns-chip-row">
        <button
          className={`ns-chip ${active === "all" ? "is-active" : ""}`}
          onClick={() => onSelect("all")}
        >
          All <span className="ns-chip-count">{total || 0}</span>
        </button>

        {categories.map((c) => (
          <button
            key={c.id}
            className={`ns-chip ${active === c.id ? "is-active" : ""}`}
            onClick={() => onSelect(c.id)}
            title={c.label}
          >
            {c.label} <span className="ns-chip-count">{counts[c.id] || 0}</span>
          </button>
        ))}
      </div>

      <label className="ns-toggle">
        <input
          type="checkbox"
          checked={grouped}
          onChange={(e) => setGrouped(e.target.checked)}
        />
        <span>Group by category</span>
      </label>
    </div>
  );
}

function GroupedArticleGrid({ groupedEntries }) {
  return (
    <div className="ns-grouped">
      {groupedEntries.map(([label, arr]) => (
        <section key={label} className="ns-group">
          <h3 className="ns-group-title">{label}</h3>
          <div className="ns-grid">
            {arr.map((a, idx) => (
              <ArticleCard key={`${a.link}-${idx}`} article={a} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ArticleGrid({ articles }) {
  if (!articles.length) {
    return <p className="ns-empty">No articles yet. Try again in a minute.</p>;
  }
  return (
    <div className="ns-grid">
      {articles.map((a, idx) => (
        <ArticleCard key={`${a.link}-${idx}`} article={a} />
      ))}
    </div>
  );
}

function ArticleCard({ article }) {
  const { title, link, summary, published, source, category } = article;
  const domain = safeDomain(link) || source || "Unknown";
  const when = formatDate(published);
  const reading = estReadTime(summary);
  const catLabel = getCategoryLabel(category);

  return (
    <article className="ns-card">
      <div className="ns-card-top">
        {catLabel && <span className={`ns-cat-badge ns-cat-${category || "general"}`}>{catLabel}</span>}
      </div>
      <a className="ns-card-title" href={link} target="_blank" rel="noopener noreferrer">
        {title || "Untitled"}
      </a>
      <div className="ns-meta">
        {when && <span>{when}</span>}
        {reading && <span>· {reading}</span>}
      </div>
      <p className="ns-summary">{summary || "No summary available."}</p>
      <div className="ns-card-footer">
        <span className="ns-badge" title={source || domain}>Source: {source || domain}</span>
        <a className="ns-link" href={link} target="_blank" rel="noopener noreferrer">Read</a>
      </div>
    </article>
  );
}

function SkeletonGrid() {
  return (
    <div className="ns-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="ns-card ns-skeleton">
          <div className="ns-skel-line w-70" />
          <div className="ns-skel-line w-40" />
          <div className="ns-skel-line w-100" />
          <div className="ns-skel-line w-90" />
          <div className="ns-skel-line w-60" />
        </div>
      ))}
    </div>
  );
}

// ---------- Categorization ----------

function categorizeArticle(article) {
  const key = (article.link || "") + "|" + (article.title || "");
  if (scoreCache.has(key)) return scoreCache.get(key);

  const text = [
    (article.title || ""),
    (article.summary || ""),
    (article.source || ""),
    safeDomain(article.link || ""),
  ].join(" ").toLowerCase();

  // weights: title counts more, summary medium, source/domain small boost
  const titleText = (article.title || "").toLowerCase();
  const summaryText = (article.summary || "").toLowerCase();
  const srcText = ((article.source || "") + " " + safeDomain(article.link || "")).toLowerCase();

  let best = { id: "general", score: 0 };

  for (const cat of CATEGORY_DEFS) {
    if (cat.id === "general") continue;
    let score = 0;
    for (const kw of cat.keywords) {
      const k = kw.toLowerCase();
      // score boosts
      score += countOccurrences(titleText, k) * 3;   // title is strong
      score += countOccurrences(summaryText, k) * 1; // summary medium
      score += countOccurrences(srcText, k) * 0.5;   // source/domain minor
    }
    if (score > best.score) best = { id: cat.id, score };
  }

  // thresholding: avoid random single hits
  // If nothing scored >= 2, mark General.
  const final = best.score >= 2 ? best : { id: "general", score: 0 };
  scoreCache.set(key, final);
  return final;
}

function countOccurrences(hay, needle) {
  if (!needle || !hay) return 0;
  // rough word-boundary-ish match; also handles partials like "manufactur" to match "manufacturing"
  const re = new RegExp(`\\b${escapeRegExp(needle)}`, "g");
  return (hay.match(re) || []).length;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCategoryLabel(id) {
  return CATEGORY_DEFS.find((c) => c.id === id)?.label || "";
}

// ---------- Utilities ----------

function formatDate(s) {
  const d = s ? new Date(s) : null;
  if (!d || isNaN(d)) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function estReadTime(text) {
  if (!text) return "";
  const wpm = 220;
  const words = (text.match(/\w+/g) || []).length;
  const mins = Math.max(1, Math.round(words / wpm));
  return `${mins} min read`;
}

function safeDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

// ---------- Inline CSS (vanilla, no Tailwind) ----------

function StyleTag() {
  return (
    <style>{`
      :root {
        --bg: #f6f7f9;
        --fg: #1f2937;
        --muted: #6b7280;
        --card: #ffffff;
        --border: #e5e7eb;
        --accent: #0f172a;
        --accent-2: #0ea5e9;
        --radius: 14px;
        --shadow: 0 4px 14px rgba(0,0,0,0.06);
        --shadow-hover: 0 6px 20px rgba(0,0,0,0.10);
        --maxw: 1180px;
      }
      * { box-sizing: border-box; }
      html, body {
  background-color: #f8fafc;
  background-image: radial-gradient(circle at 25px 25px, #dbeafe 1px, transparent 0);
  background-size: 40px 40px;
}

      .ns-container { max-width: var(--maxw); margin: 0 auto; padding: 0 18px; }
      .ns-header { background: linear-gradient(180deg, #ffffff, rgba(255,255,255,0.6)); border-bottom: 1px solid var(--border); }
      .ns-title { font-size: 28px; margin: 22px 0 4px; letter-spacing: -0.02em; }
      .ns-sub { margin: 0 0 18px; color: var(--muted); }

      .ns-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 12px 0 18px; flex-wrap: wrap; }
      .ns-chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .ns-chip { border: 1px solid var(--border); background: #000; padding: 6px 10px; border-radius: 999px; font-size: 13px; cursor: pointer; box-shadow: var(--shadow); }
      .ns-chip:hover { box-shadow: var(--shadow-hover); }
      .ns-chip.is-active { background: #000; border-color: #bfdbfe; }
      .ns-chip-count { margin-left: 6px; color: var(--muted); }

      .ns-toggle { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }

      .ns-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }
      .ns-group { margin-bottom: 26px; }
      .ns-group-title { margin: 8px 2px 12px; font-size: 18px; color: var(--accent); }

      .ns-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; box-shadow: var(--shadow); display: flex; flex-direction: column; transition: box-shadow .15s ease, transform .15s ease; }
      .ns-card:hover { box-shadow: var(--shadow-hover); transform: translateY(-2px); }

      .ns-card-top { display: flex; justify-content: flex-end; }
      .ns-cat-badge { font-size: 11px; padding: 4px 8px; border-radius: 999px; border: 1px solid var(--border); background: #f8fafc; color: #0b1220; }
      .ns-cat-tech { background: #eef2ff; }
      .ns-cat-finance { background: #ecfeff; }
      .ns-cat-world { background: #fff7ed; }
      .ns-cat-business { background: #fefce8; }
      .ns-cat-science { background: #f0fdf4; }
      .ns-cat-health { background: #fff1f2; }
      .ns-cat-sports { background: #f1f5f9; }
      .ns-cat-entertainment { background: #faf5ff; }
      .ns-cat-education { background: #e0f2fe; }
      .ns-cat-environment { background: #ecfccb; }
      .ns-cat-travel { background: #fdf2f8; }

      .ns-card-title { font-size: 16.5px; font-weight: 650; color: var(--accent); text-decoration: none; line-height: 1.25; }
      .ns-card-title:hover { text-decoration: underline; }

      .ns-meta { margin: 8px 0 10px; color: var(--muted); font-size: 12.5px; display: flex; gap: 8px; align-items: center; }
      .ns-summary { margin: 0 0 14px; font-size: 14.5px; line-height: 1.55; color: #0b1220; }

      .ns-card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 10px; border-top: 1px dashed var(--border); }
      .ns-badge { font-size: 12px; color: var(--muted); background: #f3f4f6; border: 1px solid var(--border); padding: 4px 8px; border-radius: 999px; }
      .ns-link { font-size: 13px; color: var(--accent-2); text-decoration: none; font-weight: 600; }
      .ns-link:hover { text-decoration: underline; }

      .ns-sources { margin: 22px 0 0; color: var(--muted); font-size: 13px; }
      .ns-source-chip { margin-right: 6px; }

      .ns-footer { margin: 28px 0 40px; color: var(--muted); font-size: 13px; }
      .ns-error { background: #fff1f2; color: #7f1d1d; border: 1px solid #fecaca; padding: 12px 14px; border-radius: 10px; }
      .ns-empty { color: var(--muted); }

      /* Skeletons */
      .ns-skeleton { position: relative; overflow: hidden; }
      .ns-skel-line { height: 12px; background: #eef0f3; border-radius: 8px; margin: 10px 0; }
      .ns-skeleton::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent); transform: translateX(-100%); animation: shimmer 1.3s infinite; }
      @keyframes shimmer { 100% { transform: translateX(100%); } }
      .w-100 { width: 100%; } .w-90 { width: 90%; } .w-70 { width: 70%; } .w-60 { width: 60%; }

      @media (max-width: 520px) { .ns-title { font-size: 22px; } }
    `}</style>
  );
}
