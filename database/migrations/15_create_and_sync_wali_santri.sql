-- ====================================================================
-- MIGRATION 15: OTORISASI & SINKRONISASI DATA WALI SANTRI LENGKAP
-- Menyiapkan public.guardians & public.student_guardians untuk Modul Wali
-- ====================================================================

-- 1. Buka RLS Policy agar Web App dapat membaca dan mengubah data Wali & Relasi
DROP POLICY IF EXISTS "Allow Read Guardians" ON public.guardians;
DROP POLICY IF EXISTS "Allow All Guardians" ON public.guardians;

CREATE POLICY "Allow All Guardians" ON public.guardians
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Read Student Guardians" ON public.student_guardians;
DROP POLICY IF EXISTS "Allow All Student Guardians" ON public.student_guardians;

CREATE POLICY "Allow All Student Guardians" ON public.student_guardians
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

GRANT ALL ON public.guardians TO anon, authenticated, service_role;
GRANT ALL ON public.student_guardians TO anon, authenticated, service_role;

-- 2. Sinkronisasikan Data Wali dari public.user_identities ke public.guardians
INSERT INTO public.guardians (
    tenant_id,
    identity_id,
    name,
    email,
    phone,
    photo_url,
    status,
    created_at,
    updated_at
)
SELECT 
    tenant_id,
    identity_id,
    name,
    email,
    phone,
    photo_url,
    COALESCE(status, 'ACTIVE'),
    COALESCE(created_at, NOW()),
    NOW()
FROM public.user_identities
WHERE role = 'WALI_SANTRI'
ON CONFLICT (tenant_id, identity_id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = COALESCE(EXCLUDED.phone, public.guardians.phone),
    photo_url = COALESCE(EXCLUDED.photo_url, public.guardians.photo_url),
    status = EXCLUDED.status,
    updated_at = NOW();

-- 3. Pastikan Index Cepat untuk Pencarian Nama, Phone & Relasi
CREATE INDEX IF NOT EXISTS idx_guardians_name ON public.guardians(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_guardians_email ON public.guardians(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_student_guardians_composite ON public.student_guardians(tenant_id, guardian_id, student_id);
