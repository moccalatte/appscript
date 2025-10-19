# JobSeer GAS - Fitur Cerdas & Peta Jalan Produk

---

## 🎯 Visi: Asisten Lamaran Kerja untuk Developer Profesional Malas

**Tujuan**: Membangun sistem lamaran kerja yang paling cerdas, paling profesional, paling sulit terdeteksi sebagai AI, dan paling efisien. Tanpa pekerjaan manual, profesionalisme maksimal, nol tanda merah.

---

## 🧠 TIER 1: DETEKSI ANTI-AI & PROFESIONALISME (KRITIS)

Menjaga HR agar tidak mendeteksi otomatisasi dan mempertahankan standar profesional.

### 1. Natural Language Humanizer (Surat Lamaran Mirip Manusia)
**Masalah**: Surat lamaran hasil AI terdengar generik, kaku, repetitif
**Solusi**:
- Variasikan struktur kalimat, nada, kosakata setiap lamaran
- Tambahkan mikro-personalisasi: sebutkan proyek/fitur spesifik dari situs perusahaan
- Sisipkan ketidakpastian realistis (kadang nada "Saya kurang yakin...")
- Campurkan suara aktif/pasif secara natural
- Masukkan unsur emosional: ketertarikan tulus pada domain masalah
- Acak waktu pengiriman email agar terlihat wajar
- Gunakan template berbeda tiap lamaran, jangan pernah sama

**Implementasi**:
- Buat 5-10 template dasar dengan persona berbeda
- Rotasi: Formal Profesional, Kasual-Profesional, Antusias Teknis, Problem-Solver, Fokus Dampak
- AI mengacak variasi di dalam template
- Opsi review manusia sebelum kirim
- Uji A/B: Lacak rasio respons per tipe template

**Prioritas**: 🔴 TINGGI (HR langsung mengenali AI)

---

### 2. Deteksi Anti-Copy-Paste (Nilai Unik per Pekerjaan)
**Masalah**: Surat lamaran sama untuk 100 lowongan terlihat mencurigakan, HR paham
**Solusi**:
- Ekstrak aspek unik dari setiap iklan kerja
- Identifikasi pain point: "Anda butuh seseorang yang...", "Tantangan: ...", "Kami mencari..."
- Personalisasi paragraf yang menyebutkan: Nama perusahaan, Produk, Masalah yang diselesaikan, Berita terbaru
- Mode riset: Ambil info perusahaan dari API publik
- Kesesuaian skill: Cocokkan skill pengguna dengan kebutuhan lowongan, bukan daftar generik

**Implementasi**:
- Parsing iklan kerja untuk kata kunci: "Python", "React", "3+ years"
- Ambil dari situs perusahaan atau API Crunchbase
- Kaitkan pengalaman CV pengguna dengan kebutuhan lowongan
- Hasilkan pembuka unik: "Produk Anda menyelesaikan X dengan Y, dan saya membangun sistem serupa menggunakan Z"
- Jangan pernah pakai frasa yang sama dua kali di semua lamaran

**Prioritas**: 🔴 TINGGI (Rekruter lihat copy-paste = langsung gugur)

---

### 3. Optimizer Subjek Email Profesional
**Masalah**: Subjek generik diabaikan, subjek terdengar AI masuk spam
**Solusi**:
- Deteksi otomatis peran + level senioritas dari deskripsi kerja
- Hasilkan 3-5 opsi subjek profesional
- Hindari frasa pasaran: "Excited to apply", "Application for"
- Sertakan nilai spesifik: "Senior React Dev [Nama Perusahaan] - 5 tahun, track record terbukti"
- Referensikan koneksi bersama jika ada
- Subjek peka waktu: Selaraskan dengan kata kunci lowongan

**Contoh**:
- ❌ Buruk: "Application for Software Engineer"
- ❌ Buruk: "Interested in your company"
- ✅ Bagus: "Full Stack Developer | 5+ tahun bangun sistem skala besar | Tertarik dengan role Anda"
- ✅ Bagus: "React Specialist - Bangun UI performa tinggi (Stack Perusahaan Anda)"

**Implementasi**:
- Analisis deskripsi kerja untuk 3 kata kunci teratas
- Ekstrak kebutuhan tahun pengalaman
- Sorot SATU skill paling relevan
- Template: `[Peran] | [Skill Kunci] | [Tahun] pengalaman | [Pernyataan Nilai Halus]`
- Persetujuan manual sebelum kirim

