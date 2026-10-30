-- ====================================================================
-- MIGRATION 04: SINKRONISASI BANNER & BERITA RESMI PPTQ ROUDLOTUL MUBAROKAH
-- Target Tenant : Pondok Pesantren Tahfidzul Qur'an Roudlotul Mubarokah
-- Tenant ID     : baa9eb9b-2d87-4648-a674-059bb289cb63
-- Sumber Data   : Google Spreadsheet [OFFICIAL]
-- ====================================================================

-- 1. Bersihkan banner lama / placeholder dummy
DELETE FROM public.banners WHERE tenant_id = 'baa9eb9b-2d87-4648-a674-059bb289cb63';

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
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'Mubarokah App',
  null,
  'https://lh3.googleusercontent.com/d/1Qt7T_LTggD3i8fBxvpDG2GxzZ1ecvyvy',
  null,
  null,
  1,
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'Wisuda Yanbua Ke-6',
  null,
  'https://lh3.googleusercontent.com/d/16nIcIGDWQ2bV_zYurTiG0OhMgRc8eWjv',
  null,
  null,
  2,
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'Tahfidz Anak',
  null,
  'https://lh3.googleusercontent.com/d/1wj4QdbIrlpeC-CZcDhu4S0MR2wdpR7e8',
  '/ppdb',
  'PPDB',
  3,
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'Khotmil Qur''an Ke-21',
  null,
  'https://lh3.googleusercontent.com/d/1f39UFeIErjNpXJZhRWWv-IYGbXeyINow',
  '/ppdb',
  'PPDB',
  4,
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'Khotmil Qur''an Ke-22',
  null,
  'https://lh3.googleusercontent.com/d/15QxQ7PciBi0dT1_Ob0r7mx2FT9upD-TD',
  '/ppdb',
  'PPDB',
  5,
  true
);

-- 3. Upsert seluruh berita artikel resmi pesantren
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
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'Cara Memilih Pesantren Telah Berubah, Pesantren Harus Beradaptasi',
  'cara-memilih-pesantren-telah-berubah-pesantren-harus-beradaptasi-ohpn',
  'Artikel',
  'Tim Redaksi Pesantren',
  'https://lh3.googleusercontent.com/d/1k6PprSZD1lSiSUOXr4bqQwG5_Yvng7cO',
  'Perubahan cara masyarakat memilih pesantren menjadi tantangan bagi lembaga pendidikan. Pesantren perlu beradaptasi tanpa kehilangan tradisi dan nilai kepesantrenan.',
  'Cirebon - Perubahan zaman tidak hanya mengubah teknologi, cara berkomunikasi, dan cara manusia bekerja. Perubahan juga mulai mengubah cara masyarakat memilih lembaga pendidikan untuk anak-anaknya, termasuk dalam memilih pesantren.

Hal tersebut menjadi salah satu gagasan penting yang disampaikan KH. Imam Jazuli, Lc. MA., Pengasuh Pesantren Bina Insan Mulia Cirebon, dalam Workshop Pesantren Rintisan Nasional Provinsi Jawa Tengah yang digelar di ASTON Cirebon Hotel & Convention Center, Minggu, 20 September 2026.

Dari materi dan sambutan yang disampaikan, ada satu pesan besar yang terasa kuat:

*"Pesantren harus mampu membaca perubahan. Sebab, pesantren yang ingin terus tumbuh tidak cukup hanya mempertahankan apa yang sudah ada, tetapi juga harus mampu merespons kebutuhan masyarakat yang terus berubah."*


**Cara Memilih Pesantren Sudah Berubah**

