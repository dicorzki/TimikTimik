# RunPlan — Panduan Integrasi

## File Baru yang Perlu Ditambahkan

```
manifest.json          → PWA config, letakkan di root project
sw.js                  → Service worker, letakkan di root project  
integration_patch.js   → Integration layer generator ↔ Supabase
```

---

## Perubahan di generator.html

### 1. Tambah satu baris di `<head>` (sebelum `</head>`)
```html
<link rel="manifest" href="manifest.json">
```

### 2. Ganti blok header user info yang lama

Cari dan HAPUS blok ini di generator.html:
```html
<div class="user-info" style="margin-right: 15px; font-size: 12px; color: #9A9A90;">
    Halo, <span id="display-user" style="color: #fff; font-weight: 700;"></span>
</div>
<button onclick="logout()" class="btn-logout" ...>LOGOUT</button>
```

Biarkan kosong — integration_patch.js akan inject UI user secara otomatis.

### 3. Hapus blok auth lama di `<script>` pertama generator.html

Cari dan HAPUS ini:
```javascript
// Cek apakah user sudah login
const activeUser = localStorage.getItem('rp_session');
if (!activeUser) {
    window.location.href = 'auth.html';
}

// Fungsi Logout
function logout() {
    localStorage.removeItem('rp_session');
    window.location.href = 'auth.html';
}
```

### 4. Tambah script integration TEPAT sebelum `</body>`

```html
<script type="module" src="integration_patch.js"></script>
```

Letakkan ini sebagai script PALING TERAKHIR, setelah semua script lain
termasuk Microsoft Clarity dan Cloudflare beacon.

---

## Perubahan di index.html

### Satu perubahan di `buildPlanCard()` — link sudah benar di versi terbaru

Pastikan baris link "Buka →" menggunakan URL dengan query param planId:
```javascript
// SUDAH BENAR di versi terbaru:
<a href="generator.html?plan=${plan.id}" class="btn-open-plan">Buka →</a>
```

Jika versi kamu masih pakai `href="generator.html"` tanpa param,
ganti dengan versi di atas.

---

## Verifikasi Supabase

Pastikan di `supabase_config.js` kamu sudah isi:
```javascript
const SUPABASE_URL = 'https://XXXX.supabase.co';   // dari Settings → API
const SUPABASE_KEY = 'sb_publishable_XXXX';         // anon public key
```

---

## Deploy ke Vercel

1. Push semua file ke GitHub repo
2. Connect repo ke vercel.com
3. Tidak perlu environment variable — key Supabase sudah di supabase_config.js
   (untuk project pribadi ini aman, anon key memang public by design)
4. Vercel auto-detect static site, tidak perlu konfigurasi build

---

## Struktur File Final

```
runplan/
├── auth.html
├── index.html          ← dashboard
├── generator.html      ← form + program output (TIDAK diubah logic-nya)
├── kalender.html       ← race calendar
├── style.css
├── supabase_config.js  ← isi URL + KEY dari Supabase
├── integration_patch.js← NEW: auth + sync layer
├── manifest.json       ← NEW: PWA config
├── sw.js               ← NEW: service worker
├── races_data.json     ← data kalender
└── scraper.py          ← untuk update data kalender
```

---

## Alur User Setelah Integrasi

```
auth.html (login/signup)
    ↓ login berhasil
index.html (dashboard)
    ├── Tab "Program Lari"
    │   ├── Lihat semua plan (dari Supabase)
    │   ├── Klik "Buat Program" → generator.html (form kosong)
    │   └── Klik "Buka →" → generator.html?plan=UUID (load plan)
    └── Tab "Kalender Race"
        └── iframe kalender.html
```

---

## Cara Install di HP (PWA)

**Android Chrome:**
1. Buka URL app di Chrome
2. Tap menu ⋮ → "Add to Home Screen"
3. Konfirmasi → icon RunPlan muncul di home screen

**iPhone Safari:**
1. Buka URL di Safari
2. Tap share icon → "Add to Home Screen"
3. Tap "Add"

> PWA butuh HTTPS — Vercel otomatis provide HTTPS ✓
