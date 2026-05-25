"use client";

import { useState, KeyboardEvent, useEffect, useRef } from "react";
import styles from "./page.module.css";

type Result = {
  domain: string;
  title?: string;
  frontend: string[];
  backend: string[];
  hosting: string[];
  confidence: number;
  signals: string[];
  notes: string;
};

type HistoryItem = {
  url: string;
  domain: string;
  result: Result;
  analyzedAt: number;
};

const EXAMPLES = ["vercel.com", "shopify.com", "wordpress.org", "github.com"];
const LOADING_MESSAGES = [
  "Siteye bağlanılıyor...",
  "HTTP başlıkları okunuyor...",
  "Script etiketleri taranıyor...",
  "Teknolojiler tespit ediliyor...",
  "Sonuçlar hazırlanıyor...",
];
const MAX_HISTORY = 10;

export default function Home() {
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [url, setUrl] = useState("");
  const [url2, setUrl2] = useState("");
  const [loading, setLoading] = useState(false);
  const [loading2, setLoading2] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [result2, setResult2] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [error2, setError2] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tsa_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Eski/bozuk kayıtları (frontend dizisi olmayanları) ayıkla
        const clean = Array.isArray(parsed)
          ? parsed.filter((h) => h?.result && Array.isArray(h.result.frontend))
          : [];
        setHistory(clean);
      }
    } catch {}
  }, []);

  // Read ?q= and ?q2= from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const q2 = params.get("q2");
    if (q && q2) {
      setUrl(q);
      setUrl2(q2);
      setMode("compare");
      setTimeout(() => analyzeCompare(), 0);
    } else if (q) {
      setUrl(q);
      analyze(q);
    }
  }, []);

  function saveHistory(u: string, r: Result) {
    const item: HistoryItem = { url: u, domain: r.domain, result: r, analyzedAt: Date.now() };
    setHistory(prev => {
      const filtered = prev.filter(h => h.domain !== r.domain);
      const next = [item, ...filtered].slice(0, MAX_HISTORY);
      try { localStorage.setItem("tsa_history", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function startProgress() {
    setProgress(0);
    let p = 0;
    progressRef.current = setInterval(() => {
      p += Math.random() * 12;
      if (p > 90) p = 90;
      setProgress(p);
    }, 400);
  }

  function stopProgress() {
    if (progressRef.current) clearInterval(progressRef.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 600);
  }

  async function fetchAnalysis(target: string): Promise<Result> {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: target }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Bir hata oluştu");
    return data;
  }

  async function analyze(inputUrl?: string) {
    const target = (inputUrl ?? url).trim();
    if (!target) return;

    setLoading(true);
    setResult(null);
    setError("");
    startProgress();

    let i = 0;
    setLoadingMsg(LOADING_MESSAGES[0]);
    const msgInterval = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[i]);
    }, 1400);

    try {
      const data = await fetchAnalysis(target);
      setResult(data);
      saveHistory(target, data);
      // Update share URL
      const u = new URL(window.location.href);
      u.searchParams.set("q", target);
      u.searchParams.delete("q2");
      window.history.replaceState({}, "", u.toString());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      clearInterval(msgInterval);
      stopProgress();
      setLoading(false);
    }
  }

  async function analyzeCompare() {
    if (!url.trim() || !url2.trim()) return;
    setLoading(true);
    setLoading2(true);
    setResult(null);
    setResult2(null);
    setError("");
    setError2("");
    startProgress();

    let i = 0;
    setLoadingMsg(LOADING_MESSAGES[0]);
    const msgInterval = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[i]);
    }, 1400);

    try {
      const [r1, r2] = await Promise.allSettled([
        fetchAnalysis(url.trim()),
        fetchAnalysis(url2.trim()),
      ]);
      if (r1.status === "fulfilled") { setResult(r1.value); saveHistory(url, r1.value); }
      else setError(r1.reason?.message || "Hata");
      if (r2.status === "fulfilled") { setResult2(r2.value); saveHistory(url2, r2.value); }
      else setError2(r2.reason?.message || "Hata");
    } finally {
      clearInterval(msgInterval);
      stopProgress();
      setLoading(false);
      setLoading2(false);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") mode === "compare" ? analyzeCompare() : analyze();
  }

  function clickExample(ex: string) {
    setUrl(ex);
    setMode("single");
    analyze(ex);
  }

  function loadFromHistory(item: HistoryItem) {
    setUrl(item.url);
    setResult(item.result);
    setShowHistory(false);
    setMode("single");
  }

  function clearHistory() {
    setHistory([]);
    try { localStorage.removeItem("tsa_history"); } catch {}
  }

  async function copyShareLink() {
    const u = new URL(window.location.href);
    if (url) u.searchParams.set("q", url.trim());
    if (mode === "compare" && url2) u.searchParams.set("q2", url2.trim());
    await navigator.clipboard.writeText(u.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isLoading = loading || loading2;

  return (
    <main className={styles.main}>
      {/* Progress bar */}
      {progress > 0 && (
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.badge}>AI destekli analiz</div>
        <h1 className={styles.heroTitle}>Tech Stack Analyzer</h1>
        <p className={styles.heroSub}>
          Herhangi bir web sitesinin teknoloji altyapısını saniyeler içinde keşfet
        </p>
      </div>

      {/* Mode tabs */}
      <div className={styles.modeTabs}>
        <button
          className={`${styles.modeTab} ${mode === "single" ? styles.modeTabActive : ""}`}
          onClick={() => { setMode("single"); setResult2(null); }}
        >
          Tekli analiz
        </button>
        <button
          className={`${styles.modeTab} ${mode === "compare" ? styles.modeTabActive : ""}`}
          onClick={() => setMode("compare")}
        >
          Karşılaştır
        </button>
        <button
          className={`${styles.modeTab} ${showHistory ? styles.modeTabActive : ""}`}
          onClick={() => setShowHistory(v => !v)}
        >
          Geçmiş {history.length > 0 && <span className={styles.historyBadge}>{history.length}</span>}
        </button>
      </div>

      {/* History panel */}
      {showHistory && (
        <div className={`${styles.searchCard} ${styles.historyCard}`}>
          {history.length === 0 ? (
            <div className={styles.emptyHistory}>Henüz analiz yapılmadı</div>
          ) : (
            <>
              <div className={styles.historyHeader}>
                <span className={styles.historyTitle}>Son analizler</span>
                <button className={styles.clearBtn} onClick={clearHistory}>Temizle</button>
              </div>
              {history.map((item, i) => (
                <button key={i} className={styles.historyItem} onClick={() => loadFromHistory(item)}>
                  <img
                    src={`https://www.google.com/s2/favicons?sz=32&domain=${item.domain}`}
                    alt="" width={14} height={14}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <span className={styles.historyDomain}>{item.domain}</span>
                  <span className={styles.historyTime}>{timeAgo(item.analyzedAt)}</span>
                  <span className={styles.historyTechs}>
                    {[...(item.result.frontend ?? []), ...(item.result.backend ?? []), ...(item.result.hosting ?? [])].slice(0, 3).join(" · ")}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Search card */}
      <div className={styles.searchCard}>
        <div className={styles.inputGroup}>
          <svg className={styles.inputIcon} viewBox="0 0 20 20" fill="none">
            <path d="M13 13l4 4M8 15A7 7 0 108 1a7 7 0 000 14z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder={mode === "compare" ? "https://site-1.com" : "https://example.com"}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKey}
            disabled={isLoading}
            className={styles.searchInput}
          />
          {mode === "single" && (
            <button className={styles.searchBtn} onClick={() => analyze()} disabled={isLoading || !url.trim()}>
              {loading ? <span className={styles.btnSpinner} /> : "Analiz et →"}
            </button>
          )}
        </div>

        {mode === "compare" && (
          <>
            <div className={styles.vsRow}>
              <div className={styles.vsDivider} />
              <span className={styles.vsLabel}>vs</span>
              <div className={styles.vsDivider} />
            </div>
            <div className={styles.inputGroup}>
              <svg className={styles.inputIcon} viewBox="0 0 20 20" fill="none">
                <path d="M13 13l4 4M8 15A7 7 0 108 1a7 7 0 000 14z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                placeholder="https://site-2.com"
                value={url2}
                onChange={(e) => setUrl2(e.target.value)}
                onKeyDown={handleKey}
                disabled={isLoading}
                className={styles.searchInput}
              />
            </div>
            <button
              className={styles.compareBtn}
              onClick={analyzeCompare}
              disabled={isLoading || !url.trim() || !url2.trim()}
            >
              {isLoading ? <><span className={styles.btnSpinner} /> Analiz ediliyor...</> : "İkisini karşılaştır →"}
            </button>
          </>
        )}

        <div className={styles.bottomRow}>
          <div className={styles.examples}>
            <span className={styles.examplesLabel}>Örnekler:</span>
            {EXAMPLES.map((ex) => (
              <button key={ex} className={styles.exampleChip} onClick={() => clickExample(ex)} disabled={isLoading}>
                {ex}
              </button>
            ))}
          </div>
          {(result || url) && (
            <button className={styles.shareBtn} onClick={copyShareLink} title="Linki kopyala">
              {copied ? "✓ Kopyalandı" : "Paylaş"}
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className={styles.loadingCard}>
          <div className={styles.loadingDots}><span /><span /><span /></div>
          <div className={styles.loadingText}>{loadingMsg}</div>
        </div>
      )}

      {/* Results */}
      {!isLoading && (result || result2) && (
        <div className={mode === "compare" ? styles.compareGrid : ""}>
          {result && <ResultCard result={result} error={error} index={0} />}
          {mode === "compare" && result2 && <ResultCard result={result2} error={error2} index={1} />}
        </div>
      )}

      {!isLoading && error && !result && (
        <div className={styles.errorCard}>
          <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
            <circle cx="10" cy="10" r="8" stroke="#E24B4A" strokeWidth="1.5"/>
            <path d="M10 6v4M10 14h.01" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {error}
        </div>
      )}

      <footer className={styles.footer}>
        <div>Claude API &amp; Next.js ile yapılmıştır</div>
        <a
          href={process.env.NEXT_PUBLIC_DONATE_URL || "#"}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10,
            padding: "6px 14px", borderRadius: 8, fontSize: 13, textDecoration: "none",
            border: "1px solid #ffffff22", color: "inherit", opacity: 0.85,
          }}
          >
        ❤️ Bu araç API maliyetiyle çalışıyor — destek ol
        </a>
      </footer>
    </main>
  );
}

function ResultCard({ result, error, index }: { result: Result; error?: string; index: number }) {
  const confidence = result.confidence ?? 0;
  const confColor = confidence >= 70 ? "#1D9E75" : confidence >= 40 ? "#BA7517" : "#E24B4A";
  const confLabel = confidence >= 70 ? "Güvenilir" : confidence >= 40 ? "Kısmi" : "Sınırlı";
  const totalTech = (result.frontend?.length ?? 0) + (result.backend?.length ?? 0) + (result.hosting?.length ?? 0);

  return (
    <div className={styles.resultsCard} style={{ animationDelay: `${index * 0.1}s` }}>
      <div className={styles.resultHeader}>
        <div className={styles.resultSite}>
          <div className={styles.favicon}>
            <img
              src={`https://www.google.com/s2/favicons?sz=32&domain=${result.domain}`}
              alt="" width={20} height={20}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div>
            <div className={styles.resultDomain}>{result.domain}</div>
            {result.title && <div className={styles.resultTitle}>{result.title}</div>}
          </div>
        </div>
        <div className={styles.statBadge}>
          <span className={styles.statNum}>{totalTech}</span>
          <span className={styles.statLabel}>teknoloji</span>
        </div>
      </div>

      <div className={styles.stackSections}>
        {result.frontend?.length > 0 && <StackSection title="Frontend" items={result.frontend} type="frontend" delay={0} />}
        {result.backend?.length > 0 && <StackSection title="Backend / Sunucu" items={result.backend} type="backend" delay={1} />}
        {result.hosting?.length > 0 && <StackSection title="Hosting / CDN" items={result.hosting} type="hosting" delay={2} />}
      </div>

      <div className={styles.divider} />

      <div className={styles.confidenceRow}>
        <div className={styles.confLeft}>
          <span className={styles.confTitle}>Tespit güveni</span>
          <span className={styles.confBadge} style={{ color: confColor, borderColor: confColor + "40", background: confColor + "12" }}>
            {confLabel}
          </span>
        </div>
        <span className={styles.confPct} style={{ color: confColor }}>{confidence}%</span>
      </div>
      <div className={styles.confBar}>
        <div className={styles.confFill} style={{ width: `${confidence}%`, background: confColor }} />
      </div>

      {result.signals?.length > 0 && (
        <div className={styles.signalsBlock}>
          <div className={styles.signalsTitle}>Tespit sinyalleri</div>
          <div className={styles.signalList}>
            {result.signals.map((s, i) => <code key={i} className={styles.signal}>{s}</code>)}
          </div>
        </div>
      )}

      {result.notes && (
        <div className={styles.notesBlock}>
          <svg viewBox="0 0 16 16" fill="none" width="14" height="14" style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 7v4M8 5.5h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {result.notes}
        </div>
      )}

      {error && (
        <div className={styles.errorCard} style={{ marginTop: 12 }}>
          <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
            <circle cx="10" cy="10" r="8" stroke="#E24B4A" strokeWidth="1.5"/>
            <path d="M10 6v4M10 14h.01" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}

function StackSection({ title, items, type, delay }: { title: string; items: string[]; type: string; delay: number }) {
  return (
    <div className={styles.stackSection} style={{ animationDelay: `${delay * 0.08}s` }}>
      <div className={styles.stackHeader}>
        <span className={styles.stackTitle}>{title}</span>
        <span className={styles.stackCount}>{items.length}</span>
      </div>
      <div className={styles.tagGrid}>
        {items.map((item, i) => (
          <span
            key={item}
            className={`${styles.tag} ${styles[type]}`}
            style={{ animationDelay: `${delay * 0.08 + i * 0.04}s` }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins}dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}sa önce`;
  return `${Math.floor(hours / 24)}g önce`;
}