**Prioritas**: 🔴 TINGGI (Subjek = kesan pertama)

---

### 4. Analisis & Penyesuaian Nada Email
**Masalah**: Terlalu formal terdengar robot korporat, terlalu santai tidak profesional
**Solusi**:
- Analisis tipe perusahaan: Startup vs Enterprise vs Pemerintah
- Ekstrak gaya komunikasi perusahaan dari situs/LinkedIn
- Sesuaikan nada surat lamaran: Formal, Semi-formal, Kasual-profesional, Teknis
- Periksa: Kelayakan emoji, kontraksi, level formalitas
- Hindari: Tanda seru berlebihan (ciri AI), frasa robotik, buzzword basi
- Imperfeksi ala manusia: "Saya sudah 5 tahun mengerjakan..." bukan "I possess 5 years of..."

**Implementasi**:
- Klasifikasi perusahaan: cek Crunchbase/LinkedIn
- Skoring nada: rasio formalitas, sentimen, kompleksitas
- Penyesuaian: Ganti "am passionate about" dengan pencapaian spesifik
- Tambahkan sentuhan manusiawi - "Saya menemukan produk Anda ketika..."

**Prioritas**: 🟠 MENENGAH-TINGGI

---

## 🛡️ TIER 2: PENCEGAHAN SPAM & DUPLIKAT (KRITIS)

Mencegah blacklist dan menjaga reputasi pengirim.

### 5. Intelligent Rate Limiting dengan Pembelajaran
**Masalah**: Kirim 100 email/hari dari Gmail yang sama = tanda merah spam
**Solusi**:
- Pembatasan pintar: Belajar dari open rate email
- Pemantauan reputasi Gmail: Pantau bounce rate, laporan spam
- Pengacakan waktu kirim: Tidak selalu jam 09.00, kadang 22:34
- Sebar lamaran: Maks 5/hari per domain, maks 3 berturut-turut ke perusahaan sama
- Periode cool-down: Jika open rate turun, auto-pause 24 jam
- Lacak metrik reputasi pengirim

**Implementasi**:
- Pengacakan waktu: ±2 jam dari preferensi pengguna
- Sistem antrean: Sebar kirim sepanjang hari/minggu
- Pantau `sent_emails` untuk `bounce_rate` per domain
- Jeda jika `open_rate` < 15% (indikasi spam)
- Rotasi akun Gmail berbeda (masa depan)

**Prioritas**: 🔴 TINGGI (Masuk blacklist = percuma)

---

### 6. Domain/HR Email Intelligence
**Masalah**: HR yang sama bisa kewalahan, harus diatur
**Solusi**:
- Lacak tingkat balasan email HR: Siapa yang responsif, siapa yang tidak
- Hindari: Lamar ke HR sama berkali-kali dalam waktu dekat
- Pintar: Jika HR yang sama sudah punya 2 aplikasi terbuka, tunggu 14 hari
- Peringatan: "Email HR ini pasif, balasan terakhir 2 tahun lalu - pertimbangkan ulang"
- Tandai: HR dengan respons tinggi vs lubang hitam

**Implementasi**:
- Tambahkan kolom di `sent_emails`: `hr_reply_rate`, `last_reply_date`
- Hitung: (email dibalas / email dikirim) per HR
- Peringatan: "Tingkat balasan domain ini hanya 5%"
- Saran: "Coba email HR lain di perusahaan ini"
- Prioritaskan: HR dengan respons tinggi

**Prioritas**: 🔴 TINGGI

---

### 7. Deteksi Duplikat Cerdas
**Masalah**: Sudah ada solusi, tapi bisa lebih pintar
**Solusi**: Implementasi sekarang bagus, tingkatkan dengan:
- Deteksi lowongan serupa: "Python Developer" vs "Python Software Engineer" = sama
- Cek rentang gaji: Jika sudah melamar role $80-100k, beri peringatan untuk $75-95k
- Deteksi variasi nama perusahaan: "Microsoft Inc" vs "Microsoft" vs "MSFT"
- Kemiripan lokasi: Downtown vs Downtown Business District
- Peringatan: "Lowongan ini mirip dengan XYZ yang Anda lamar 3 hari lalu"

**Implementasi**:
- Pencocokan fuzzy untuk nama perusahaan
- Normalisasi: Hilangkan "Inc.", "Corp", "Ltd"
- Standardisasi lokasi via geocoding
- Hitung overlap rentang gaji
- Konfirmasi pengguna sebelum menandai sebagai duplikat

