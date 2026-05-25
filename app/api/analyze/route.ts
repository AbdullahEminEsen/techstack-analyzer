import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createHash, randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MODEL = "claude-sonnet-4-6";
const COOKIE_NAME = "ts_device_id";
const HTML_LIMIT = 60_000;

// Gunluk tum kullanicilar icin toplam YENI analiz tavani (cache hit sayilmaz).
// .env'den ayarlanabilir; yoksa 100.
const DAILY_LIMIT = Number(process.env.DAILY_ANALYSIS_LIMIT ?? 100);

// --- URL'i SADECE kok domain'e indirge (path/query/hash at, subdomain'i koru) ---
function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  const url = new URL(u);
  const host = url.hostname.replace(/^www\./i, "");
  return `https://${host}`;
}

function domainOf(normalizedUrl: string): string {
  try {
    return new URL(normalizedUrl).hostname.replace(/^www\./i, "");
  } catch {
    return normalizedUrl;
  }
}

function extractSignals(html: string, headers: Headers) {
  const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]).slice(0, 40);
  const links = [...html.matchAll(/<link[^>]+href=["']([^"']+)["']/gi)].map((m) => m[1]).slice(0, 20);
  const metaGenerator = [...html.matchAll(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/gi)].map((m) => m[1]);
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().slice(0, 120) : "";
  const interestingHeaders: Record<string, string> = {};
  ["server", "x-powered-by", "via", "cf-ray", "x-vercel-id", "x-aspnet-version", "x-generator"].forEach((h) => {
    const v = headers.get(h);
    if (v) interestingHeaders[h] = v.slice(0, 200);
  });
  return { scripts, links, metaGenerator, interestingHeaders, title };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL gerekli" }, { status: 400 });
    }

    // ---- 1) Cihaz limiti kontrolu ----
    let deviceId = req.cookies.get(COOKIE_NAME)?.value;
    let isNewDevice = false;
    if (!deviceId) {
      deviceId = randomUUID();
      isNewDevice = true;
    } else {
      const { data: usage } = await supabaseAdmin
        .from("analysis_usage")
        .select("device_id")
        .eq("device_id", deviceId)
        .maybeSingle();
      if (usage) {
        return NextResponse.json(
          { error: "Bu cihazla zaten bir analiz yaptiniz. Demo, cihaz basina 1 analizle sinirli." },
          { status: 429 }
        );
      }
    }

    const normalizedUrl = normalizeUrl(url);
    const domain = domainOf(normalizedUrl);

    // ---- 2) Hedef siteyi fetch et ----
    let html = "";
    let resHeaders = new Headers();
    try {
      const res = await fetch(normalizedUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; TechStackAnalyzer/1.0)" },
        signal: AbortSignal.timeout(15_000),
      });
      resHeaders = res.headers;
      html = (await res.text()).slice(0, HTML_LIMIT);
    } catch {
      return NextResponse.json({ error: "Site getirilemedi. URL'i kontrol edin." }, { status: 502 });
    }

    const htmlHash = createHash("sha256").update(html).digest("hex");

    // ---- 3) Cache kontrolu ----
    const { data: cached } = await supabaseAdmin
      .from("analyses")
      .select("result, html_hash")
      .eq("url", normalizedUrl)
      .maybeSingle();

    let result: Record<string, unknown>;
    let fromCache = false;

    if (cached && cached.html_hash === htmlHash) {
      // CACHE HIT: Claude'a gidilmez, para harcanmaz, gunluk limit sayilmaz.
      result = cached.result as Record<string, unknown>;
      fromCache = true;
    } else {
      // ---- 3b) YENI analiz olacak -> once GLOBAL GUNLUK LIMITi kontrol et ----
      const { data: counterVal, error: counterErr } = await supabaseAdmin.rpc("increment_daily_counter", {
        p_day: todayStr(),
      });
      if (counterErr) {
        console.error("Sayac hatasi:", counterErr.message);
        return NextResponse.json({ error: "Sunucu hatasi, tekrar deneyin." }, { status: 500 });
      }
      if (typeof counterVal === "number" && counterVal > DAILY_LIMIT) {
        return NextResponse.json(
          {
            error: "Bugunluk analiz kapasitesi doldu. Bu arac API maliyetiyle calisiyor; yarin tekrar deneyebilir ya da destek olabilirsiniz.",
            limitReached: true,
          },
          { status: 429 }
        );
      }

      // ---- 4) Claude ile analiz ----
      const signals = extractSignals(html, resHeaders);
      const prompt = `Sen bir web teknolojisi tespit uzmanisin. Asagidaki sinyallere dayanarak sitenin teknoloji altyapisini tespit et.

URL: ${normalizedUrl}
Sayfa basligi: ${signals.title}

HTTP Header'lari: ${JSON.stringify(signals.interestingHeaders)}
Meta generator: ${JSON.stringify(signals.metaGenerator)}
Script kaynaklari: ${JSON.stringify(signals.scripts)}
Link kaynaklari: ${JSON.stringify(signals.links)}

HTML (kisaltilmis):
${html.slice(0, 20_000)}

SADECE su JSON formatinda yanit ver, baska hicbir sey yazma:
{
  "frontend": ["tespit edilen frontend teknolojileri"],
  "backend": ["backend / sunucu teknolojileri"],
  "hosting": ["hosting / CDN"],
  "confidence": 85,
  "signals": ["tespiti dayandirdigin somut kanitlar"],
  "notes": "1-2 cumlelik kisa aciklama (Turkce)"
}

KURALLAR:
- confidence 0-100 arasi bir SAYI olmali (string degil).
- Emin olmadigin kategoriyi bos dizi [] birak. Tahmin uydurma.
- signals dizisine gercekten gordugun kanitlari yaz.`;

      let message;
      try {
        message = await client.messages.create({
          model: MODEL,
          max_tokens: 1024,
          messages: [{ role: "user", content: prompt }],
        });
      } catch (e: unknown) {
        // Anthropic kredisi bitti / kimlik hatasi -> sik mesaj
        const status = (e as { status?: number })?.status;
        if (status === 400 || status === 401 || status === 429) {
          return NextResponse.json(
            {
              error: "Analiz servisi su an gecici olarak kullanilamiyor. Lutfen daha sonra tekrar deneyin.",
              serviceDown: true,
            },
            { status: 503 }
          );
        }
        throw e;
      }

      const text = message.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("")
        .replace(/```json|```/g, "")
        .trim();

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: "Analiz sonucu cozumlenemedi." }, { status: 500 });
      }

      result = {
        domain,
        title: signals.title || undefined,
        frontend: Array.isArray(parsed.frontend) ? parsed.frontend : [],
        backend: Array.isArray(parsed.backend) ? parsed.backend : [],
        hosting: Array.isArray(parsed.hosting) ? parsed.hosting : [],
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
        signals: Array.isArray(parsed.signals) ? parsed.signals : [],
        notes: typeof parsed.notes === "string" ? parsed.notes : "",
      };

      await supabaseAdmin.from("analyses").upsert(
        {
          url: normalizedUrl,
          html_hash: htmlHash,
          result,
          model: MODEL,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "url" }
      );
    }

    // ---- 5) Cihaz hakkini isaretle ----
    await supabaseAdmin
      .from("analysis_usage")
      .upsert({ device_id: deviceId, analyzed_url: normalizedUrl }, { onConflict: "device_id" });

    // ---- 6) Yanit ----
    const response = NextResponse.json({ ...result, fromCache });
    if (isNewDevice) {
      response.cookies.set(COOKIE_NAME, deviceId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // localde false, canlida true
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }
    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Beklenmeyen bir hata olustu." }, { status: 500 });
  }
}