Ada masa ketika memilih pesantren sangat erat kaitannya dengan hubungan keluarga dan alumni.
Orang tua yang pernah mondok di sebuah pesantren akan cenderung memasukkan anaknya ke pesantren yang sama. Ada ikatan guru, alumni, keluarga, tradisi, dan kepercayaan yang diwariskan dari satu generasi ke generasi berikutnya.
Namun situasinya sekarang mulai berbeda.
Banyak orang tua yang tidak memiliki latar belakang sebagai alumni pesantren. Mereka mencari informasi sendiri, membandingkan berbagai pilihan, melihat program pendidikan, fasilitas, lingkungan, hingga mencari informasi melalui internet dan media sosial.
Lebih jauh lagi, anak-anak sekarang juga semakin terlibat dalam menentukan pilihan pendidikan mereka sendiri.
Mereka bisa melihat video pesantren di YouTube, Instagram, TikTok, atau website. Mereka bisa mengetahui fasilitas sebuah pesantren bahkan sebelum pernah datang ke sana.

Dengan demikian, pesantren hari ini tidak hanya perlu menjawab pertanyaan: *"Apa yang kita ajarkan?"*
Tetapi juga: *"Apa yang dibutuhkan calon santri dan keluarganya?"*


**Wali Santri Tidak Lagi Hanya Berasal dari Kalangan Alumni**

Perubahan lain yang perlu diperhatikan adalah semakin beragamnya latar belakang wali santri.
Jika dahulu sebagian besar calon wali santri mungkin mengenal pesantren melalui jaringan alumni, sekarang masyarakat dapat menemukan pesantren melalui banyak pintu.
Ada yang menemukan pesantren melalui Google.
Ada yang melihat media sosial.
Ada yang mendapatkan rekomendasi teman.
Ada yang melihat prestasi santri.
Ada yang tertarik karena program tahfidz.
Ada yang mencari pesantren dengan pendidikan formal yang kuat.
Ada pula yang mempertimbangkan fasilitas dan lingkungan pendidikan.

Artinya, pesantren harus mampu memperkenalkan dirinya kepada masyarakat yang sebelumnya tidak memiliki hubungan langsung dengan pesantren tersebut.
Sejarah dan nama besar tetap penting. Tetapi masyarakat juga ingin mengetahui:
*"Apa yang akan didapatkan anak saya jika belajar di sini?"*


**Masyarakat Mulai Mencari Output**

Salah satu kata kunci yang menarik dari workshop tersebut adalah output.
Masyarakat tidak hanya melihat apakah sebuah pesantren mempunyai program. Mereka juga mulai melihat hasil dari program tersebut.

Misalnya, ketika sebuah pesantren memiliki program tahfidz, calon wali santri mungkin akan bertanya:
Berapa target hafalan santri?
Bagaimana metode pembelajarannya?
Bagaimana kualitas hafalannya?
Apa yang dilakukan setelah santri menyelesaikan target?
Bagaimana pendidikan formalnya?
Bagaimana masa depan santri setelah lulus?

Demikian pula ketika pesantren menawarkan program bahasa.
Pertanyaannya bukan sekadar:
*"Apakah ada bahasa Inggris?"*
Tetapi:
*"Setelah mengikuti program tersebut, kemampuan bahasa Inggris santri akan sampai pada tahap apa?"*

Begitu juga dengan teknologi, kewirausahaan, kepemimpinan, pendidikan formal, maupun berbagai program lainnya.
Program menjadi lebih bermakna ketika pesantren mampu menjelaskan hasil yang ingin dicapai.


**Anak Sekarang Ikut Memilih**

Perubahan yang sangat penting adalah posisi anak dalam menentukan pilihan.
Dulu, keputusan memilih pesantren lebih banyak berada di tangan orang tua.
Sekarang anak juga mempunyai referensi sendiri.
Anak bisa berkata:
"Saya ingin pesantren yang ada tahfidznya."
"Saya ingin pesantren yang ada bahasa Inggrisnya."
"Saya ingin pesantren yang punya fasilitas olahraga."
"Saya ingin belajar komputer."
"Saya ingin pesantren yang lingkungannya seperti yang saya lihat di video."

Hal ini membuat pesantren perlu memahami bahwa komunikasi kepada calon santri tidak bisa selalu menggunakan sudut pandang orang dewasa.
Pesantren juga harus mampu berbicara dengan bahasa generasi anak-anak dan remaja.
Bukan berarti pesantren harus mengikuti semua keinginan anak.
Tetapi pesantren perlu memahami apa yang mereka lihat, apa yang mereka cari, dan apa yang membuat mereka tertarik terhadap sebuah lembaga pendidikan.


