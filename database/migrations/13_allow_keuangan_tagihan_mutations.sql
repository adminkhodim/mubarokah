-- ====================================================================
-- MIGRATION 13: BUKA HAK AKSES WRITE/INSERT PADA KEUANGAN_TAGIHAN & TRANSAKSI
-- SERTA SINKRONISASI TAGIHAN TAHUNAN KE SUPABASE POSTGRESQL
-- ====================================================================

-- 1. Berikan Policy Lengkap (SELECT, INSERT, UPDATE, DELETE) pada keuangan_tagihan
DROP POLICY IF EXISTS "Allow Read Keuangan Tagihan" ON public.keuangan_tagihan;
DROP POLICY IF EXISTS "Allow All Keuangan Tagihan" ON public.keuangan_tagihan;

CREATE POLICY "Allow All Keuangan Tagihan" ON public.keuangan_tagihan
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 2. Berikan Policy Lengkap (SELECT, INSERT, UPDATE, DELETE) pada keuangan_transaksi
DROP POLICY IF EXISTS "Allow Read Keuangan Transaksi" ON public.keuangan_transaksi;
DROP POLICY IF EXISTS "Allow All Keuangan Transaksi" ON public.keuangan_transaksi;

CREATE POLICY "Allow All Keuangan Transaksi" ON public.keuangan_transaksi
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Pastikan foreign key student_id nullable (agar raw_student_id fleksibel)
ALTER TABLE public.keuangan_tagihan ALTER COLUMN student_id DROP NOT NULL;

-- 4. Berikan izin grant eksplisit ke anon & authenticated
GRANT ALL ON public.keuangan_tagihan TO anon, authenticated, service_role;
GRANT ALL ON public.keuangan_transaksi TO anon, authenticated, service_role;

-- 5. Masukkan / Sinkronisasikan Seluruh Tagihan Tahunan Santri (2026/2027) Langsung ke Supabase
INSERT INTO public.keuangan_tagihan (
    tenant_id,
    tagihan_id,
    student_id,
    raw_student_id,
    student_name,
    pos_id,
    nama_pos,
    periode,
    nominal_tagihan,
    nominal_terbayar,
    sisa_tagihan,
    status,
    due_date
)
SELECT 
    s.tenant_id,
    'TGH-THN-20262027-' || s.student_id || '-' || t.tariff_id,
    s.id,
    s.student_id,
    s.name,
    t.tariff_id,
    t.name,
    '2026/2027',
    t.amount,
    0,
    t.amount,
    'BELUM_LUNAS',
    '2026-11-15'::date
FROM public.students s
CROSS JOIN public.financial_tariffs t
WHERE s.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
  AND t.tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'
  AND (t.category = 'TAHUNAN' OR t.period_type = 'TAHUNAN')
  AND t.is_active = true
ON CONFLICT (tenant_id, tagihan_id) DO NOTHING;
