# Kopi Senja POS

Aplikasi POS satu outlet untuk kasir, produksi Kitchen/Barista, persediaan bahan baku, laporan, dan cetak nota. Aplikasi berjalan di server Node.js lokal dengan SQLite sehingga perangkat dalam jaringan outlet dapat mengaksesnya tanpa layanan cloud.

## Persyaratan

- Node.js 20.16 atau lebih baru
- pnpm 12 atau lebih baru

## Menjalankan aplikasi

```bash
pnpm install
pnpm db:setup
pnpm dev
```

`pnpm db:setup` menerapkan migrasi, membuat akun dasar, pengaturan default, dan menyiapkan `.env.local` serta `data/pos.sqlite`. Database dimulai **kosong** (tanpa menu, bahan, atau pesanan). Saat akun pertama kali dibuat, password bersama untuk keempat akun dicetak di terminal. Password tersebut disimpan lokal di `.env.local`; jangan membagikan atau meng-commit file itu. Menjalankan setup kembali tidak mengubah akun atau password yang sudah ada.

Untuk mencoba aplikasi dengan data contoh (9 menu, 10 bahan, 10 meja, 4 area denah, 4 pesanan), jalankan `pnpm db:setup -- --demo`. Data contoh hanya ditambahkan saat flag ini dipakai dan langsung menandai setup sebagai selesai.

Untuk demo di Vercel, atur env `POS_DB_PATH=/tmp/kopi-senja/pos.sqlite`, `POS_SEED_DEMO=1`, `DEMO_PASSWORD`, dan `SESSION_SECRET`. Saat database kosong, aplikasi otomatis mengisi data contoh yang sama seperti `--demo`. Database di `/tmp` bersifat sementara dan dapat kembali kosong saat instance baru dibuat. Printer dan laci kasir (Bluetooth/serial) tidak berfungsi di Vercel.

Buka `http://localhost:3000` pada server. Perangkat kasir dan stasiun produksi dapat membuka `http://<IP-LAN-server>:3000` selama berada di jaringan lokal yang sama.

## Setup awal outlet

Login pertama sebagai `admin` mengarahkan ke wizard `/setup` selama setup belum selesai. Wizard berisi lima langkah:

1. **Profil toko**: nama toko, logo, persentase pajak, lebar kertas struk, dan catatan kaki struk.
2. **Bahan baku**: minimal satu bahan (nama, satuan, stok awal, batas minimum).
3. **Menu**: minimal satu menu aktif. Setiap menu wajib memiliki minimal satu bahan resep dan stasiun (Barista atau Kitchen).
4. **Denah meja**: opsional. Admin menambahkan meja dan mengatur posisinya di peta (Leaflet, grid koordinat 0–100), serta dapat menggambar area denah (persegi, bulat, dinding, counter).
5. **Selesai**: ringkasan lalu tombol untuk membuka dashboard.

Menu, bahan, dan denah meja yang sudah dibuat tetap dapat diubah dari halaman Menu, Inventory, dan Pengaturan. Menu tidak dihapus, hanya dinonaktifkan.

## Denah meja

Meja disimpan di tabel `dining_tables` dan dipilih kasir dari peta saat membuat pesanan dine-in. Setiap meja ditampilkan dengan status kosong atau terisi (ada pesanan dine-in yang belum selesai).

Admin dapat memilih cara kasir memilih meja di Pengaturan > **Pemilihan meja kasir**: `Denah peta` (default) atau `Kartu meja`. Kartu meja menampilkan semua meja sebagai kartu dengan status, dan tidak memerlukan denah peta. Pengaturan ini disimpan di tabel `settings` dengan kunci `table_picker_mode`.