**Prioritas**: 🟠 MENENGAH

---

## ✍️ TIER 3: KUALITAS & KUSTOMISASI (TINGGI)

Memastikan lamaran lebih cocok dengan pengguna, tidak generik.

### 8. Intelligence Ekstraksi & Pencocokan Skill
**Masalah**: CV punya 50 skill, lowongan butuh 5 - tidak selaras
**Solusi**:
- Parsing CV untuk semua skill
- Parsing lowongan untuk skill wajib
- Sorot HANYA skill relevan di surat
- Susun skill: Wajib + dimiliki, Opsional + dimiliki, Opsional + belum dimiliki
- Sebut proyek spesifik yang memakai skill tersebut
- Tampilkan gap skill: "Saya punya 4/5 skill wajib, sedang mempelajari X"

**Implementasi**:
- Ekstrak skill dari CV PDF (sudah ada)
- Bandingkan dengan kata kunci kebutuhan lowongan
- Buat matriks skill: skor kecocokan per kebutuhan
- Template: "Sangat kuat di {top_3_matches}, sedang mengasah {gap_area}"
- Sertakan bukti: "Membangun X pakai Y, menghasilkan peningkatan Z"

**Prioritas**: 🟠 MENENGAH-TINGGI

---

### 9. Auto-Insert Riset Perusahaan
**Masalah**: Surat generik tidak menyebut spesifik perusahaan
**Solusi**:
- Ambil otomatis info perusahaan: Berita terbaru, produk, pendanaan, pimpinan
- Sebutkan spesifik: "Saya lihat Anda meluncurkan [Produk] bulan lalu dengan [Teknologi]"
- Referensi: Misi/nilai jika ada
- Tunjukkan pengetahuan domain: "Tantangan Anda di [masalah spesifik]"
- Hindari: Info terlalu umum (semua orang tahu Google besar)

**Implementasi**:
- Pakai API Crunchbase/Wikipedia untuk data perusahaan
- Parsing: Pengumuman terbaru, pendanaan, pergantian pimpinan
- Sisipkan ke template: "Saya tertarik bagaimana Anda menyelesaikan {problem}"
- Cache hasil agar tidak panggil API berulang
- Fallback: Teks generik jika data kosong

**Prioritas**: 🟠 MENENGAH

---

### 10. Mapper Pengalaman ke Pencapaian
**Masalah**: Sekadar daftar pengalaman tidak menunjukkan dampak
**Solusi**:
- Ekstrak pengalaman pengguna dari CV/profil
- Analisis kebutuhan lowongan
- Cari area yang tumpang-tindih
- Hasilkan pernyataan pencapaian:
  - Dari: "Worked with Python"
  - Menjadi: "Mengembangkan microservices Python yang menangani 100k request/hari"
- Kuantifikasi bila memungkinkan: angka, persentase, dampak
- Cocokkan pencapaian dengan pain point pekerjaan

**Implementasi**:
- Parsing CV untuk peran dan deskripsi masa lalu
- Kaitkan skill dengan pencapaian konkret
- Jika tanpa angka, sarankan "Meningkatkan X sebesar %", "Mengurangi Y sebesar %", "Menangani skala Z"
- Buat perpustakaan pencapaian dari CV pengguna
- Putar pencapaian berbeda tiap lamaran

**Prioritas**: 🟠 MENENGAH

---

## 🎯 TIER 4: ANTI-BUG & PENCEGAHAN ERROR (TINGGI)

Tangkap kesalahan sebelum sampai HR.

### 11. Pemeriksa Typo & Tata Bahasa Tingkat Manusia
**Masalah**: HR melihat typo → langsung tolak
**Solusi**:
- Cek tata bahasa/ejaan sebelum kirim
- Konteks-aware: "Your" vs "You're", "Their" vs "There"
- Cek nada profesional: Hindari slang/bahasa santai
- Cek konsistensi: Penulisan nama perusahaan sama
- Detektor AI: Tandai kalimat terlalu sempurna

**Implementasi**:
- Gunakan LanguageTool atau API serupa
- Aturan kustom: Konsistensi jabatan, nama perusahaan
- Review manual sebelum kirim final
- Blokir pengiriman jika: >1 kesalahan
- Sorot: Frasa berisiko terdengar AI

**Prioritas**: 🔴 TINGGI

---

