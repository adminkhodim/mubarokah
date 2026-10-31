-- ====================================================================
-- MIGRATION 05: SINKRONISASI USER IDENTITIES & STUDENT GUARDIANS
-- Target Tenant : PPTQ Roudlotul Mubarokah (baa9eb9b-2d87-4648-a674-059bb289cb63)
-- Sumber Data   : Google Spreadsheet [OFFICIAL] (Sheet: Users & Wali_Santri_Map)
-- ====================================================================

-- 1. UPSERT SELURUH AKUN PENGGUNA (USERS -> USER_IDENTITIES)
INSERT INTO public.user_identities (
  tenant_id,
  identity_id,
  email,
  phone,
  name,
  role,
  status,
  photo_url,
  password_hash,
  last_login_at,
  last_seen_at,
  device_info
) VALUES
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'SUPER_ADMIN-001',
  'adminkhodim@gmail.com',
  NULL,
  'Super Admin',
  'SUPER_ADMIN',
  'ACTIVE',
  NULL,
  NULL,
  '2026-10-07T16:25:12.237Z',
  '2026-10-31T02:03:51.626Z',
  '📱 Mobile Safari (iOS)'
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'ADMIN-001',
  'izzatatabik@gmail.com',
  NULL,
  'Admin Mubarokah App',
  'ADMIN',
  'ACTIVE',
  'https://lh3.googleusercontent.com/d/1oFfO0xQhHAX9-8Q82fM2TsU9NPhqKjYK',
  NULL,
  '2026-10-30T00:44:43.488Z',
  '2026-10-31T02:05:45.205Z',
  '💻 Chrome Windows'
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'USR_263bd3dd8df6',
  'nazirulmuhammad1992@gmail.com',
  '+6289602807020',
  'Ustadz Nazirul Muhammad, AH.',
  'ASATIDZ',
  'ACTIVE',
  'https://lh3.googleusercontent.com/d/1Y6nw-qsrHm_yG3F-QzApcTDJYBei4ISb',
  NULL,
  '2026-10-13T09:38:59.021Z',
  '2026-10-28T15:24:57.894Z',
  '💻 Chrome Windows'
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'USR_13b1be739206',
  'facenovaid@gmail.com',
  '+6289653887640',
  'Ibu Khoiriyyah',
  'WALI_SANTRI',
  'ACTIVE',
  NULL,
  NULL,
  NULL,
  '2026-10-11T16:07:30.184Z',
  '💻 Chrome Windows'
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'USR_414149f6d0cc',
  'lailaluthfiana539@gmail.com',
  '+62882002478236',
  'Ustadzah Laila Luthfiana, AH.',
  'ASATIDZ',
  'ACTIVE',
  NULL,
  NULL,
  '2026-10-09T13:58:12.252Z',
  '2026-10-12T03:41:17.470Z',
  '📱 PWA Android'
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'USR_a60123fecc32',
  'awaliyahrobiatul0@gmail.com',
  '+6285741212946',
  'Ustadzah Robiatul Awaliyah, AH.',
  'ASATIDZ',
  'ACTIVE',
  'https://lh3.googleusercontent.com/d/18J0qZoaCwjOkZQFnxFh0IMAeRyj8LW_j',
  NULL,
  NULL,
  NULL,
  NULL
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'USR_e4fbe6fe6373',
  'izzanazila64@gmail.com',
  '+6289661559683',
  'Ustadzah Izza Nazila, AH.',
  'ASATIDZ',
  'ACTIVE',
  NULL,
  NULL,
  '2026-10-06T23:00:27.199Z',
  '2026-10-10T01:40:29.143Z',
  '📱 PWA iOS'
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'USR_ce3d910e3001',
  'lestarilestariii66@mail.com',
  NULL,
  'Tutik Egiq Lestari',
  'BENDAHARA',
  'ACTIVE',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'USR_12da5f21de64',
  'hidayatullahzaen7@gmail.com',
  '+628813740845',
  'Ust. Hidayatullah Zaen',
  'ASATIDZ',
  'ACTIVE',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'USR_46bb4265163f',
  '089619709533md@gmail.com',
  '+6289619709533',
  'Ust. Mukhlasin',
  'ASATIDZ',
  'ACTIVE',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'USR_WLI_dc2d3a95a361',
  'boyobajol660@gmail.com',
  '+6285934212271',
  'Muhammad safi''i',
  'WALI_SANTRI',
  'ACTIVE',
  NULL,
  '4aad8174a2941a5f4ba995524d73d4c5d62dd276b89cf0d9cc1462d72a0aaecb',
  '2026-10-04T03:08:02.790Z',
  NULL,
  NULL
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'USR_WLI_23c96250b67d',
  'rokatunrokatun827@gmail.com',
  '+6289501022591',
  'Edi nurrozi',
  'WALI_SANTRI',
  'ACTIVE',
  NULL,
  '4aad8174a2941a5f4ba995524d73d4c5d62dd276b89cf0d9cc1462d72a0aaecb',
  '2026-10-04T03:15:03.272Z',
  NULL,
  NULL
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'USR_WLI_9a7045de5d6d',
  'vichamesila123@gmail.com',
  '+6288221731882',
  'ibu Siti sulaimanah',
  'WALI_SANTRI',
  'ACTIVE',
  'https://lh3.googleusercontent.com/d/10wT-FMN-yBwlqShKi031mbE_UsTvqMJl',
  '5d65f60ee56cfa1a2dac70055bcbc2e54e4ad5eae0d594c814b20a1a6a21a094',
  '2026-10-04T04:59:16.279Z',
  '2026-10-30T11:40:39.607Z',
  '📱 Mobile Chrome (Android)'
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'USR_WLI_822ea364e832',
  'khosipahumi@gmail.com',
  '+6285656251514',
  'Umi kosipah',
  'WALI_SANTRI',
  'ACTIVE',
  NULL,
  'c0d693009e8982e994ff2724dc082834f7705212b85bd093ac5f7d56079d398d',
  '2026-10-04T06:42:24.704Z',
  NULL,
  NULL
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'USR_WLI_01ab35c1d97b',
  'armayzynayan7732@gmail.com',
  '+6285876526690',
  'Tuminah',
  'WALI_SANTRI',
  'ACTIVE',
  NULL,
  NULL,
  '2026-10-05T05:54:43.623Z',
  '2026-10-26T05:55:02.507Z',
  '📱 PWA Android'
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'USR_WLI_c1e4331f1f26',
  'miftahulrohmah143@gmail.com',
  '+628826421884',
  'Miftakhurohmah',
  'WALI_SANTRI',
  'ACTIVE',
  NULL,
  'a79b3f067e57b5249c5e6b14450d3e5c2a1136bff4e7d82965d58fa326b6a5e8',
  '2026-10-05T06:31:18.398Z',
  NULL,
  NULL
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'USR_WLI_ee4cc3c00664',
  'febye5022@gmail.com',
  '+6285735886950',
  'Muhammad Safi''i',
  'WALI_SANTRI',
  'ACTIVE',
  NULL,
  NULL,
  '2026-10-05T10:21:21.651Z',
  '2026-10-30T08:33:36.358Z',
  '📱 PWA Android'
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'USR_7e7d85c54718',
  'roudlotulmubarokah83@gmail.com',
  NULL,
  'Ketua Pondok',
  'PENGURUS',
  'ACTIVE',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
)
ON CONFLICT (tenant_id, identity_id) DO UPDATE SET
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  photo_url = COALESCE(EXCLUDED.photo_url, public.user_identities.photo_url),
  password_hash = COALESCE(EXCLUDED.password_hash, public.user_identities.password_hash),
  last_login_at = COALESCE(EXCLUDED.last_login_at, public.user_identities.last_login_at),
  last_seen_at = COALESCE(EXCLUDED.last_seen_at, public.user_identities.last_seen_at),
  device_info = COALESCE(EXCLUDED.device_info, public.user_identities.device_info),
  updated_at = NOW();