**Migrasi ke Lembaga dengan Sistem Baru**

Munculnya banyak lembaga pendidikan baru membuat masyarakat memiliki pilihan yang semakin beragam.
Hari ini kita mengenal berbagai model pendidikan:
pesantren tradisional,
pesantren modern,
pesantren tahfidz,
Islamic boarding school,
sekolah Islam terpadu,
pesantren berbasis teknologi,
pesantren dengan program entrepreneurship,
dan berbagai model pendidikan lainnya.

Masyarakat kemudian melakukan perbandingan.
Bukan berarti pesantren lama kehilangan nilai. Namun lembaga baru sering kali hadir dengan menawarkan sistem, program, atau pengalaman pendidikan yang berbeda.

Inilah yang perlu dibaca oleh pesantren. Ketika calon santri berpindah pilihan, jangan buru-buru menyimpulkan bahwa masyarakat sudah tidak membutuhkan pesantren. Bisa jadi yang berubah adalah kebutuhan masyarakat dan cara mereka memilih.


**Pesantren Lama dan Pesantren Rintisan**

Dalam workshop tersebut juga muncul gagasan mengenai perbedaan antara pesantren warisan dan pesantren rintisan.
Pesantren warisan memiliki kekuatan besar:
sejarah, tradisi, nama besar, jaringan alumni, pengalaman panjang, dan nilai-nilai yang telah diwariskan dari generasi sebelumnya.

Namun ada satu tantangan:
jangan sampai sejarah menjadi alasan untuk berhenti berubah.
Sementara pesantren rintisan biasanya memiliki dorongan yang berbeda.
Karena harus membangun dari awal, mereka dituntut untuk bertanya:
"Apa yang harus kami tawarkan?"
"Bagaimana kami mendapatkan kepercayaan masyarakat?"
"Program apa yang dibutuhkan?"
"Bagaimana fasilitasnya?"
"Bagaimana kami memperkenalkan pesantren?"
"Bagaimana kami membangun sistem?"

Mental seperti inilah yang sebenarnya juga dibutuhkan oleh pesantren yang sudah lama berdiri.
Pesantren lama perlu memiliki mental pesantren rintisan.
Bukan meninggalkan warisan.
Tetapi menghidupkan kembali semangat merintis.


**Beradaptasi Tidak Berarti Meninggalkan Tradisi**

Ketika berbicara tentang perubahan, ada kekhawatiran bahwa pesantren akan kehilangan identitasnya.
Padahal adaptasi tidak selalu berarti meninggalkan tradisi.
Pesantren tetap dapat mempertahankan:
Al-Qur''an, kitab kuning, adab, akhlak, ilmu agama, hubungan guru dan santri, tradisi keilmuan, serta nilai-nilai kepesantrenan.
Yang berubah adalah cara mengelola dan menyampaikannya.

Dulu informasi penerimaan santri mungkin hanya melalui pengumuman dan brosur.
Sekarang dapat diperkuat dengan website, media sosial, video, sistem pendaftaran digital, dan komunikasi WhatsApp.
Dulu dokumentasi kegiatan hanya tersimpan dalam album.
Sekarang dapat menjadi arsip digital dan media untuk memperkenalkan kehidupan pesantren kepada masyarakat.
Ruhnya tetap. Caranya yang berkembang.


**Ilmu untuk Dunia dan Akhirat**

Ada pula pesan penting tentang bagaimana pendidikan seharusnya dipahami.
Ungkapan yang sangat dikenal:

مَنْ أَرَادَ الدُّنْيَا فَعَلَيْهِ بِالْعِلْمِ، وَمَنْ أَرَادَ الْآخِرَةَ فَعَلَيْهِ بِالْعِلْمِ، وَمَنْ أَرَادَهُمَا فَعَلَيْهِ بِالْعِلْمِ