### 12. Sistem Pratinjau & Persetujuan Email
**Masalah**: Pengguna mengirim tanpa review → kesalahan terkirim
**Solusi**:
- Hasilkan email lengkap (subjek + body + lampiran)
- Tampilkan pratinjau 5 detik sebelum kirim
- Sorot: Subjek, paragraf pertama, ajakan bertindak
- Tampilkan: Ukuran/nama lampiran CV
- Opsi: Edit sebelum kirim, atau simpan draft otomatis
- Pelacakan A/B: Perbandingan efektivitas email vs template

**Implementasi**:
- Modal/popup menampilkan email final
- Countdown 5 detik (bisa dilewati)
- Tombol edit sekali klik untuk kembali
- Simpan sebagai draft bila ragu
- Lacak: % pratinjau yang dibatalkan (indikator kekhawatiran pengguna)

**Prioritas**: 🔴 TINGGI

---

### 13. Peringatan Ketidaksesuaian Gaji/Ekspektasi
**Masalah**: Melamar role gaji 50k padahal CV menunjukkan 150k+ = tanda merah
**Solusi**:
- Ekstrak gaji dari profil pengguna
- Ekstrak rentang gaji lowongan
- Peringatkan jika selisih > 30%
- Sarankan: Sesuaikan ekspektasi atau sebut fleksibilitas
- Lacak: Diterima vs ditolak pada level gaji berbeda

**Implementasi**:
- Parsing lowongan untuk gaji/kompensasi
- Bandingkan dengan gaji terakhir pengguna
- Peringatan: "Role ini membayar 40% lebih rendah dari perkiraan latar Anda"
- Opsi: Tambah kalimat fleksibilitas di surat
- Pelajari: Rentang gaji mana yang mengonversi ke wawancara

**Prioritas**: 🟠 MENENGAH

---

### 14. Deteksi Ketidaksesuaian Level Pengalaman
**Masalah**: Junior melamar senior, atau terlalu senior = sinyal negatif
**Solusi**:
- Ekstrak tahun pengalaman dari CV
- Ekstrak level/senioritas dari lowongan
- Peringatan jika mismatch: Role "Senior" tapi CV 2 tahun
- Saran: "Pertimbangkan role Mid-level" atau "Tekankan pengalaman kepemimpinan"
- Sesuaikan nada surat: under-shoot, pas, atau over-shoot

**Implementasi**:
- Ekstrak tahun dari CV (misal "5+ years")
- Parsing lowongan untuk kata kunci Junior, Mid, Senior, Principal, Lead
- Hitung skor kecocokan
- Sesuaikan nada: Rendah hati (kurang), Percaya diri (pas), Tonjolkan leadership (lebih)

**Prioritas**: 🟠 MENENGAH

---

## 📊 TIER 5: ANALITIK & OPTIMISASI (MENENGAH)

Lacak apa yang efektif, tingkatkan terus.

### 15. Analitik Performa Lamaran
**Masalah**: Tidak tahu apa yang bekerja
**Solusi**:
- Lacak: Tanggal kirim, Perusahaan, Role, Varian surat, Waktu respons
- Ukur: Response rate, interview rate, offer rate per template/tipologi perusahaan
- A/B testing: Tipe surat mana paling banyak respons?
- Analitik: Waktu terbaik mengirim, perusahaan paling potensial
- Dashboard: "48% interview rate untuk startup, 12% untuk enterprise"

**Implementasi**:
- Tambah di `sent_emails`: `response_received`, `response_date`, `response_type` (interview/reject/no-response)
- Hitung: Open rate (via tracking), response rate, interview rate
- Segmentasi: Berdasarkan template surat, ukuran perusahaan, level role
- Laporan: Statistik bulanan, saran perbaikan
- Ekspor: CSV untuk analisis lanjutan

**Prioritas**: 🟡 MENENGAH (Nice to have)

---

### 16. Sistem Smart Retry
**Masalah**: Tidak ada respons, tidak tahu alasannya
**Solusi**:
- Deteksi otomatis: Tidak ada respons setelah 7 hari
- Follow-up pintar: Sudut berbeda, surat baru, subjek baru
- Lacak: Tingkat keberhasilan retry
- Pola: Jika 70% no-response, ubah strategi
- Saran: "Surat Anda mungkin terlalu formal, coba nada kasual"

**Implementasi**:
- Jadwalkan: Auto-follow-up 7 hari jika belum ada balasan
- Gunakan template berbeda untuk follow-up
- Lacak konversi retry
- Pelajari: Strategi follow-up yang paling berhasil
- Peringatkan pengguna: Sarankan perubahan strategi jika respons rendah

**Prioritas**: 🟡 MENENGAH