- Admin menambah meja dengan nama unik dan menyeret marker di peta untuk mengatur posisinya. Posisi tersimpan otomatis saat marker dilepas.
- Meja yang sedang terisi tidak dapat diganti nama atau dihapus.
- Admin menambah meja dengan nama unik dan menyeret marker di peta untuk mengatur posisinya. Posisi tersimpan otomatis saat marker dilepas.
- Meja yang sedang terisi tidak dapat diganti nama atau dihapus.
- Pesanan dine-in wajib memilih meja yang ada. Pesanan takeaway tidak memerlukan meja.

### Area denah

Admin juga dapat menggambar area di denah untuk menunjukkan bentuk outlet, disimpan di tabel `map_shapes`. Ada empat jenis: persegi (`rectangle`), bulat (`ellipse`), dinding (`wall`), dan counter (`counter`).

- Pilih area di peta untuk mengubah label, lebar, atau tinggi. Ukuran juga bisa diubah dengan menggeser sudut area, dan area dipindahkan dengan handle di tengahnya.
- Area harus berada di dalam batas peta (0–100). Pelanggaran dijawab dengan `SHAPE_OUT_OF_BOUNDS`.
- Area hanya gambaran dan tidak memengaruhi pesanan. Area boleh tumpang tindih dengan meja. Kasir melihat area dengan labelnya, tetapi tidak bisa mengkliknya.

## Stasiun dan link pesanan

Halaman pesanan dipisah per stasiun dengan URL yang dapat dijadikan bookmark:

- `/pesanan/barista`: tiket minuman dan produksi Barista.
- `/pesanan/kitchen`: tiket makanan dan produksi Kitchen.

Akun `barista` dan `kitchen` otomatis diarahkan ke stasiunnya dan tidak dapat membuka stasiun lain. Admin dan kasir dapat berpindah antar-stasiun lewat tab di halaman pesanan.

## Akun demo

Semua akun menggunakan password demo yang sama:

| Username | Akses |
| --- | --- |
| `admin` | Dashboard, kasir, pesanan, menu, inventory, laporan, pengaturan, pembatalan |
| `kasir` | Dashboard, transaksi, cetak nota/tiket, konfirmasi pickup, laporan |
| `barista` | Tiket minuman dan perubahan status produksi Barista |
| `kitchen` | Tiket makanan dan perubahan status produksi Kitchen |

## Alur operasional

1. Kasir memilih menu, jenis pesanan (untuk dine-in, meja dipilih dari denah), dan metode pembayaran simulasi.
2. Pembayaran membuat satu order dengan tiket Kitchen dan/atau Barista sesuai item. Resep bahan baku divalidasi dan stok direservasi dalam transaksi SQLite yang sama.
3. Stasiun memulai tiketnya sendiri. Hanya saat itu bahan untuk tiket tersebut dicatat sebagai `Stock Out`.
4. Setelah seluruh tiket siap, order masuk ke kolom “Siap diambil”. Kasir mengonfirmasi pickup untuk menyelesaikan order.
5. Pembatalan oleh admin mengembalikan reservasi tiket yang belum dimulai, menandai pembayaran simulasi sebagai refund, dan mencatat bahan tiket yang sudah diproduksi sebagai waste.

Pembayaran QRIS dan kartu pada prototipe ini **simulasi**, bukan integrasi payment gateway. Pencetakan membuka dialog cetak browser dari perangkat kasir; satu paket memuat nota pelanggan dan tiket untuk setiap stasiun. Lebar kertas 58/80 mm dapat diatur di menu Pengaturan.

## Profil toko dan akun

Menu Pengaturan memuat kartu-kartu berikut:

- **Profil toko** (admin): nama outlet dan logo. Logo berformat PNG, JPEG, atau WebP maksimal 512 KB, dan tampil di sidebar serta nota cetak.
- **Akun saya** (semua peran): nama tampilan, foto profil (PNG, JPEG, atau WebP maksimal 512 KB), dan ganti password. Ganti password membutuhkan password lama dan tidak mengeluarkan perangkat yang sedang dipakai; sesi di perangkat lain berakhir.
- **Kelola akun** (admin): daftar akun dan reset password akun lain. Akun yang direset harus login ulang. Admin mengubah password sendiri lewat kartu “Akun saya”.
- **Denah meja** (admin): tambah, ubah nama, pindahkan, dan hapus meja di peta. Tambah, ubah ukuran, dan hapus area denah (persegi, bulat, dinding, counter).