Secara sederhana dapat dipahami bahwa ilmu menjadi jalan untuk meraih kebaikan dunia maupun akhirat.
Dalam konteks pesantren hari ini, pendidikan agama tidak harus dipertentangkan dengan kemampuan menghadapi kehidupan modern.
Santri dapat dibekali:
Al-Qur''an + akhlak + ilmu agama + pendidikan formal + bahasa + teknologi + kepemimpinan + keterampilan hidup.
Tujuannya bukan menjadikan pesantren kehilangan identitas.
Sebaliknya, santri diharapkan memiliki bekal yang cukup untuk membawa nilai-nilai pesantren ke tengah masyarakat yang terus berubah.


**Jangan Menunggu Krisis untuk Berubah**

Salah satu pelajaran penting dari pembahasan tersebut adalah bahwa perubahan sebaiknya dilakukan sebelum keadaan memaksa kita untuk berubah.
Ketika jumlah santri masih stabil, bukan berarti semuanya sudah aman.
Justru saat itulah pesantren mempunyai kesempatan untuk melakukan evaluasi:
Apa yang sudah baik?
Apa yang mulai tidak relevan?
Apa yang perlu diperbaiki?
Apa yang dibutuhkan santri?
Apa yang dicari wali santri?
Apa yang belum kita miliki?
Bagaimana kualitas pelayanan kita?
Bagaimana sistem pendidikan kita?
Bagaimana pesantren kita dikenal masyarakat?

Perubahan yang dilakukan ketika kondisi masih sehat akan jauh lebih mudah dibandingkan perubahan yang dilakukan ketika masalah sudah besar.


**Pesantren Rintisan Harus Memiliki Visi Besar**

Pada akhirnya, pesantren tidak cukup hanya mempunyai target jumlah santri.
Visi pesantren harus lebih besar daripada sekadar:
*"Tahun ini mendapatkan santri baru lebih banyak."*
Pertanyaan yang jauh lebih penting adalah:
*"Sepuluh atau dua puluh tahun ke depan, santri seperti apa yang ingin kita lahirkan?"*
Dari pertanyaan tersebut kemudian lahir berbagai keputusan:
kurikulum seperti apa,
program apa yang dikembangkan,
SDM seperti apa yang dibutuhkan,
fasilitas apa yang dibangun,
teknologi apa yang digunakan,
bagaimana komunikasi kepada masyarakat,
dan bagaimana pesantren membangun kemandirian.
Visi bukan sekadar tulisan yang dipasang di dinding. Visi harus menjadi kompas dalam mengambil keputusan.


**Mempertahankan Ruh, Memperbarui Cara**

Dari keseluruhan gagasan yang disampaikan dalam workshop, ada satu kalimat yang mungkin dapat menjadi refleksi bersama:
*"Pesantren tidak harus menjadi baru untuk bisa berkembang. Tetapi pesantren harus berani memperbarui cara agar nilai-nilai yang diwariskan tetap relevan bagi generasi berikutnya."*
Pesantren memiliki sesuatu yang tidak selalu dimiliki oleh lembaga pendidikan lain: tradisi, sanad keilmuan, keteladanan guru, kehidupan bersama, dan pendidikan karakter.
Namun semua itu perlu dikelola dengan cara yang mampu menjawab zaman.
Karena generasi berubah.
Kebutuhan berubah.
Teknologi berubah.
Cara masyarakat mencari informasi berubah.
Cara anak memilih pendidikan berubah.
Maka pesantren pun harus terus belajar.
Bukan untuk mengejar zaman.
Tetapi agar nilai-nilai pesantren tetap mampu hidup dan memberi manfaat di setiap zaman.

