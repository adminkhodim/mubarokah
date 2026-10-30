const fs = require('fs');
const baseUrl = 'https://script.google.com/macros/s/AKfycbz4To49WTzqN2r3M8M3H4_YyAbeMjfTWRgxLrz6-YXuf7oFAVZZ6okh14LTIkZdMj9qGg/exec';

function escapeSql(str) {
  if (!str) return 'null';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

async function run() {
  console.log('Fetching live banners and news from Google Apps Script...');
  const [bannerRes, newsRes] = await Promise.all([
    fetch(baseUrl + '?action=getBanner').then(r => r.json()),
    fetch(baseUrl + '?action=getKabar').then(r => r.json())
  ]);

  const tenantId = 'baa9eb9b-2d87-4648-a674-059bb289cb63';

  let sql = `-- ====================================================================
-- MIGRATION 04: SINKRONISASI BANNER & BERITA RESMI PPTQ ROUDLOTUL MUBAROKAH
-- Target Tenant : Pondok Pesantren Tahfidzul Qur'an Roudlotul Mubarokah
-- Tenant ID     : baa9eb9b-2d87-4648-a674-059bb289cb63
-- Sumber Data   : Google Spreadsheet [OFFICIAL]
-- ====================================================================

-- 1. Bersihkan banner lama / placeholder dummy
DELETE FROM public.banners WHERE tenant_id = '${tenantId}';

-- 2. Masukkan 5 banner riil resmi pesantren
INSERT INTO public.banners (
  tenant_id,
  title,
  subtitle,
  image_url,
  link_url,
  badge_text,
  display_order,
  is_active
) VALUES
`;

  const bVals = bannerRes.data.map(b => {
    const linkUrl = b.tipeAksi === 'tab' ? (b.targetAksi ? '/' + b.targetAksi : null) : (b.tipeAksi === 'url' ? b.targetAksi : null);
    const badge = b.tipeAksi === 'tab' && b.targetAksi === 'ppdb' ? 'PPDB' : null;
    return `(
  '${tenantId}',
  ${escapeSql(b.nama)},
  null,
  ${escapeSql(b.gambar)},
  ${escapeSql(linkUrl)},
  ${escapeSql(badge)},
  ${b.urutan},
  ${b.status.toLowerCase() === 'aktif'}
)`;
  });

  sql += bVals.join(',\n') + ';\n\n';

  sql += `-- 3. Upsert seluruh berita artikel resmi pesantren
INSERT INTO public.news_articles (
  tenant_id,
  title,
  slug,
  category,
  author,
  cover_image,
  summary,
  content,
  published_at,
  views_count,
  is_published
) VALUES
`;

  const nVals = newsRes.data.map(n => {
    return `(
  '${tenantId}',
  ${escapeSql(n.judul)},
  ${escapeSql(n.slug)},
  ${escapeSql(n.kategori)},
  ${escapeSql(n.penulis)},
  ${escapeSql(n.gambar)},
  ${escapeSql(n.ringkasan)},
  ${escapeSql(n.isi)},
  now(),
  ${n.views || 0},
  true
)`;
  });

  sql += nVals.join(',\n');
  sql += `
ON CONFLICT (tenant_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  author = EXCLUDED.author,
  cover_image = EXCLUDED.cover_image,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  views_count = EXCLUDED.views_count,
  updated_at = now();
`;

  fs.writeFileSync('database/migrations/04_sync_real_banners_and_news.sql', sql, 'utf8');
  console.log('✅ Berhasil membuat database/migrations/04_sync_real_banners_and_news.sql');
}

run().catch(console.error);