Logo dan foto disimpan sebagai file di `data/uploads/` (diabaikan Git) dan database hanya menyimpan nama file.

## Diskon

Master diskon dikelola admin di menu **Menu** (kartu “Diskon”). Setiap diskon punya nama unik, jenis, nilai, minimal belanja, dan status aktif.

- **Persentase** (1–100%): potongan = subtotal × nilai ÷ 100, dibulatkan ke bawah. Batas maksimal potongan (opsional) membatasi nominal.
- **Nominal**: potongan tetap dalam rupiah, tidak boleh melebihi subtotal.
- Diskon diterapkan di level pesanan, sebelum pajak. Pajak dihitung dari subtotal setelah diskon.
- Kasir memilih diskon di langkah “Diskon” pada checkout. Diskon nonaktif atau yang belum memenuhi minimal belanja tidak bisa dipilih. Server menghitung ulang dan memvalidasi ulang diskon saat pesanan dibuat.
- Pesanan menyimpan salinan diskon (nama, jenis, nilai, nominal). Menghapus diskon tidak mengubah pesanan yang sudah dibayar. Nota dan cetak ESC/POS menampilkan baris diskon.

## Kas dan pengeluaran

Menu **Kas** dipakai kasir dan admin untuk mencatat kas laci.

- **Buka shift** dengan modal awal (kas pembuka). Pembayaran tunai hanya bisa dilakukan saat shift terbuka; server menolak dengan `SHIFT_REQUIRED` jika belum ada shift. Pembayaran non-tunai (QRIS, Debit/Kredit) tidak memerlukan shift.
- **Kas yang diharapkan** = modal awal + penjualan tunai − refund tunai − pengeluaran “Dari laci kasir” yang tidak ditolak. Shift yang masih terbuka dihitung secara langsung. Shift yang sudah ditutup menyimpan nilai saat penutupan.
- **Tutup shift** dengan menghitung uang fisik. Selisih (hitung − diharapkan) dicatat di riwayat shift.
- **Pengeluaran belanja stok** dicatat dengan PIC, bahan, jumlah, total, catatan, dan **foto nota (wajib, maksimal 3 MB)**. Sumbernya “Dari laci kasir” (butuh shift terbuka) atau “Non-tunai” (tidak mengurangi laci).
- **Ambang persetujuan** (default Rp 500.000, dapat diubah di **Pengaturan**). Pengeluaran di atas ambang berstatus *Pending* sampai admin menyetujui atau menolak. Di bawah ambang langsung *Approved*.
- Stok masuk saat pengeluaran dicatat. Admin yang menolak pengeluaran *Pending* akan membalik stok tersebut. Penolakan diblokir jika stok sudah dipakai resep pesanan.
- Hanya admin yang bisa menyetujui atau menolak pengeluaran dan membatalkan pesanan (termasuk refund tunai). Barista dan kitchen tidak bisa membuka shift atau mencatat pengeluaran.

Batasan saat ini: menolak pengeluaran “Dari laci kasir” dari shift yang sudah ditutup tidak mengubah snapshot kas shift tersebut.

## Printer thermal

Cetak nota dan tiket barista/kitchen dikirim langsung dari server. Atur di Pengaturan > **Printer thermal** (admin):

