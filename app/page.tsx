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

const EXAMPLES = [
  "vercel.com",
  "shopify.com",
  "naryayinlari.com",
  "wordpress.org",
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("Analiz ediliyor...");

  const messages = [
    "Siteye bağlanılıyor...",
    "HTML okunuyor...",
    "Teknolojiler tespit ediliyor...",
    "Sonuçlar hazırlanıyor...",
  ];

  async function analyze(inputUrl?: string) {
    const target = inputUrl ?? url;
    if (!target.trim()) return;

    setLoading(true);
    setResult(null);
    setError("");

    let i = 0;
    setLoadingMsg(messages[0]);
    const interval = setInterval(() => {
      i = (i + 1) % messages.length;
      setLoadingMsg(messages[i]);
    }, 1500);

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
  const confLabel =
    confidence >= 70 ? "Güvenilir tespit" :
    confidence >= 40 ? "Kısmi tespit" :
    "Sınırlı sinyal";

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Tech Stack Analyzer</h1>
          <p className={styles.subtitle}>
            Bir web sitesinin teknoloji altyapısını saniyeler içinde öğren
          </p>
        </div>

        <div className={styles.inputRow}>
          <input
            type="text"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
          />
          <button
            className={styles.analyzeBtn}
            onClick={() => analyze()}
            disabled={loading || !url.trim()}
          >
            {loading ? "..." : "Analiz et"}
          </button>
        </div>

        <div className={styles.examples}>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              className={styles.exampleBtn}
              onClick={() => clickExample(ex)}
              disabled={loading}
            >
              {ex}
            </button>
          ))}
        </div>

        {loading && (
          <div className={styles.loading}>
            <span className={styles.spinner} />
            <span className={styles.loadingText}>{loadingMsg}</span>
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        {result && (
          <div className={styles.results}>
            <div className={styles.metaCard}>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Alan adı</span>
                <span className={styles.metaValue}>{result.domain}</span>
              </div>
              {result.title && (
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Başlık</span>
                  <span className={styles.metaValue}>{result.title}</span>
                </div>
              )}
            </div>

            <div className={styles.stackGrid}>
              {result.frontend?.length > 0 && (
                <Section title="Frontend" items={result.frontend} type="frontend" />
              )}
              {result.backend?.length > 0 && (
                <Section title="Backend / Sunucu" items={result.backend} type="backend" />
              )}
              {result.hosting?.length > 0 && (
                <Section title="Hosting / CDN" items={result.hosting} type="hosting" />
              )}
            </div>

            <div className={styles.confidenceSection}>
              <div className={styles.confHeader}>
                <span className={styles.confTitle}>Tespit güveni</span>
                <span className={styles.confPct}>{confidence}% — {confLabel}</span>
              </div>
              <div className={styles.confBar}>
                <div
                  className={styles.confFill}
                  style={{
                    width: `${confidence}%`,
                    background: confidence >= 70 ? "#1D9E75" : confidence >= 40 ? "#BA7517" : "#E24B4A",
                  }}
                />
              </div>
            </div>

            {result.signals?.length > 0 && (
              <div className={styles.signals}>
                <div className={styles.signalsTitle}>Tespit sinyalleri</div>
                <div className={styles.signalList}>
                  {result.signals.map((s, i) => (
                    <span key={i} className={styles.signal}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {result.notes && (
              <p className={styles.notes}>{result.notes}</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Section({ title, items, type }: { title: string; items: string[]; type: string }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{title}</div>
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
