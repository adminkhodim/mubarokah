const fs = require('fs');
const path = require('path');

const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxoaFyXy4OKx4dNwuuaVBf6N4as4M2602DyGRE0ocFKUvY6PXPJCyyUP7BP5RDreDveKw/exec";
const SITE_URL = "https://www.mubarokah.my.id";
const DEFAULT_IMAGE = `${SITE_URL}/assets/img/og-image.png`;

/**
 * Normalisasi URL Gambar agar dapat di-crawl sempurna oleh bot WhatsApp & Facebook
 */
function normalizeImageUrl(url) {
    if (!url || typeof url !== 'string') return DEFAULT_IMAGE;
    url = url.trim();
    if (!url) return DEFAULT_IMAGE;

    // Konversi Google Drive viewer link ke direct CDN googleusercontent
    if (url.includes('drive.google.com')) {
        const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
            return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
        }
    }

    // Jika relative URL, jadikan absolut
    if (url.startsWith('/')) {
        return `${SITE_URL}${url}`;
    }

    return url;
}

/**
 * Escape karakter HTML untuk keamanan injeksi meta tag
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

module.exports = async function handler(req, res) {
    const { slug } = req.query;

    try {
        // Ambil URL Google Apps Script dari Env atau fallback resmi
        const scriptUrl = process.env.MUBAROKAH_APPS_SCRIPT_URL || DEFAULT_SCRIPT_URL;
        let data = null;
        if (scriptUrl) {
            const response = await fetch(`${scriptUrl}?action=getKabar`);
            data = await response.json();
        }

        let newsItem = null;
        if (data && data.status === 'success' && Array.isArray(data.data)) {
            newsItem = data.data.find(n => n.slug === slug || n.news_id === slug);
        }

        // Baca index.html lokal
        const indexPath = path.join(process.cwd(), 'index.html');
        let html = fs.readFileSync(indexPath, 'utf8');

        if (newsItem) {
            const title = `${newsItem.judul} | Mubarokah App`;
            const rawDescription = newsItem.ringkasan || (newsItem.isi ? newsItem.isi.substring(0, 160) : `Baca warta selengkapnya tentang ${newsItem.judul}`);
            const description = rawDescription.replace(/\s+/g, ' ').trim();
            const image = normalizeImageUrl(newsItem.gambar);
            const canonicalUrl = `${SITE_URL}/berita/${encodeURIComponent(newsItem.slug || slug)}`;

            const dynamicMetaTags = `
    <title>${escapeHtml(title)}</title>

    <!-- SEO & Metadata Dinamis Berita -->
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="author" content="${escapeHtml(newsItem.penulis || 'PPTQ Roudlotul Mubarokah')}">

    <!-- Open Graph (WhatsApp, Facebook, Telegram, LinkedIn) -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:site_name" content="PPTQ Roudlotul Mubarokah">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${image}">
    <meta property="og:image:secure_url" content="${image}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${escapeHtml(newsItem.judul)}">
    <meta property="article:published_time" content="${escapeHtml(newsItem.tanggal || '')}">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${image}">`;

            // Ganti blok meta tags statis lama dengan meta tags dinamis berita
            const oldMetaRegex = /<title>[\s\S]*?<meta name="twitter:image" content="[^"]*">/i;
            if (oldMetaRegex.test(html)) {
                html = html.replace(oldMetaRegex, dynamicMetaTags.trim());
            } else {
                html = html.replace(/<title>.*?<\/title>/is, dynamicMetaTags.trim());
            }

            // Suntikkan data awal berita (SSR Injection) agar langsung tampil instan (0ms)
            const safeNewsJson = JSON.stringify(newsItem).replace(/</g, '\\u003c');
            const initialNewsScript = `\n    <script>window.__INITIAL_NEWS__ = ${safeNewsJson};</script>`;
            html = html.replace('</head>', `${initialNewsScript}\n</head>`);
        }

        // Pastikan <base href="/"> selalu ada di <head> untuk mencegah salah resolusi relative assets
        if (!html.includes('<base href="/"')) {
            html = html.replace(/<head[^>]*>/i, '$&\n    <base href="/">');
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
        res.status(200).send(html);

    } catch (error) {
        console.error("Error generating OG preview:", error);
        try {
            const indexPath = path.join(process.cwd(), 'index.html');
            const html = fs.readFileSync(indexPath, 'utf8');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.status(200).send(html);
        } catch (readError) {
            res.status(500).send("Internal Server Error");
        }
    }
};