- **Nonaktif**: tombol "Cetak lewat browser" saja (dialog cetak browser).
- **Jaringan LAN**: isi IP printer dan port (umumnya `9100`). Server membuka koneksi TCP langsung ke printer, jadi komputer server harus satu jaringan dengan printer.
- **Port serial (Bluetooth Classic / COM / USB-serial)**: pasangkan printer di Pengaturan Bluetooth Windows dulu. Setelah itu Pengaturan > Printer thermal menampilkan daftar port secara realtime (diperbarui tiap 3 detik). Port Bluetooth diberi label **Bluetooth**. Klik **Hubungkan & simpan** pada port yang dipilih, lalu koneksi tersimpan di server dan tetap dipakai setelah restart. Port juga bisa diisi manual jika tidak terdeteksi. Di Windows port berbentuk `COM3`. Di macOS pakai `/dev/cu.NAMA-PRINTER` (lihat `ls /dev/cu.*` setelah pairing). Baud rate ikuti manual printer, umumnya 9600 atau 115200. Printer BLE (Bluetooth Low Energy) tidak didukung di mode ini.
- **Printer terpasang di sistem**: isi nama antrian printer yang sudah dipasang di sistem. Di macOS/Linux, server mengirim lewat CUPS (`lp -o raw`, nama dari `lpstat -p`). Di Windows, server mengirim data RAW lewat spooler (`winspool`) memakai PowerShell, dengan nama printer seperti di Settings > Printers. Cocok untuk printer USB, dan printer harus sudah terpasang di Windows.
- **Bluetooth dari browser (tanpa setting server)**: di dialog cetak, klik **Connect ke printer thermal** lalu pilih printer. Cetak lewat tombol **Cetak ke Bluetooth** dikirim dari browser kasir ke printer. Fitur ini memakai Web Bluetooth, jadi hanya bekerja di Chrome atau Edge, dibuka lewat HTTPS atau `localhost`, dan hanya untuk printer BLE. Printer Bluetooth Classic tetap pakai mode port serial di atas. Koneksi berlaku untuk tab itu saja, dan hilang saat halaman dimuat ulang.

Lebar kertas (58mm atau 80mm) berlaku juga untuk cetak dari server. Gunakan **Tes cetak** untuk memastikan koneksi. Setiap dokumen diakhiri perintah potong kertas. Nota dan semua tiket non-batal dicetak dalam satu pengiriman ke printer yang sama.

**Buka laci kasir** memakai printer yang sama. Laci harus terhubung ke konektor RJ11 di printer. Server mengirim perintah ESC/POS `ESC p` (drawer kick) ke printer, lalu printer membuka laci. Fungsi ini tersedia di mode jaringan, port serial, dan printer sistem:

- **Buka laci sekarang** (Pengaturan > Printer thermal) dan **Buka laci** (menu Kas) membuka laci secara manual. Admin dan kasir bisa memakainya.
- Opsi **Buka laci otomatis** membuka laci setiap pembayaran tunai. Jika gagal, pesanan tetap tersimpan dan kasir mendapat peringatan.
- Setiap pembukaan laci dicatat di log aktivitas.

Catatan: karena printer mengambil data dalam format ESC/POS (ASCII), karakter non-ASCII dicetak sebagai `?`. Jika printer dan server tidak satu jaringan, gunakan mode nonaktif dan cetak lewat browser.

## Perintah

```bash
pnpm dev         # server pengembangan, bind ke jaringan lokal
pnpm db:setup    # migrasi dan akun dasar; database kosong, setup lewat wizard
pnpm db:setup -- --demo   # sama, ditambah data contoh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start       # jalankan build produksi, bind ke jaringan lokal
```

Database aktif berada di `data/pos.sqlite` dan file unggahan di `data/uploads/` (keduanya diabaikan Git). Untuk backup, hentikan server terlebih dahulu lalu salin kedua lokasi tersebut.

## Batasan MVP

Database SQLite ditujukan untuk satu outlet dan satu server lokal. Aplikasi belum menyediakan pembuatan dan penghapusan akun dari UI, payment gateway nyata, sinkronisasi cloud, atau printer-server khusus. Data lokal perlu dicadangkan secara berkala.