---

## 🔒 TIER 6: KEAMANAN & PRIVASI (KRITIS)

Lindungi data dan privasi pengguna.

### 17. Privacy Mode (Jangan Lacak Saya)
**Masalah**: Pengguna khawatir soal tracking/analitik
**Solusi**:
- Toggle privasi: Nonaktifkan semua tracking/analitik
- Mode anonim: Tanpa logging IP, tanpa identifikasi
- Pemrosesan lokal: Jangan simpan info sensitif di log
- Retensi data: Auto-hapus email terkirim setelah 30 hari
- Kepatuhan GDPR: Hak hapus semua data

**Implementasi**:
- Pengaturan privasi di tab profil
- Tandai di log: `privacy_mode: true`
- Lewati analitik jika aktif
- Enkripsi data sensitif
- Auto-hapus catatan lama

**Prioritas**: 🟠 MENENGAH (Kepatuhan)

---

### 18. Keamanan Sesi & Two-Factor
**Masalah**: Akun email dibobol = email berbahaya terkirim
**Solusi**:
- Tambah 2FA untuk aksi sensitif (bulk send)
- Timeout sesi: Auto-logout setelah 1 jam idle
- Deteksi aktivitas aneh: Bulk send jam 3 pagi dari negara lain
- Notifikasi: "Login baru dari Tokyo, setujui?"

**Implementasi**:
- Integrasi TOTP atau SMS 2FA
- Pelacak kedaluwarsa sesi
- Logging IP/lokasi untuk login
- Email alert saat device baru login
- Wajib re-auth untuk operasi massal

**Prioritas**: 🟠 MENENGAH

---

## 🚀 TIER 7: KENYAMANAN & POWER FEATURES (MENENGAH)

Bikin semakin malas tapi produktif.

### 19. Ekstensi Browser One-Click Apply
**Masalah**: Upload manual/salin-tempel = friksi
**Solusi**:
- Ekstensi browser: Lihat lowongan → klik kanan "Apply with JobSeer"
- Auto-capture: Teks/screenshot lowongan
- Kirim ke aplikasi JobSeer
- Auto-fill: Role, Perusahaan, Email jika bisa
- One-click apply langsung dari LinkedIn/Indeed

**Implementasi**:
- Ekstensi Chrome/Firefox
- Content script: Ekstrak iklan kerja
- Message passing: Kirim ke backend GAS
- Auto-populate form
- Lacak: Tingkat penggunaan ekstensi

**Prioritas**: 🟡 MENENGAH (Kenyamanan)

---

### 20. Aplikasi Mobile (PWA - Progressive Web App)
**Masalah**: Mengelola aplikasi hanya di desktop terbatas
**Solusi**:
- Konversi ke PWA
- Instal sebagai aplikasi di ponsel
- Dukungan offline: Antrikan lamaran ketika offline
- UI mobile optimal
- Push notification: "Interview diterima!" di ponsel

**Implementasi**:
- Tambah service worker untuk offline
- File manifest aplikasi
- Responsif mobile (sudah)
- Icon home screen
- Integrasi API notifikasi push

**Prioritas**: 🟡 MENENGAH (Nice to have)

---

### 21. Penjadwalan Pintar & Optimasi Waktu
**Masalah**: Kapan harus melamar? Jumat 09.00 aneh untuk startup
**Solusi**:
- Deteksi tipe perusahaan: Kapan startup/enterprise paling aktif
- Penjadwalan pintar: Waktu kirim optimal = HR paling mungkin baca
- Lacak: Rasio respons per hari/jam
- Auto-schedule: Kirim lamaran di waktu terbaik
- Pelajari: "Selasa 10.00 dapat 40% lebih banyak respons"

**Implementasi**:
- Simpan tanggal/jam kirim + respons
- Analisis: Rasio respons per hari
- Hitung: Waktu optimal per tipe perusahaan
- Integrasi Schedule API: Google Calendar
- Fitur: "Schedule send for best time"

**Prioritas**: 🟡 MENENGAH

---

### 22. Asisten Negosiasi Gaji
**Masalah**: Dapat offer tapi bingung minta berapa
**Solusi**:
- Lacak rentang gaji per role/perusahaan/lokasi
- Saran: "Rata-rata industri untuk role Anda di area ini: $X-Y"
- Hitung: Berdasarkan pengalaman, skill, lokasi
- Hasilkan template email negosiasi
- Lacak: Gaji diterima vs saran

