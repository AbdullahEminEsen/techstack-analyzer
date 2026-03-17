"use client";

import { useState, KeyboardEvent } from "react";
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

const EXAMPLES = ["vercel.com", "shopify.com", "naryayinlari.com", "wordpress.org"];

const LOADING_MESSAGES = [
  "Siteye bağlanılıyor...",
  "HTTP başlıkları okunuyor...",
  "Script etiketleri taranıyor...",
  "Teknolojiler tespit ediliyor...",
  "Sonuçlar hazırlanıyor...",
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [analyzed, setAnalyzed] = useState("");

  async function analyze(inputUrl?: string) {
    const target = (inputUrl ?? url).trim();
    if (!target) return;

    setLoading(true);
    setResult(null);
    setError("");
    setAnalyzed(target);

    let i = 0;
    setLoadingMsg(LOADING_MESSAGES[0]);
    const interval = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[i]);
    }, 1400);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bir hata oluştu");
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") analyze();
  }

  function clickExample(ex: string) {
    setUrl(ex);
    analyze(ex);
  }

  const confidence = result?.confidence ?? 0;
  const confColor =
    confidence >= 70 ? "#1D9E75" : confidence >= 40 ? "#BA7517" : "#E24B4A";
  const confLabel =
    confidence >= 70 ? "Güvenilir" : confidence >= 40 ? "Kısmi" : "Sınırlı";

  const totalTech =
    (result?.frontend?.length ?? 0) +
    (result?.backend?.length ?? 0) +
    (result?.hosting?.length ?? 0);

  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <div className={styles.badge}>AI destekli analiz</div>
        <h1 className={styles.heroTitle}>Tech Stack Analyzer</h1>
        <p className={styles.heroSub}>
          Herhangi bir web sitesinin teknoloji altyapısını saniyeler içinde keşfet
        </p>
      </div>

      <div className={styles.searchCard}>
        <div className={styles.inputGroup}>
          <svg className={styles.inputIcon} viewBox="0 0 20 20" fill="none">
            <path d="M13 13l4 4M8 15A7 7 0 108 1a7 7 0 000 14z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            className={styles.searchInput}
          />
          <button
            className={styles.searchBtn}
            onClick={() => analyze()}
            disabled={loading || !url.trim()}
          >
            {loading ? <span className={styles.btnSpinner} /> : "Analiz et →"}
          </button>
        </div>

        <div className={styles.examples}>
          <span className={styles.examplesLabel}>Örnekler:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              className={styles.exampleChip}
              onClick={() => clickExample(ex)}
              disabled={loading}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className={styles.loadingCard}>
          <div className={styles.loadingDots}>
            <span /><span /><span />
          </div>
          <div className={styles.loadingText}>{loadingMsg}</div>
          <div className={styles.loadingUrl}>{analyzed}</div>
        </div>
      )}

      {error && (
        <div className={styles.errorCard}>
          <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
            <circle cx="10" cy="10" r="8" stroke="#E24B4A" strokeWidth="1.5"/>
            <path d="M10 6v4M10 14h.01" stroke="#E24B4A" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {error}
        </div>
      )}

      {result && (
        <div className={styles.resultsCard}>
          <div className={styles.resultHeader}>
            <div className={styles.resultSite}>
              <div className={styles.favicon}>
                <img
                  src={`https://www.google.com/s2/favicons?sz=32&domain=${result.domain}`}
                  alt=""
                  width={20}
                  height={20}
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
            {result.frontend?.length > 0 && (
              <StackSection title="Frontend" items={result.frontend} type="frontend" />
            )}
            {result.backend?.length > 0 && (
              <StackSection title="Backend / Sunucu" items={result.backend} type="backend" />
            )}
            {result.hosting?.length > 0 && (
              <StackSection title="Hosting / CDN" items={result.hosting} type="hosting" />
            )}
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
                {result.signals.map((s, i) => (
                  <code key={i} className={styles.signal}>{s}</code>
                ))}
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
        </div>
      )}

      <footer className={styles.footer}>
        Claude API &amp; Next.js ile yapılmıştır
      </footer>
    </main>
  );
}

function StackSection({ title, items, type }: {
  title: string;
  items: string[];
  type: string;
}) {
  return (
    <div className={styles.stackSection}>
      <div className={styles.stackHeader}>
        <span className={styles.stackTitle}>{title}</span>
        <span className={styles.stackCount}>{items.length}</span>
      </div>
      <div className={styles.tagGrid}>
        {items.map((item) => (
          <span key={item} className={`${styles.tag} ${styles[type]}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
