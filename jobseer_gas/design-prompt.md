# Design Prompt · Tailwind + shadcn “Luminous Dashboard” Style

Gunakan brief ini saat mengarahkan AI coder/designer membangun antarmuka dengan nuansa seperti `dummy-index.html`, tetapi fleksibel diterapkan ke berbagai produk (dashboard SaaS, CRM, analitik, HR tools, dsb.).

---

## 1. Karakter Visual Utama
- **Stack**: Tailwind CSS (boleh CDN untuk prototipe) + pola komponen shadcn/ui (rounded besar, spacing lega, tipografi rapi).
- **Tema Ganda**: Wajib ada light & dark mode. Simpan preferensi di `localStorage`, fallback mengikuti `prefers-color-scheme`.
- **Palet Dasar**: Primary biru (#2563eb) + accent cyan (#22d3ee). Boleh diganti sesuai brand, yang penting ada dua warna kontras untuk highlight/gradien.
- **Atmosfer**: Tambahkan blur gradient sebagai aksen latar (soft glows di sudut). Card memakai shadow lembut custom (`shadow-soft: 0 20px 45px -20px rgba(15,23,42,.25)`).
- **Interaksi**: Semua kontrol punya transisi `duration-300`, hover/focus state jelas. Chip/tab aktif gunakan gradien + shadow agar terasa premium.

---

## 2. Layout Generik (sesuaikan konten apa pun)
1. **Header / Top Bar**
   - Branding tipis (uppercase kecil, letter spacing lebar).
   - Tombol toggle tema (ikon 🌙/☀️) berbentuk lingkaran dengan border + shadow.
   - Ruang tambahan untuk CTA kecil (Upgrade, Sinkronisasi) jika perlu.

2. **Canvas Utama**
   - `<main class="relative overflow-hidden">`.
   - Tambah 2–3 `<div>` absolute dengan gradien blur (contoh: `bg-gradient-to-r from-primary/25 via-transparent to-accent/25 blur-3xl`).
   - Grid responsif: `lg:grid-cols-[260px_1fr]` (sidebar + workspace). Di mobile, susun vertikal.

3. **Sidebar / Navigation Column**
   - Kartu navigasi `rounded-3xl`, border subtle, shadow lembut.
   - Tombol tab base minimal, state aktif = gradien halus (primary→accent), state pasif = border transparan + hover-muted. Gaya ini bisa diterapkan meski menunya CRM, Analytics, dsb.
   - Sertakan kartu info singkat (tips, insight, ringkasan KPI).

4. **Workspace / Panel Konten**
   - Setiap panel = kartu `rounded-3xl` dengan border & shadow.
   - Untuk mode/filter gunakan tombol chip `inline-flex rounded-full`.
   - Form upload/input gunakan gradien berbeda (mis. sky & rose) supaya blok konten saling membedakan.
   - Statistik kilat tampil dalam 3–4 kartu warna (sky/violet/emerald/amber). Silakan ganti warna sesuai metrik.
   - Tombol aksi massal (`Process`, `Sync`, `Send`) minimal `rounded-xl`, shadow lembut, icon emoji opsional.

5. **Aktivitas & Toast**
   - Log/timeline di kartu semi transparan (`border` + `backdrop-blur`).
   - Toast mini: `div` rounded dengan animasi slide + fade, auto-dismiss.

6. **Footer**
   - Border tipis + teks kecil (hak cipta, nomor versi, dsb.).

> **Catatan**: Struktur panel bisa diubah sesuka hati. Misal ganti “Upload Lowongan” jadi “Import Dataset”, ganti statistik menjadi KPI revenue, dst. Yang dijaga adalah DNA visual & interaksinya.

---

## 3. Dark Mode Checklist
- Gunakan varian `dark:` di seluruh elemen penting (background, border, teks, gradien).
- Untuk gradien malam hari, pakai warna dengan opacity lebih tinggi (`dark:from-primary/30`, `dark:to-accent/40`, dll).
- Toggle tema memanipulasi class `dark` pada `<html>` dan menyimpan preferensi di `localStorage`.

---

## 4. Kerangka Template (pseudo)
```
<html class="dark">
  <body class="bg-background dark:bg-slate-950">
    <header>…</header>
    <main class="relative overflow-hidden">
      <div class="absolute … blur-3xl"></div>
      <div class="absolute … blur-3xl"></div>

      <div class="relative grid lg:grid-cols-[260px_1fr] gap-6 px-6 py-8">
        <aside>
          <!-- kartu nav + kartu tips -->
        </aside>
        <section id="workspace">
          <!-- panel/tab utama -->
          <!-- panel lain -->
        </section>
      </div>
    </main>
    <footer>…</footer>

    <script>
      // toggle tema, handle tab, state dummy, toast helper
    </script>
  </body>
</html>
```

---

## 5. Copywriting & Micro Interaction
- Pakai emoji ringan (📥, 🧠, 📊) untuk memberi rasa human tanpa mengurangi profesionalitas.
- Headline singkat, subcopy jelaskan aksi dengan bahasa pengguna (boleh ID/EN).
- Setiap aksi (form submit, toggle, proses massal) munculkan toast dan catat di log.
- Berikan validasi basic pada form (cek input kosong, dsb.) dengan feedback visual.

---

## 6. Deliverable Minimal (yang harus AI hasilkan)
1. HTML tunggal dengan Tailwind (boleh CDN) + definisi warna/utility sesuai brief.
2. Light/dark mode berfungsi lengkap.
3. JS ringan untuk:
   - Toggle tema & simpan preferensi.
   - Navigasi tab/panel.
   - Update statistik & log dummy berdasarkan interaksi.
   - Toast helper (menambah/menghapus notifikasi).
4. Layout responsif mobile → desktop.

---

## 7. Adaptasi Lintas Proyek
- Ubah nama tab, ikon, dan konten sesuai domain (mis. “Campaign Builder”, “Incident Overview”, “Inventory Tracking”).
- Ganti spektrum warna gradien untuk mengikuti brand guidelines (mis. hijau-oranye untuk finance).
- Jika suatu proyek tak butuh sidebar, bisa ubah menjadi top-nav + dua kolom card; tetap pertahankan aksen gradien blur, shadow lembut, dan chip/tab gradien.

---

Dengan prompt ini, AI coder mengerti bahwa target UI adalah “dashboard modern + lembut” ala `dummy-index.html`, namun mudah diaplikasikan ke konteks apa pun tanpa tersandera desain lowongan kerja. Cantumkan brief ini saat memulai proyek agar kualitas visual & UX konsisten di seluruh produk.***
