# KEIOL

<div align="center">
  <img src="build/icon.png" width="128" height="128" alt="KEIOL Logo" />
  <h3>Modern Desktop Video Player & Anime Streaming Hub</h3>
  <p>Pemutar video desktop modern dengan kontrol khas YouTube, akselerasi kecepatan hingga 4x, integrasi Windows System Tray, serta katalog streaming anime universal.</p>

  [![Release](https://img.shields.io/github/v/release/Xeranov/KEIOL?color=E50914&label=KEIOL%20Release)](https://github.com/Xeranov/KEIOL/releases)
  [![Platform](https://img.shields.io/badge/platform-Windows-blue)](https://github.com/Xeranov/KEIOL)
  [![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
</div>

---

## 📸 Preview Aplikasi

> Taruh screenshot antarmuka KEIOL Anda di sini (misal: di folder `docs/screenshots/`):

![KEIOL Interface Preview](build/icon.png)

*(Silakan tambahkan tangkapan layar tampilan Beranda Netflix-style, Video Player, dan Popup Update Anda di sini)*

---

## ✨ Fitur Utama

### 1. 🎬 Universal Codec & Playback (Bertenaga FFmpeg)
- Mendukung pemutaran langsung file lokal tanpa hambatan: **MKV, MP4, AVI, WEBM, MOV, TS, FLV**.
- Transmuxing otomatis untuk video 10-bit / HEVC / audio surround 5.1 tanpa lag.
- Dukungan subtitle eksternal maupun internal (.srt, .vtt, .ass).

### 2. ⚡ Kontrol Khas YouTube & Hold-to-Boost
- **Akselerasi 2x Instan**: Tahan tombol `Spasi` atau `Klik Kiri` mouse untuk memutar 2x lebih cepat, lepaskan untuk kembali ke kecepatan normal.
- **Kecepatan Variabel**: Ubah kecepatan dari `0.25x` hingga `4.0x` menggunakan shortcut `Shift + >` / `Shift + <`.
- **Navigasi Waktu Instan**: Lompat maju/mundur dengan `J` / `L` atau `←` / `→`.
- **Frame-by-frame seeking**: Telusuri frame demi frame saat jeda dengan tombol `.` dan `,`.

### 3. 🛡️ Windows System Tray Integration
- Icon aktif di Windows Taskbar notification area (System Tray).
- Klik icon tray untuk menampilkan atau menyembunyikan jendela pemutar.
- Menu klik kanan cepat: *Buka KEIOL*, *Putar / Jeda*, *Pengaturan*, dan *Keluar*.
- Opsi switch di Pengaturan: Pilih apakah tombol Close `(X)` menutup aplikasi sepenuhnya atau meminimalkannya ke Tray agar audio/unduhan tetap berjalan di latar belakang.

### 4. 🔄 Sistem Pembaruan Otomatis & Force Update Darurat
- Pengecekan versi otomatis saat aplikasi pertama kali dibuka.
- **Normal Update**: Popup pemberitahuan rilis baru lengkap dengan catatan perubahan (*changelog*), tombol *Update Sekarang*, *Nanti Saja*, dan *Lewati Versi Ini*.
- **Emergency Force Update**: Mekanisme pemblokir wajib update yang dapat diaktifkan langsung melalui file `version.json` di GitHub tanpa perlu mengubah binary lama, berguna jika rilis sebelumnya memiliki bug kritis.
- **Background Download**: Unduhan berjalan di latar belakang dengan indikator progress bar dan prompt *Pasang & Restart*.

### 5. 🎌 Integrasi Anime & Streaming Web
- Katalog anime berkelanjutan (*ongoing*), jadwal rilis harian, dan pencarian episode Otakudesu langsung di dalam aplikasi.
- **AniSkip**: Deteksi otomatis dan lewati intro/ending lagu anime dengan satu tombol (`S`).
- **Download Manager**: Unduh episode dan batch anime dengan monitoring progress real-time.

---

## ⌨️ Daftar Pintasan Keyboard (Shortcuts)

| Shortcut | Aksi |
|---|---|
| `Spasi` / `K` | Putar / Jeda (Play / Pause) |
| **Tahan `Spasi` / Klik** | **2x Speed Hold-to-Boost** |
| `J` / `←` | Mundur 10 detik |
| `L` / `→` | Maju 10 detik |
| `↑` / `↓` | Volume naik / turun 5% |
| `M` | Matikan / Bunyikan suara (Mute) |
| `F` | Layar penuh (Fullscreen) |
| `Shift + >` / `<` | Kecepatan playback (+0.25x / -0.25x) |
| `0` s/d `9` | Lompat ke 0% - 90% durasi video |
| `.` / `,` | Frame maju / mundur (saat jeda) |
| `S` | Lewati Intro Anime (AniSkip) |
| `Ctrl + O` | Buka file video lokal |
| `Ctrl + +` / `Ctrl + =` | Perbesar Tampilan (Zoom In) |
| `Ctrl + -` | Perkecil Tampilan (Zoom Out) |
| `Ctrl + 0` | Reset Tampilan Normal (100%) |
| `Ctrl + Scroll Mouse` | Perbesar / Perkecil Tampilan (Smooth Zoom) |

---

## 🚀 Memulai (Development)

### Prasyarat
- [Node.js](https://nodejs.org/) (versi 18 ke atas)
- [Python](https://python.org/) & Pillow (untuk generator icon)

### Menjalankan secara Lokal
```bash
# Clone repository
git clone https://github.com/Xeranov/KEIOL.git
cd KEIOL

# Install dependencies
npm install

# Jalankan aplikasi
npm start
```

### Menjalankan Test Suite
```bash
npm test
# atau
node src/test/verify_all.js
```

---

## 📦 Panduan Rilis Baru ke GitHub (CI/CD)

Aplikasi ini telah dilengkapi dengan workflow otomatis **GitHub Actions** (`.github/workflows/release.yml`). Untuk mem-publish versi baru:

1. Perbarui versi di `package.json` dan `version.json` (misal menjadi `1.0.1`).
2. Buat git commit dan tag baru:
   ```bash
   git add package.json version.json
   git commit -m "Release KEIOL v1.0.1"
   git tag v1.0.1
   git push origin main --tags
   ```
3. GitHub Actions akan secara otomatis meng-compile dan mengunggah file installer `KEIOL-Setup-1.0.1.exe` dan `latest.yml` ke halaman **GitHub Releases**.
4. Seluruh pengguna KEIOL akan otomatis mendeteksi pembaruan ini saat membuka aplikasi!

---

## 📄 Lisensi
Didistribusikan di bawah Lisensi MIT. Lihat `LICENSE` untuk informasi lebih lanjut.

