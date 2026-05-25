# Tech Stack Analyzer

Herhangi bir web sitesinin teknoloji altyapısını saniyeler içinde tespit eden AI destekli araç.

**[Demo →](https://techstack-analyzer.vercel.app)**

---

## Nasıl çalışır?

```
Kullanıcı URL girer
       ↓
Next.js API Route (sunucu tarafında)
       ↓
Hedef siteye fetch atar (HTML + HTTP headers)
       ↓
Claude API ile analiz eder
       ↓
Frontend / Backend / Hosting teknolojilerini döner
```

Tarayıcıdan direkt fetch atılmadığı için CORS sorunu yoktur. Tüm işlem Next.js'in API Route'u üzerinden sunucu tarafında gerçekleşir.

### Tespit edilen sinyaller
- `<meta name="generator">` tagları
- Script `src` adresleri (React, Vue, Angular, jQuery...)
- CSS class isimleri (Tailwind, Bootstrap...)
- HTTP header'ları (`X-Powered-By`, `Server`, `Via`, `CF-Ray`...)
- URL kalıpları (`_next/`, `wp-content/`, `__nuxt/`...)
- Sayfa altındaki "Powered by" ibareleri

---

## Kurulum

### Gereksinimler
- Node.js 18+
- Anthropic API key → [console.anthropic.com](https://console.anthropic.com)

### Lokal çalıştırma

```bash
git clone https://github.com/kullanici/techstack-analyzer
cd techstack-analyzer

npm install

cp .env.example .env.local
# .env.local dosyasını aç, ANTHROPIC_API_KEY değerini gir

npm run dev
# → http://localhost:3000
```

---

## Vercel Deploy

### 1. GitHub'a yükle

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/KULLANICI/techstack-analyzer.git
git push -u origin main
```

### 2. Vercel'e bağla

[vercel.com](https://vercel.com) → **Add New Project** → GitHub reposunu seç → **Deploy**

### 3. API key ekle

Vercel dashboard → **Settings** → **Environment Variables**

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |

Kaydet → **Deployments** → **Redeploy**

---

## Proje yapısı

```
app/
├── page.tsx                 ← Kullanıcı arayüzü (React)
├── page.module.css          ← Stiller
├── layout.tsx               ← HTML layout
├── globals.css              ← Tema değişkenleri (light/dark)
└── api/
    └── analyze/
        └── route.ts         ← Backend: fetch + Claude analizi
```

### `route.ts` ne yapar?

```ts
// 1. Hedef siteyi fetch et (sunucu tarafında, CORS yok)
const res = await fetch(targetUrl, { ... });
const html = await res.text(); // ilk 30KB yeterli

// 2. Claude'a gönder.
const message = await client.messages.create({
  model: "claude-haiku-4-5-20251001",
  messages: [{ role: "user", content: prompt }],
});

// 3. JSON parse et ve döndür
return NextResponse.json(parsed);
```

---

## Teknoloji

- **[Next.js](https://nextjs.org)** — Frontend + API Routes
- **[Claude API](https://anthropic.com)** — Teknoloji tespiti (Haiku modeli)
- **[Vercel](https://vercel.com)** — Hosting

---

## Lisans

MIT
