# Tech Stack Analyzer

Bir web sitesinin teknoloji altyapısını analiz eden araç. Next.js + Claude API ile yapılmış.

---

## Kurulum (Lokal)

### 1. Gereksinimler
- Node.js 18+ (https://nodejs.org)
- Anthropic API key (https://console.anthropic.com)

### 2. Projeyi indir ve kur

```bash
# Bağımlılıkları yükle
npm install

# .env.example dosyasını kopyala
cp .env.example .env.local
```

### 3. API key'ini ekle

`.env.local` dosyasını aç ve kendi API key'ini yaz:

```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

API key'ini şuradan alabilirsin: https://console.anthropic.com/settings/keys

### 4. Başlat

```bash
npm run dev
```

Tarayıcıda http://localhost:3000 aç.

---

## Vercel'e Deploy

### Adım 1 — GitHub'a yükle

```bash
git init
git add .
git commit -m "ilk commit"
```

GitHub'da yeni bir repo oluştur (https://github.com/new), sonra:

```bash
git remote add origin https://github.com/KULLANICI_ADIN/techstack-analyzer.git
git push -u origin main
```

### Adım 2 — Vercel'e bağla

1. https://vercel.com adresine git
2. "Add New Project" → GitHub reposunu seç
3. "Deploy" butonuna tıkla

### Adım 3 — API key ekle

Deploy bittikten sonra:
1. Vercel dashboard'da projeye tıkla
2. **Settings** → **Environment Variables**
3. Şunu ekle:
   - Key: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-api03-...` (kendi key'in)
4. **Save** ve **Redeploy** yap

---

## Proje Yapısı

```
techstack-analyzer/
├── app/
│   ├── page.tsx              ← Ana sayfa (kullanıcı arayüzü)
│   ├── page.module.css       ← Stiller
│   ├── layout.tsx            ← HTML layout
│   ├── globals.css           ← Global CSS değişkenleri
│   └── api/
│       └── analyze/
│           └── route.ts      ← Backend (siteyi fetch + Claude analizi)
├── .env.local                ← API key (git'e ekleme!)
├── .env.example              ← Örnek env dosyası
└── package.json
```

## Nasıl Çalışır

1. Kullanıcı URL girer
2. Frontend `/api/analyze` endpoint'ine POST atar
3. Backend (Next.js API Route):
   - Hedef siteye fetch atar (CORS sorunu yok çünkü sunucu tarafında)
   - HTML'in ilk 30KB'ını ve HTTP header'larını alır
   - Claude API'ye gönderir
   - Claude teknolojileri tespit eder ve JSON döner
4. Frontend sonuçları gösterir

## Özellikler

- Frontend/Backend/Hosting tespiti
- Tespit güven skoru
- Hangi sinyallerin bulunduğu
- Türkçe açıklama
- Karanlık mod desteği
- Hızlı örnek URL'ler
