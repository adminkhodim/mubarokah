-- ====================================================================
-- MIGRATION 14: TAMBAH KOLOM KATEGORI & SINKRONKAN TAGIHAN SEPTEMBER 2026
-- Supabase public.keuangan_tagihan menjadi 204 records (1:1 Spreadsheet)
-- ====================================================================

-- 1. Tambah Kolom kategori (BULANAN / TAHUNAN)
ALTER TABLE public.keuangan_tagihan 
ADD COLUMN IF NOT EXISTS kategori VARCHAR(30) DEFAULT 'BULANAN';

-- 2. Update Label Kategori untuk Data yang Sudah Ada
UPDATE public.keuangan_tagihan 
SET kategori = 'TAHUNAN' 
WHERE tagihan_id LIKE 'TGH-THN-%' OR periode LIKE '%/%';

UPDATE public.keuangan_tagihan 
SET kategori = 'BULANAN' 
WHERE kategori IS NULL OR kategori = '' OR tagihan_id NOT LIKE 'TGH-THN-%';

-- 3. Masukkan 51 Tagihan Periode September 2026 (2026-09) agar Total Genap 204 Records
INSERT INTO public.keuangan_tagihan (
    tenant_id,
    tagihan_id,
    student_id,
    raw_student_id,
    student_name,
    pos_id,
    nama_pos,
    periode,
    kategori,
    nominal_tagihan,
    nominal_terbayar,
    sisa_tagihan,
    status,
    due_date,
    updated_at
)
SELECT 
    s.tenant_id,
    'TGH-202609-' || s.student_id || '-' || t.tariff_id AS tagihan_id,
    s.id AS student_id,
    s.student_id AS raw_student_id,
    s.name AS student_name,
    t.tariff_id AS pos_id,
    t.name AS nama_pos,
    '2026-09' AS periode,
    'BULANAN' AS kategori,
    t.amount AS nominal_tagihan,
    0 AS nominal_terbayar,
    t.amount AS sisa_tagihan,
    'BELUM_LUNAS' AS status,
    '2026-09-10'::date AS due_date,
    NOW() AS updated_at
FROM public.students s
JOIN public.financial_tariffs t ON (
    (s.program ILIKE '%Tahfidz Anak%' AND t.tariff_id = 'TRF-SPP-04') OR
    (s.program ILIKE '%MA Tahfidz%' AND t.tariff_id = 'TRF-SPP-03') OR
    (s.program ILIKE '%Tahfidz Dewasa%' AND t.tariff_id = 'TRF-SPP-02') OR
    (t.tariff_id = 'TRF-SPP-01' AND s.program NOT ILIKE '%Anak%' AND s.program NOT ILIKE '%MA%' AND s.program NOT ILIKE '%Dewasa%')
)
WHERE UPPER(s.status) IN ('AKTIF', 'ACTIVE')
ON CONFLICT (tenant_id, tagihan_id) DO NOTHING;

-- 4. Tambahkan Index kategori untuk performa query & dashboard
CREATE INDEX IF NOT EXISTS idx_tagihan_kategori ON public.keuangan_tagihan(tenant_id, kategori);