**Implementasi**:
- Parsing offer letter untuk gaji
- Gunakan Levels.fyi atau Glassdoor API untuk benchmark
- Buat template counter-offer
- Lacak konversi: Tingkat sukses negosiasi
- Pelajari: Pola yang berhasil

**Prioritas**: 🟡 MENENGAH

---

## 🎯 TIER 8: INTEGRASI LANJUTAN (RENDAH-MENENGAH)

Terhubung dengan platform lain.

### 23. Integrasi LinkedIn
**Masalah**: Data LinkedIn belum dimanfaatkan
**Solusi**:
- Scraping LinkedIn: Auto-update profil
- Ekstrak: Pengalaman, Skill, Sertifikasi
- Cocokkan: Skill LinkedIn dengan kebutuhan role
- Jaringan: Identifikasi koneksi bersama
- Pesan: Draft otomatis pesan koneksi ke hiring manager

**Implementasi**:
- LinkedIn API (terbatas) atau scraping
- Parsing: Pengalaman, role saat ini, endorsement
- Gabungkan: Data LinkedIn dengan CV
- Identifikasi: Hiring manager di LinkedIn
- Template: Pesan custom ke hiring manager

**Prioritas**: 🟡 MENENGAH (Kompleks)

---

### 24. Integrasi Job Board
**Masalah**: Copy-paste manual dari banyak situs
**Solusi**:
- Integrasi API langsung dengan job board:
  - LinkedIn Jobs
  - Indeed
  - Glassdoor
  - AngelList (untuk startup)
- One-click apply: Tarik data job, kirim otomatis
- Mode batch: Ambil semua job dari hasil pencarian → apply semua

**Implementasi**:
- Integrasi API job board
- Parsing: Judul, perusahaan, deskripsi
- Auto-apply: Sistem yang sudah ada
- Dashboard: Lihat job dari semua sumber
- Lacak: Sumber vs konversi

**Prioritas**: 🟡 MENENGAH (Kompleks)

---

### 25. Integrasi CRM (untuk follow-up)
**Masalah**: Sulit melacak siapa yang harus di-follow up
**Solusi**:
- Integrasi dengan CRM: HubSpot, Pipedrive, Notion
- Sinkron: Semua lamaran masuk CRM
- Lacak: Status, catatan, tanggal follow-up
- Auto-buat: "Contact" di CRM untuk tiap HR
- Dashboard: Pipeline lamaran

**Implementasi**:
- Integrasi API CRM
- Sinkronisasi `sent_emails` ke kontak
- Buat deal: "Application sent"
- Update: Saat ada respons
- Timeline: Rekam semua interaksi

**Prioritas**: 🟡 MENENGAH

---

## 📈 TIER 9: INTELLIGENCE & ML (RENDAH)

Gunakan machine learning untuk keputusan lebih pintar.

### 26. Job Fit Score Predictor
**Masalah**: Melamar ke role yang kurang cocok
**Solusi**:
- Model ML: Skor kecocokan 0-100
- Input: CV + deskripsi job
- Output: "Role ini cocok 78% - peluang bagus"
- Belajar: Kecocokan mana yang berujung wawancara
- Saran: Lamar hanya pada skor >70 (peluang closing lebih tinggi)

**Implementasi**:
- Training model ML: Pakai data historis
- Fitur: Overlap skill, level pengalaman, lokasi, gaji
- Skor: Probabilitas interview/offer
- Ambang: Sarankan hanya skor >70
- Belajar: Retrain bulanan dengan data baru

**Prioritas**: 🟡 MENENGAH (Opsional)

---

### 27. Cover Letter Quality Scorer
**Masalah**: Ada surat lebih efektif dari yang lain
**Solusi**:
- Model ML: Skor kualitas surat 0-100
- Input: Teks surat lamaran
- Output: "Ini terlalu formal (response rate formal 20%)"
- Beri saran perbaikan
- Uji A/B: Versi ini vs versi lain

**Implementasi**:
- Skor berdasar: Personalisasi, spesifisitas, nada, panjang
- Bandingkan dengan template ber-respons tinggi
- Saran: "Tambahkan contoh lebih spesifik"
- Uji: Buat 2 versi, lacak response rate
- Pelajari: Faktor yang mendorong respons

**Prioritas**: 🟡 MENENGAH (Opsional)

---

## 🎨 TIER 10: PENINGKATAN UI/UX (MENENGAH)

Bikin lebih enak dipakai dan sedap dipandang.