Dan mungkin, di situlah tantangan terbesar pesantren hari ini:
*Bukan memilih antara tradisi atau perubahan, tetapi menemukan cara agar tradisi tetap hidup melalui perubahan.*',
  now(),
  118,
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'Roudlotul Mubarokah Bersholawat Jadi Penutup Haflah Khotmil Qur’an ke-22',
  'roudlotul-mubarokah-bersholawat-jadi-penutup-haflah-khotmil-quran-ke-22-fnnr',
  'Kegiatan',
  'Khodim Ma''had',
  'https://lh3.googleusercontent.com/d/1xBAQIvLErNI-JokWuTM2JXXGmo_FiaOW',
  'Roudlotul Mubarokah Bersholawat diikuti ribuan jamaah dan menjadi penutup Haflah Khotmil Qur’an ke-22 di Karangawen, Demak.',
  'DEMAK — Rangkaian Haflah Khotmil Qur’an ke-22 Pondok Pesantren Roudlotul Mubarokah, Rimbukidul, Karangawen, Demak, ditutup dengan kegiatan Roudlotul Mubarokah Bersholawat, Minggu (28/9/2025) malam.

Kegiatan yang berlangsung mulai pukul 20.00 hingga sekitar 24.00 WIB tersebut menjadi ungkapan syukur atas terselenggaranya Haflah Khotmil Qur’an ke-22 yang digelar pada pagi hingga siang hari.

Ribuan jamaah hadir memenuhi halaman Pondok Pesantren Roudlotul Mubarokah. Mereka berasal dari berbagai kalangan, mulai dari santri, wali santri, alumni, masyarakat sekitar hingga jamaah dari luar Demak, termasuk dari Semarang.

Rangkaian kegiatan menghadirkan Hadroh Majelis ASHABUL KAHFI Demak bersama Gus Nizar Ali dari Semarang dan Gus Jihan Fikar dari Grobogan. Sementara tausiyah disampaikan oleh KH. Agus Sulthon dari Jakarta.

Kegiatan diawali dengan pembukaan dan penampilan Majelis Ashabul Kahfi. Hadroh tersebut bahkan telah mengiringi rangkaian kegiatan sejak sebelum acara dimulai hingga menjelang akhir acara.

Setelah pembukaan, jamaah mengikuti tahlil yang dipimpin K. Tasliman, AH., tokoh setempat. Acara kemudian dilanjutkan dengan sambutan dari KH. Ulin Nuha, AH.

Rangkaian shalawat bersama kemudian kembali dilanjutkan. Majelis Ashabul Kahfi menghidupkan suasana malam dengan lantunan shalawat yang diikuti jamaah.

Dalam tausiyahnya, KH. Agus Sulthon mengajak jamaah menjadikan momentum Khotmil Qur’an sebagai ungkapan syukur kepada Allah SWT. Ia juga mengingatkan pentingnya menjaga Al-Qur’an setelah seseorang menyelesaikan khataman, menumbuhkan kecintaan kepada Rasulullah ﷺ, serta menjaga persatuan dan silaturahmi.

Pesan tersebut menjadi relevan dengan rangkaian kegiatan yang mempertemukan keluarga besar pesantren dengan masyarakat dalam suasana shalawat dan kebersamaan.


Ribuan Jamaah dan Lautan Cahaya

Salah satu momen khusus muncul ketika rangkaian shalawat memasuki suasana yang lebih tenang, termasuk saat lagu bernuansa mellow dibawakan.

Di tengah suasana tersebut, perhatian jamaah tertuju pada cahaya dari telepon genggam yang mereka nyalakan. Ketika lampu utama dipadamkan, cahaya flash dari ponsel jamaah tampak memenuhi area kegiatan.

Pemandangan tersebut menjadi salah satu visual yang kuat dalam Roudlotul Mubarokah Bersholawat. Ribuan jamaah yang berkumpul di halaman pesantren tampak menjadi bagian dari satu suasana bersama melalui lantunan shalawat dan cahaya ponsel mereka.

Setelah tausiyah, kegiatan berlanjut menuju Mahallul Qiyam. Jamaah mengikuti rangkaian tersebut bersama-sama hingga kegiatan berakhir sekitar pukul 24.00 WIB.

Bagi Pondok Pesantren Roudlotul Mubarokah, Roudlotul Mubarokah Bersholawat menjadi penutup rangkaian Haflah Khotmil Qur’an ke-22. Jika pada pagi hari halaman pesantren menjadi tempat berlangsungnya prosesi Khotmil Qur’an, malam harinya tempat yang sama kembali dipenuhi jamaah dalam rangkaian shalawat.