-- 2. SINKRONISASI RELASI WALI & SANTRI (WALI_SANTRI_MAP -> STUDENT_GUARDIANS)
INSERT INTO public.student_guardians (
  tenant_id,
  guardian_id,
  student_id,
  relationship,
  is_primary
) VALUES
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  (SELECT id FROM public.guardians WHERE identity_id = 'USR_13b1be739206' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),
  (SELECT id FROM public.students WHERE student_id = 'STD_015' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),
  'GUARDIAN',
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  (SELECT id FROM public.guardians WHERE identity_id = 'USR_WLI_dc2d3a95a361' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),
  (SELECT id FROM public.students WHERE student_id = 'STD_038' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),
  'GUARDIAN',
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  (SELECT id FROM public.guardians WHERE identity_id = 'USR_WLI_23c96250b67d' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),
  (SELECT id FROM public.students WHERE student_id = 'STD_042' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),
  'GUARDIAN',
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  (SELECT id FROM public.guardians WHERE identity_id = 'USR_WLI_9a7045de5d6d' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),
  (SELECT id FROM public.students WHERE student_id = 'STD_027' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),
  'GUARDIAN',
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  (SELECT id FROM public.guardians WHERE identity_id = 'USR_WLI_822ea364e832' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),
  (SELECT id FROM public.students WHERE student_id = 'STD_009' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),
  'MOTHER',
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  (SELECT id FROM public.guardians WHERE identity_id = 'USR_WLI_01ab35c1d97b' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),
  (SELECT id FROM public.students WHERE student_id = 'STD_010' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),
  'MOTHER',
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  (SELECT id FROM public.guardians WHERE identity_id = 'USR_WLI_c1e4331f1f26' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),
  (SELECT id FROM public.students WHERE student_id = 'STD_034' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),
  'MOTHER',
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  (SELECT id FROM public.guardians WHERE identity_id = 'USR_WLI_ee4cc3c00664' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),
  (SELECT id FROM public.students WHERE student_id = 'STD_038' AND tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63'),
  'GUARDIAN',
  true
)
ON CONFLICT (tenant_id, guardian_id, student_id) DO UPDATE SET
  relationship = EXCLUDED.relationship,
  is_primary = EXCLUDED.is_primary;