### 28. Dashboard Lamaran (Real-time)
**Masalah**: Sulit melihat gambaran semua lamaran
**Solusi**:
- Dashboard real-time menampilkan:
  - Total lamaran terkirim
  - Jadwal interview
  - Offer diterima
  - Tren response rate
  - Prospek panas (berpeluang balas)
  - Lamaran dingin (tidak ada respons >14 hari)
- Filter: Status, tanggal, ukuran perusahaan, level role
- Ekspor: Laporan PDF untuk portofolio

**Implementasi**:
- Tambah tab dashboard
- Statistik real-time: Query sheet `sent_emails`
- Chart: Response rate seiring waktu
- Tabel: Semua lamaran beserta status
- Ekspor: Generator PDF

**Prioritas**: 🟠 MENENGAH-TINGGI

---

### 29. Kanban Board View
**Masalah**: Sulit memvisualisasikan pipeline lamaran
**Solusi**:
- Kanban board: Kolom = status lamaran
  - Applied → Interview Scheduled → Offer → Accepted
  - Rejected → Dead (no response >30 hari)
- Drag-drop: Pindahkan antar kolom
- Detail: Klik lamaran untuk riwayat lengkap
- Catatan: Tambah catatan pribadi/follow-up

**Implementasi**:
- UI: Library Kanban (mirip Trello)
- Data: Query `sent_emails` dikelompok per status
- Update: Perubahan status sinkron ke sheet
- Catatan: Tambah kolom catatan di `sent_emails`

**Prioritas**: 🟠 MENENGAH-TINGGI

---

## 🔐 PRIORITAS IMPLEMENTASI

### Fase 1 (Harus Ada - Segera)
- ✅ (sudah) Deteksi duplikat via email HR
- 🔴 #1 Natural Language Humanizer
- 🔴 #2 Deteksi Anti-Copy-Paste
- 🔴 #11 Pemeriksa Typo & Tata Bahasa
- 🔴 #12 Sistem Pratinjau & Persetujuan Email
- 🔴 #30 Preflight QA Checklist Engine
- 🔴 #31 Claim-to-CV Validation Bot

### Fase 2 (Seharusnya Ada - Sprint Berikutnya)
- 🔴 #3 Optimizer Subjek Email Profesional
- 🔴 #4 Analisis Nada Email
- 🔴 #5 Intelligent Rate Limiting
- 🔴 #6 Domain/HR Email Intelligence
- 🟠 #8 Intelligence Ekstraksi & Pencocokan Skill
- 🟠 #15 Analitik Performa Lamaran
- 🟠 #28 Dashboard Lamaran
- 🟠 #32 Personalization Memory & Variation Tracker

### Fase 3 (Nice-to-Have - Berikutnya)
- 🟠 #9 Auto-Insert Riset Perusahaan
- 🟠 #10 Mapper Pengalaman ke Pencapaian
- 🟠 #13 Peringatan Ketidaksesuaian Gaji/Ekspektasi
- 🟠 #16 Sistem Smart Retry
- 🟡 #19 Ekstensi Browser

### Fase 4 (Opsional - Masa Depan)
- 🟡 #14 Deteksi Ketidaksesuaian Level Pengalaman
- 🟡 #20 Mobile PWA App
- 🟡 #21 Penjadwalan Pintar
- 🟡 #22 Asisten Negosiasi Gaji
- 🟡 #23-27 Integrasi & ML Lanjutan

---

## 🧪 TIER 6: OTOMASI QA & KONSISTENSI (TINGGI)

### 30. Preflight QA Checklist Engine
**Masalah**: Kesalahan menit terakhir lolos (salah nama perusahaan, lampiran hilang, placeholder tertinggal)
**Solusi**:
- Bangun checklist dinamis per lamaran: nama perusahaan, judul role, lokasi, lampiran, ajakan bertindak
- Blokir pengiriman jika checklist gagal; tampilkan pesan solutif
- Pastikan subjek/body cocok dengan data job (role, perusahaan, nama rekruter)
- Deteksi placeholder (`{{ }}`) atau catatan TODO sebelum kirim
- Konfirmasi link CV/portofolio aktif dan dapat diakses

**Implementasi**:
- Validator pra-kirim Apps Script yang referensi data Sheet + draft Gmail
- Regex scan untuk placeholder/frasa tidak profesional, silang dengan data job
- HTTP HEAD check memastikan URL respons 200 (gunakan `UrlFetchApp.fetch` dengan `muteHttpExceptions`)
- Pemeriksa lampiran: validasi timestamp versi CV terbaru, paksa penamaan standar
- Sediakan override dengan logging alasan untuk audit

