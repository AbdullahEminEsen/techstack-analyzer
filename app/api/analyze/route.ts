import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url) {
    return NextResponse.json({ error: "URL gerekli" }, { status: 400 });
  }

  // Normalize URL
  let targetUrl = url.trim();
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = "https://" + targetUrl;

  // 1. Fetch the target site's HTML (from our server — no CORS issues)
  let siteHtml = "";
  let siteHeaders: Record<string, string> = {};

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TechStackBot/1.0)" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // Collect response headers
    res.headers.forEach((val, key) => { siteHeaders[key] = val; });

    // Read first 30KB of HTML (enough for <head>)
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    if (reader) {
      while (totalBytes < 30000) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        totalBytes += value.byteLength;
      }
      reader.cancel();
    }
    siteHtml = new TextDecoder().decode(
      new Uint8Array(chunks.reduce<number[]>((acc, c) => [...acc, ...c], []))
    ).slice(0, 30000);
  } catch {
    siteHtml = "(Siteye erişilemedi — sadece URL ve domain bilgisiyle analiz yapılacak)";
  }

  // 2. Ask Claude to detect the tech stack
  const prompt = `Sen bir web teknolojisi tespit uzmanısın. Aşağıdaki bilgileri kullanarak sitenin teknoloji altyapısını tespit et.

URL: ${targetUrl}

HTTP Başlıkları:
${JSON.stringify(siteHeaders, null, 2)}

HTML (ilk 30KB):
${siteHtml}

Şunlara bak:
- <meta name="generator"> tagları
- Script src'leri (react, vue, angular, next, nuxt, jquery vb.)
- CSS framework ipuçları (tailwind class'ları, bootstrap sınıfları)
- X-Powered-By, Server, Via, CF-Ray header'ları
- _next/, __nuxt/, wp-content/ gibi URL kalıpları
- CDN sinyalleri (cloudflare, fastly, akamai)
- CMS/platform ipuçları (WordPress, Shopify, Webflow vb.)
- Sayfanın en altındaki "Powered by" veya "Built with" ibareleri

SADECE JSON döndür, başka hiçbir şey yazma:
{
  "domain": "example.com",
  "title": "Sayfa başlığı",
  "frontend": ["React", "Tailwind CSS"],
  "backend": ["Node.js"],
  "hosting": ["Cloudflare", "Vercel"],
  "confidence": 75,
  "signals": ["X-Powered-By: Express", "_next/ URL paterni", "React script tagi"],
  "notes": "Kısa Türkçe açıklama — hangi sinyaller tespit edildi"
}

Kurallar:
- Sadece güçlü kanıt olan teknolojileri ekle
- confidence: 0-100 arası (kaç net sinyal bulduğuna göre)
- notes Türkçe olsun
- Emin olmadığın şeyleri ekleme
- SADECE JSON döndür, markdown veya açıklama ekleme`;

  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  // Parse JSON — strip markdown fences if present
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    return NextResponse.json({ error: "Analiz sonucu ayrıştırılamadı" }, { status: 500 });
  }

  return NextResponse.json(JSON.parse(match[0]));
}