Dua kegiatan tersebut menjadi bagian dari satu momentum besar: syukur atas Khotmil Qur’an sekaligus mempererat kebersamaan keluarga besar pesantren dengan masyarakat.',
  now(),
  219,
  true
),
(
  'baa9eb9b-2d87-4648-a674-059bb289cb63',
  'Khatam 30 Juz Bukan Akhir, Pesan Haflah Khotmil Qur’an ke-22 Roudlotul Mubarokah',
  'khatam-30-juz-bukan-akhir-pesan-haflah-khotmil-quran-ke-22-roudlotul-mubarokah-dk9t',
  'Kegiatan',
  'Khodim Ma''had',
  'https://lh3.googleusercontent.com/d/1x-JDEjhH8ITpUwzOYruLyRZ1Uh4FpfCG',
  'Haflah Khotmil Qur’an ke-22 Pondok Pesantren Roudlotul Mubarokah menjadi momentum syukur atas pencapaian 35 peserta sekaligus pengingat bahwa khatam 30 juz bukan akhir perjalanan bersama Al-Qur’an.',
  'DEMAK — Menyelesaikan hafalan 30 juz Al-Qur''an bukanlah akhir perjalanan seorang penghafal. Dalam Haflah Khotmil Qur''an ke-22 Pondok Pesantren Roudlotul Mubarokah, khatam ditekankan sebagai awal tanggung jawab untuk menjaga hafalan, memahami kandungan Al-Qur''an, dan mengamalkan nilai-nilainya dalam kehidupan.

Pesan tersebut mengemuka dalam Haflah Khotmil Qur''an ke-22 Pondok Pesantren Roudlotul Mubarokah, Rimbukidul, Karangawen, Demak, Minggu (28/9/2025). Mengusung tema “Menuju Generasi Qur''ani penuh berkah, mulia dan membawa kedamaian bagi umat”, kegiatan ini diikuti 35 peserta, terdiri atas 10 peserta Bil Hifdhi, 14 peserta Bin Nadhor, dan 11 peserta Juz Amma.

Prosesi khotmil menjadi momentum syukur sekaligus penghargaan atas perjuangan para santri dalam menempuh proses belajar Al-Qur''an. Bagi pesantren, kegiatan tersebut juga menjadi bagian dari upaya meneguhkan pendidikan Al-Qur''an dan membentuk generasi yang tidak hanya dekat dengan hafalan, tetapi juga dengan nilai dan akhlaknya.

Dalam tausiyahnya, KH. Muhammad Mahfudz Harir, Pengasuh PP BUQ Betengan Demak, menegaskan bahwa khatam 30 juz merupakan awal dari tanggung jawab yang lebih panjang.

“Khatam 30 juz bukanlah akhir dari perjalanan bersama Al-Qur’an, tetapi awal dari tanggung jawab untuk menjaganya.”

Ia berpesan agar hafalan Al-Qur''an menjadi cahaya dalam hati, pedoman kehidupan, dan amal yang terus diamalkan. Para penghafal Al-Qur''an, lanjutnya, tidak cukup hanya mengingat ayat-ayatnya, tetapi juga perlu menghidupkan akhlak dan nilai yang diajarkan Al-Qur''an.

Pesan tersebut sejalan dengan yang disampaikan Nyai Hj. Nashichatul Fuadah, AH., Pengasuh Pondok Pesantren Roudlotul Mubarokah. Ia menekankan bahwa menjadi penghafal Al-Qur''an tidak berhenti pada kemampuan mengingat 30 juz.

“Menjadi penghafal Al-Qur’an bukan sekadar mampu mengingat 30 juz, tetapi mampu menjaga, memahami, mengamalkan, dan menjadikan Al-Qur’an sebagai pedoman hidup.”

Ia berharap para santri tetap istiqamah menjaga hafalan dan melakukan murajaah setelah khatam. Para santri juga diharapkan terus belajar, rendah hati, serta mampu menjadi teladan bagi keluarga, pesantren, masyarakat, dan umat.

“Semoga 30 juz yang telah dihafalkan tidak hanya tersimpan dalam ingatan, tetapi hidup dalam hati, tercermin dalam akhlak, dan menjadi bekal hingga akhir hayat.”

Khotmil Qur''an sebagai Ruang Kebersamaan

Haflah Khotmil Qur''an ke-22 tidak hanya menjadi momentum pencapaian para peserta. Sekitar 500 orang hadir, terdiri atas santri, alumni, pengasuh, ustadz dan ustadzah, wali santri, tokoh masyarakat, pemerintah desa, tokoh agama, organisasi dan lembaga, serta masyarakat umum.

Kehadiran keluarga besar pesantren membuat haflah berlangsung dalam suasana khidmat, penuh syukur, dan kebersamaan. Keluarga, pengasuh, para guru, alumni, dan masyarakat hadir memberikan dukungan serta doa bagi para peserta.

Bagi alumni, momentum tersebut juga menjadi pengingat bahwa pencapaian para peserta lahir dari proses panjang. Salah seorang alumni mengenang masa ketika mengulang hafalan terasa berat, tetapi proses tersebut justru menjadi bagian yang membentuk diri seorang santri.

“Menjadi santri di Roudlotul Mubarokah mengajarkan kami bahwa setiap ayat yang dihafal membutuhkan kesabaran dan keistiqamahan.”

Melihat para peserta Khotmil Qur''an, ia kembali teringat pada perjuangan dan kebersamaan selama menjadi santri. Ia berharap hafalan yang telah diselesaikan tidak berhenti sebagai pencapaian, tetapi menjadi cahaya dan pedoman dalam kehidupan.

“Teruslah menjaga Al-Qur’an, karena sejatinya setelah khatam, perjalanan bersama Al-Qur’an justru baru dimulai.”

Kegiatan tahun ini diikuti 35 peserta, bertambah lima orang dibandingkan penyelenggaraan sebelumnya yang diikuti 30 peserta. Peserta memperoleh penghargaan sesuai kategori pencapaiannya. Peserta Bil Hifdhi 30 juz memperoleh Syahadah dan Sanad, sedangkan peserta Bil Hifdhi 15 juz serta Bin Nadhor 30 juz memperoleh Syahadah.

Rangkaian haflah berlangsung pukul 07.00–11.00 WIB, diawali pembukaan dan dilanjutkan prosesi Khotmil Qur''an, tahlil, doa Khotmil Qur''an, sambutan, tilawatil Qur''an, tausiyah, hingga doa penutup.

Tilawatil Qur''an diisi oleh Ust. H. Mas''ud Sahat, M.Pd., qari internasional dari Kudus yang pernah mengikuti kompetisi MTQ internasional di Malaysia. Sementara tausiyah disampaikan KH. Muhammad Mahfudz Harir.

Haflah Khotmil Qur''an ke-22 menjadi bagian dari perjalanan tradisi Al-Qur''an di Pondok Pesantren Roudlotul Mubarokah yang berdiri sejak 1983. Menurut keterangan pesantren, tradisi Khotmil Qur''an pada awalnya diselenggarakan setiap tahun dan dalam beberapa tahun terakhir dilaksanakan dua tahun sekali. Penyelenggaraan yang terdokumentasi saat ini tercatat sebagai Haflah Khotmil Qur''an ke-22.

Bagi keluarga besar Pondok Pesantren Roudlotul Mubarokah, khatam menjadi penanda selesainya satu tahap sekaligus awal perjalanan baru bersama Al-Qur''an. Hafalan yang telah diselesaikan diharapkan terus dijaga, dipahami, dan diwujudkan dalam akhlak serta kehidupan sehari-hari.',
  now(),
  331,
  true
)
ON CONFLICT (tenant_id, slug) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  author = EXCLUDED.author,
  cover_image = EXCLUDED.cover_image,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  views_count = EXCLUDED.views_count,
  updated_at = now();
