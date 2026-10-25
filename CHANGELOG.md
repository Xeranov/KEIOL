# Changelog

Semua perubahan penting pada proyek **KEIOL** akan didokumentasikan di berkas ini. Format penulisan mengikuti pedoman [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan proyek ini mematuhi prinsip [Semantic Versioning](https://semver.org/lang/id/).

---

## [2.0.0] - 2026-10-25

### Ditambahkan (Added)
- **Perombakan Antarmuka Film & Series (Netflix & Idlix Experience)**:
  - **Rotating Hero Billboard Carousel**: Menampilkan banner sinematik 16:9 judul tren mingguan dengan backdrop resolusi tinggi, metadata lengkap (rating bintang, tahun rilis, durasi/season), tombol "Putar Sekarang", "Info Selengkapnya", indikator slide dot, serta transisi otomatis 7 detik dengan jeda saat kursor diarahkan ke banner.
  - **Multi-Row Netflix Horizontal Sliders**: Baris kategori horizontal (Sedang Tren, Film Populer, Serial TV Teratas, Horor & Misteri, Drama Romansa) dengan tombol geser meluncur mulus (*smooth scrolling*).
  - **Expanding Pop-Out Cards**: Kartu media membesar secara elegan saat disentuh kursor (*hover/focus*), menampilkan tombol putar cepat, tombol Daftar Saya (*bookmark*), ringkasan genre, dan persentase kecocokan.
  - **Dynamic Filter Hub & Navigasi**: Tab filter (Semua, Film, Serial TV, Populer) yang responsif dan dropdown filter genre TMDB.
  - **Immersive Full-Page Detail View**: Halaman detail film dan serial TV dengan backdrop sinematik, metadata kru/cast, sinopsis lengkap, pemilihan musim (*season selector*), dan kisi episode dengan thumbnail 16:9.
- **Pemisahan Eksklusif Riwayat Lanjutkan Menonton (Continue Watching)**:
  - Tab Web (Anime & Donghua) hanya menampilkan riwayat tontonan anime/donghua dari Otakudesu dan Ani-Chin.
  - Tab Film & Series memiliki baris "Lanjutkan Menonton" tersendiri khusus judul film dan serial TV barat/Asia.
  - Masing-masing tab terisolasi dan tidak saling mencampur riwayat tontonan.
- **Pelacakan Waktu Tonton Real-Time & Resume Pemutaran**:
  - Progres streaming terekam secara live saat pemutaran berjalan (`player:timeupdate`) setiap 3 detik.
  - Menekan kartu Lanjutkan Menonton memutar video langsung dari detik terakhir yang ditonton (`startTime`).
- **Tombol Hapus Riwayat Tontonan (`&times;`)**:
  - Tombol hapus cepat pada sudut kartu tontonan untuk membersihkan riwayat tontonan anime maupun film secara mandiri tanpa reset data menyeluruh.
- **Subtitle Bahasa Indonesia Otomatis**:
  - Membaca subtitle Bahasa Indonesia secara otomatis dari manifest stream Idlix dan mengaktifkannya langsung ke player.

### Diubah (Changed)
- Peningkatan pemanggilan proxy HLS lokal untuk streaming film dan serial Idlix guna mencegah pemblokiran CORS dan proteksi CDN.
- Performa muat awal tab Film & Series kini menggunakan pemuatan bertahap (*lazy batching*) sehingga beranda terbuka secara instan.

---

## [1.2.0] - 2026-10-19

### Ditambahkan (Added)
- **Kontrol Layar Penuh YouTube**: Ketukan ganda (*double-click*) pada layar video kini beralih antara Layar Penuh (*Fullscreen*) dan Normal (*Unfullscreen*), konsisten dengan kebiasaan di YouTube.
- **Navigasi Episode Selanjutnya**:
  - Tombol fisik **Episode Selanjutnya** (`#btnNextEpisode`) disematkan langsung di bilah kontrol pemutar.
  - Pintasan keyboard **`Shift + N`** untuk melompat langsung ke episode berikutnya tanpa jeda.
  - Dukungan urutan episode dua arah (*bidirectional detection*: daftar episode menaik maupun menurun).
- **Pintasan Universal Lewati Intro (`S`)**: Menekan tombol `S` pada keyboard akan melompati 85 detik video (*durasi standar lagu pembuka anime*) kapan saja dan di mana saja.
- **Tombol Lewati Loading Startup**: Muncul otomatis setelah 10 detik jika proses loading jaringan berlangsung lambat, memungkinkan pengguna langsung masuk ke aplikasi.
- **Deteksi Mode Offline Otomatis**: Layar startup langsung ditutup seketika jika perangkat tidak memiliki koneksi internet, dan tab web menampilkan panel pemberitahuan offline yang bersih tanpa pesan error.
- **Prefetching Stream Episode**: Buffer stream episode berikutnya disiapkan di latar belakang menjelang akhir video untuk transisi pemutaran instan.

### Diubah (Changed)
- **Preloading Multi-Sumber Terpadu (Daftar Anime A-Z)**:
  - Mengambil data katalog secara paralel di latar belakang (`Promise.all`) menggabungkan 3 sumber sekaligus: Otakudesu, Kusonime, dan Ani-Chin (Donghua).
  - Tab "Daftar Anime" kini memuat semua sumber sejak awal startup dengan penanda warna sumber yang jelas (Biru, Hitam, Kuning) serta filter kategori.
- **Penyempurnaan Tombol Lewati Intro**:
  - Tombol *Lewati Intro* kini otomatis memudar (*fade out*) bersamaan dengan bilah kontrol saat mouse berhenti bergerak (*idle*).
  - Tombol lewati intro **tidak akan pernah muncul** jika video tidak memiliki data interval resmi dan valid, menjaga antarmuka tetap bersih.
  - Menekan tombol lewati intro dijamin **tidak mem-pause video** (*playback tetap berjalan mulus*).
- **Mesin AniSkip Multi-Musim**:
  - Peningkatan algoritma pencocokan MAL ID dan resolusi offset episode pada serial bersambung multi-musim (contoh: *Black Clover Season 2*, dll.).
  - Mencegah penggunaan stempel waktu intro palsu dari musim sebelumnya serta menolak interval yang tidak logis/melebihi durasi video.

### Dihapus (Removed)
- **Notifikasi Unduhan Streaming Lambat**: Menghilangkan toast dialog rekomendasi unduh saat streaming terasa lambat yang sebelumnya mengganggu kenyamanan menonton.

---

## [1.1.1] - 2026-10-16

### Ditambahkan (Added)
- **In-App Auto-Updater**: Pengunduh installer resmi (.exe) langsung di dalam aplikasi dengan indikator persentase, total ukuran megabyte, dan kecepatan unduh real-time.
- **Instalasi Otomatis & Restart Hening**: Menjalankan paket instalasi pembaruan dan merestart aplikasi secara mulus.
- **Pintasan Menu Tray**: Opsi "Periksa Pembaruan..." pada menu klik kanan icon baki sistem (*System Tray*).

---

## [1.1.0] - 2026-10-15

### Ditambahkan (Added)
- **Integrasi Batch Kusonime**: Fitur unduh batch episode lengkap dengan pemilihan mirror otomatis berdasarkan resolusi.
- **Ekstraksi Arsip Otomatis**: Otomatis mengekstrak arsip RAR/ZIP serial anime ke folder koleksi lokal.
- **Pemisahan Folder Unduhan**: Pengaturan folder unduhan khusus yang terpisah dari folder video utama.
- **Autoplay Instan**: Transisi langsung ke episode selanjutnya tanpa hitung mundur 5 detik.

---

## [1.0.1] - 2026-10-14

### Diperbaiki (Fixed)
- Pembongkaran biner FFmpeg dan FFprobe dari asar untuk mengatasi error `spawn ENOENT` pada instalasi Windows.

---

## [1.0.0] - 2026-10-14

### Rilis Perdana (Initial Release)
- Pemutar video desktop berbasis Electron dan FFmpeg dengan kontrol khas YouTube (kecepatan 4x, 2x hold-to-boost, pintasan penuh, multi-codec).