**Prioritas**: 🔴 TINGGI

---

### 31. Claim-to-CV Validation Bot
**Masalah**: Surat menjanjikan pencapaian/skill yang tidak didukung CV
**Solusi**:
- Petakan tiap klaim yang dihasilkan ke perpustakaan pencapaian terverifikasi
- Tandai klaim baru untuk persetujuan manual sebelum dipakai ulang
- Sorot kalimat tanpa data pendukung (misal angka, stack)

**Implementasi**:
- Pelihara sheet "Claim Library" yang mengaitkan pernyataan ke bullet CV + metrik sumber
- Chunking NLP sederhana untuk mengekstrak pasangan skill/hasil dari draft email (aturan regex + tabel kata kunci)
- Evaluator Apps Script menyilang klaim dengan library; klaim belum terverifikasi ditandai pada modal pratinjau
- Tombol cepat: "Approve & Save" atau "Replace dengan alternatif terverifikasi"

**Prioritas**: 🔴 TINGGI

---

### 32. Personalization Memory & Variation Tracker
**Masalah**: Intro/outro atau subjek berulang memicu spam/deteksi AI
**Solusi**:
- Lacak penggunaan n-gram di semua email dan terapkan jeda sebelum dipakai ulang
- Sarankan pembuka/penutup segar sesuai industri/persona perusahaan
- Rotasi gaya CTA (ajak ngopi, contoh kode async, highlight portofolio)

**Implementasi**:
- Sheet yang menyimpan jumlah penggunaan frasa + timestamp terakhir
- Saat generasi, Apps Script mengecek riwayat dan mengganti segmen yang terlalu sering dipakai
- Perpustakaan sinonim dengan bobot per nada (formal vs kasual vs teknis)
- Badge visual di modal pratinjau: "Freshness OK" vs "Terlalu mirip 3 email terakhir"

**Prioritas**: 🟠 MENENGAH-TINGGI

---

## 🎯 METRIK KEBERHASILAN

Lacak metrik berikut untuk mengukur efektivitas fitur:

1. **Response Rate**: % lamaran mendapat respons (target: 30%+)
2. **Interview Rate**: % respons yang berlanjut ke interview (target: 50%+)
3. **Offer Rate**: % interview yang menghasilkan offer (target: 25%+)
4. **Waktu ke Interview Pertama**: Hari dari apply ke interview (target: <7 hari)
5. **Usaha Pengguna**: Waktu yang dihabiskan per lamaran (target: <1 menit)
6. **False Positive**: % duplikat yang salah tandai (target: <5%)
7. **Tingkat Deteksi AI**: Berapa yang ditandai AI? (target: 0%)
8. **Keterlibatan HR**: Click rate, open rate jika terlacak (target: 40%+ open)

---

## 💡 FILOSOFI PENGEMBANGAN

**Prinsip Developer Malas**:
1. ✅ **Automate everything** - Tidak ada kerja manual
2. ✅ **Smart defaults** - Pilihan tepat sudah dipilihkan
3. ✅ **Learn from feedback** - Lacak yang berhasil, lakukan lebih banyak
4. ✅ **Catch mistakes early** - Cegah lamaran buruk
5. ✅ **Always professional** - Jangan pernah kirim email memalukan
6. ✅ **Invisible automation** - Terlihat natural bagi pengguna
7. ✅ **Maximum efficiency** - Setiap fitur = lebih sedikit kerja
8. ✅ **Zero spam flags** - Jangan sampai diblokir

---

## 📝 CATATAN

- Semua fitur dirancang untuk menghemat waktu developer DAN meningkatkan profesionalisme
- Tiap fitur mencegah minimal satu kategori kesalahan/penolakan
- Fokus: Kualitas > kuantitas (5 lamaran mantap > 50 biasa saja)
- Anti-AI detection: Pembeda utama dibanding alat lain
- Privasi: Selalu minta izin sebelum melakukan tracking

---

## 🚀 LANGKAH BERIKUTNYA

1. Review fitur Fase 1 bersama pengguna
2. Pilih 3 fitur teratas untuk dibangun berikutnya
3. Susun spesifikasi desain masing-masing
4. Sprint implementasi
5. Lacak metrik pasca rilis
6. Iterasi berdasarkan data

---

**Version**: 1.1  
**Last Updated**: 2025-10-19  
**Status**: Siap untuk diskusi & prioritisasi
