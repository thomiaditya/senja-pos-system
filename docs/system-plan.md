# Software Requirements Analysis

## Cafe Point of Sale (POS) — MVP

MVP Scope

Single Outlet

Cashier Ordering

Prepaid Transaction

Dokumen analisis kebutuhan sistem • Version 1.0 • 3 November 2026

Dokumen ini menjadi landasan pengembangan aplikasi POS untuk satu outlet kafe, dengan proses pemesanan melalui kasir, pembayaran sebelum pesanan diproses, dan pengelolaan inventory berdasarkan bahan baku (ingredient-based inventory).

Fokus pengembangan adalah menyelesaikan kebutuhan operasional utama terlebih dahulu, tanpa memasukkan kompleksitas fitur enterprise atau multi-cabang.

# 1. Business Background

## 1.1 Latar Belakang

Kafe merupakan bisnis yang memiliki aktivitas operasional berulang, meliputi penerimaan pesanan pelanggan, pengelolaan menu, pembayaran, persiapan makanan dan minuman, serta pengendalian persediaan bahan baku.

Dalam operasional kafe, setiap aktivitas tersebut saling berkaitan. Ketika pelanggan memesan produk, kasir harus mencatat pesanan, menghitung total pembayaran, menerima pembayaran, dan meneruskan informasi pesanan kepada bagian barista atau kitchen.

Selain aktivitas penjualan, kafe juga perlu mengelola persediaan bahan baku. Setiap produk yang terjual dapat menggunakan beberapa jenis bahan baku dengan kuantitas tertentu sesuai resep.

Sebagai contoh, satu produk Cafe Latte membutuhkan:

- Espresso: 18 gram kopi.
- Fresh Milk: 150 ml.
- Gula: sesuai komposisi resep.

Apabila pengelolaan penjualan dan persediaan dilakukan secara terpisah, pemilik kafe akan mengalami kesulitan dalam mengetahui penggunaan bahan baku, ketersediaan stok, dan performa penjualan secara akurat.

Oleh karena itu, dibutuhkan sebuah aplikasi Point of Sale (POS) yang mengintegrasikan proses transaksi penjualan, pengelolaan pesanan, operasional kitchen/barista, dan pengendalian persediaan bahan baku dalam satu sistem.

## 1.2 Business Context

Sistem dirancang berdasarkan karakteristik bisnis berikut:

| Parameter            | Keputusan                |
| -------------------- | ------------------------ |
| Business Type        | Cafe                     |
| Business Scale       | Single Outlet            |
| Ordering Method      | Cashier Ordering         |
| Order Type           | Dine-in & Takeaway       |
| Payment Policy       | Pay Before Processing    |
| Payment Methods      | Cash, QRIS, Debit/Credit |
| Inventory Model      | Ingredient-based         |
| Order Processing     | Kitchen & Barista        |
| Development Approach | MVP                      |
| Deployment           | Centralized Application  |

## 1.3 Business Objectives

Tujuan bisnis yang ingin dicapai:

| ID    | Business Objective                                 | Expected Outcome                                  |
| ----- | -------------------------------------------------- | ------------------------------------------------- |
| BO-01 | Mengotomatisasi transaksi penjualan.               | Proses transaksi lebih cepat dan akurat.          |
| BO-02 | Mengintegrasikan pemesanan dengan kitchen/barista. | Mengurangi kesalahan komunikasi.                  |
| BO-03 | Mengintegrasikan penjualan dengan inventory.       | Penggunaan bahan baku dapat dilacak.              |
| BO-04 | Menyediakan laporan penjualan terpusat.            | Pemilik dapat memantau performa bisnis.           |
| BO-05 | Meningkatkan transparansi transaksi.               | Pembatalan dan perubahan transaksi dapat diaudit. |
| BO-06 | Menyederhanakan operasional kafe.                  | Mengurangi pekerjaan administratif manual.        |

## 1.4 Business Process Overview

Sistem akan mendukung siklus bisnis utama berikut:

\#chatgpt-mermaid-\_r_sa\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_sa\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_sa\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_sa\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_sa\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_sa\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_sa\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_sa\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_sa\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_sa\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_sa\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_sa\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_sa\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_sa\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:16px;}#chatgpt-mermaid-\_r_sa\_ p{margin:0;}#chatgpt-mermaid-\_r_sa\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_sa\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_sa\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_sa\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_sa\_ .label text,#chatgpt-mermaid-\_r_sa\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_sa\_ .node rect,#chatgpt-mermaid-\_r_sa\_ .node circle,#chatgpt-mermaid-\_r_sa\_ .node ellipse,#chatgpt-mermaid-\_r_sa\_ .node polygon,#chatgpt-mermaid-\_r_sa\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_sa\_ .rough-node .label text,#chatgpt-mermaid-\_r_sa\_ .node .label text,#chatgpt-mermaid-\_r_sa\_ .image-shape .label,#chatgpt-mermaid-\_r_sa\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_sa\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_sa\_ .rough-node .label,#chatgpt-mermaid-\_r_sa\_ .node .label,#chatgpt-mermaid-\_r_sa\_ .image-shape .label,#chatgpt-mermaid-\_r_sa\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_sa\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_sa\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_sa\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_sa\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_sa\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_sa\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_sa\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_sa\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_sa\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_sa\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_sa\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_sa\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_sa\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_sa\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_sa\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_sa\_ .icon-shape,#chatgpt-mermaid-\_r_sa\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_sa\_ .icon-shape p,#chatgpt-mermaid-\_r_sa\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_sa\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_sa\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_sa\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_sa\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_sa\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_sa\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_sa\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_sa\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_sa\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_sa\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_sa\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_sa\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_sa\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_sa\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_sa\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_sa\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_sa\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_sa\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_sa\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_sa\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_sa\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_sa\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_sa\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_sa\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_sa\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_sa\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_sa\_ .node rect,#chatgpt-mermaid-\_r_sa\_ .node circle,#chatgpt-mermaid-\_r_sa\_ .node ellipse,#chatgpt-mermaid-\_r_sa\_ .node polygon,#chatgpt-mermaid-\_r_sa\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_sa\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_sa\_ .mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2px,2px;}#chatgpt-mermaid-\_r_sa\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_sa\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_sa\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;}Customer ArrivesCustomer Selects MenuCashier Creates OrderCalculate Order TotalCustomer Makes PaymentPayment Successful?Confirm TransactionSend Order to Kitchen /BaristaPrepare OrderMark Items as ReadyDeliver OrderClose OrderRecord Ingredient UsageUpdate InventorySales ReportingBusiness Data UpdatedNoYes

Catatan desain: pembayaran merupakan prasyarat pemrosesan pesanan. Pencatatan penggunaan bahan baku harus dilakukan secara konsisten dan dapat dikoreksi ketika terjadi pembatalan atau refund.

# 2. User Identification & User Problems

## 2.1 Identifikasi Pengguna

Untuk MVP, sistem memiliki empat kelompok pengguna utama.

| User          | Role         | Primary Responsibility              |
| ------------- | ------------ | ----------------------------------- |
| Cashier       | Front Office | Mengelola pesanan dan pembayaran.   |
| Barista       | Production   | Menyiapkan minuman.                 |
| Kitchen Staff | Production   | Menyiapkan makanan.                 |
| Owner / Admin | Management   | Mengelola data dan memantau bisnis. |

Customer merupakan pengguna layanan kafe, tetapi tidak memiliki akses langsung ke aplikasi POS pada MVP.
MVP tidak menambahkan role Server khusus karena pelanggan mengambil pesanan di counter. Kasir atau staf yang sedang bertugas memantau antrean siap diambil dan mengonfirmasi pengambilan pelanggan.

## 2.2 User Problems

### A. Cashier

| ID        | Permasalahan                                                  | Dampak                                 |
| --------- | ------------------------------------------------------------- | -------------------------------------- |
| UP-CAS-01 | Pencatatan pesanan masih manual.                              | Risiko kesalahan input.                |
| UP-CAS-02 | Perhitungan total transaksi dilakukan manual.                 | Memperlambat pembayaran.               |
| UP-CAS-03 | Kesulitan mengetahui status pembayaran.                       | Risiko pesanan diproses sebelum lunas. |
| UP-CAS-04 | Informasi pesanan harus disampaikan ke kitchen secara manual. | Pesanan dapat terlewat.                |
| UP-CAS-05 | Kesulitan menemukan riwayat transaksi.                        | Rekonsiliasi menjadi sulit.            |

### B. Barista & Kitchen Staff

| ID        | Permasalahan                                              | Dampak                          |
| --------- | --------------------------------------------------------- | ------------------------------- |
| UP-KIT-01 | Tidak menerima informasi pesanan secara terpusat.         | Risiko pesanan tertukar.        |
| UP-KIT-02 | Detail modifier dan catatan pelanggan tidak tersampaikan. | Produk tidak sesuai permintaan. |
| UP-KIT-03 | Sulit menentukan urutan pengerjaan pesanan.               | Waktu tunggu meningkat.         |
| UP-KIT-04 | Status pengerjaan tidak dapat dipantau kasir.             | Koordinasi tidak efisien.       |

### C. Owner / Admin

| ID        | Permasalahan                                               | Dampak                               |
| --------- | ---------------------------------------------------------- | ------------------------------------ |
| UP-OWN-01 | Data penjualan tidak terpusat.                             | Sulit mengetahui omzet aktual.       |
| UP-OWN-02 | Tidak mengetahui penggunaan bahan baku berdasarkan resep.  | Stok tidak akurat.                   |
| UP-OWN-03 | Tidak memiliki informasi stok minimum.                     | Risiko kehabisan bahan.              |
| UP-OWN-04 | Kesulitan mengetahui produk terlaris.                      | Keputusan menu kurang berbasis data. |
| UP-OWN-05 | Tidak memiliki histori pembatalan dan perubahan transaksi. | Pengawasan operasional lemah.        |
| UP-OWN-06 | Rekap laporan memerlukan pekerjaan manual.                 | Waktu administratif meningkat.       |

### D. Customer

| ID        | Permasalahan                                    | Dampak                        |
| --------- | ----------------------------------------------- | ----------------------------- |
| UP-CUS-01 | Waktu pemesanan dan pembayaran cukup lama.      | Pengalaman pelanggan menurun. |
| UP-CUS-02 | Pesanan berisiko tidak sesuai permintaan.       | Keluhan pelanggan.            |
| UP-CUS-03 | Tidak mengetahui apakah pesanan sudah diproses. | Ketidakpastian waktu tunggu.  |

## 2.3 Core Problem Statement

Masalah utama:

Operasional kafe belum memiliki sistem terintegrasi yang menghubungkan proses pemesanan, pembayaran, produksi makanan/minuman, dan pengelolaan persediaan bahan baku.

Kondisi tersebut menyebabkan risiko kesalahan transaksi, kurangnya koordinasi antarbagian, ketidakakuratan stok, dan keterbatasan informasi bagi pemilik dalam memantau bisnis.

Proposed Solution:

Mengembangkan aplikasi Cafe POS yang mengintegrasikan seluruh proses operasional utama dalam satu platform, dengan pembayaran sebagai prasyarat pemrosesan pesanan serta pengelolaan stok bahan baku berbasis resep.

# 3. User Requirements (UR)

User Requirements menjelaskan apa yang dibutuhkan pengguna agar dapat menyelesaikan pekerjaannya menggunakan sistem POS.

Requirement berikut menggunakan ID unik agar dapat ditelusuri hingga Functional Requirements dan proses pengujian.

## 3.1 Cashier Requirements

| ID        | User Requirement                                                                 | Priority |
| --------- | -------------------------------------------------------------------------------- | -------- |
| UR-CAS-01 | Kasir dapat login menggunakan akun yang terdaftar.                               | Must     |
| UR-CAS-02 | Kasir dapat melihat daftar menu, kategori, dan harga.                            | Must     |
| UR-CAS-03 | Kasir dapat membuat pesanan baru.                                                | Must     |
| UR-CAS-04 | Kasir dapat memilih jenis pesanan dine-in atau takeaway.                         | Must     |
| UR-CAS-05 | Kasir dapat memilih nomor meja untuk pesanan dine-in.                            | Must     |
| UR-CAS-06 | Kasir dapat menambahkan beberapa produk dalam satu pesanan.                      | Must     |
| UR-CAS-07 | Kasir dapat menentukan variasi produk, topping, dan catatan pesanan.             | Must     |
| UR-CAS-08 | Kasir dapat mengubah atau menghapus item sebelum transaksi dikonfirmasi.         | Must     |
| UR-CAS-09 | Sistem menghitung subtotal, diskon, pajak, dan total pembayaran secara otomatis. | Must     |
| UR-CAS-10 | Kasir dapat memproses pembayaran sebelum pesanan diteruskan ke kitchen/barista.  | Must     |
| UR-CAS-11 | Sistem mendukung pembayaran tunai dan non-tunai.                                 | Must     |
| UR-CAS-12 | Kasir dapat melihat status pembayaran.                                           | Must     |
| UR-CAS-13 | Kasir dapat mencetak atau mengirim struk transaksi.                              | Must     |
| UR-CAS-14 | Kasir dapat melihat daftar dan histori transaksi.                                | Must     |
| UR-CAS-15 | Kasir dapat membatalkan transaksi sesuai otorisasi.                              | Must     |
| UR-CAS-16 | Kasir/staf bertugas dapat melihat pesanan siap diambil dan mengonfirmasi pengambilan pelanggan di counter. | Must |

## 3.2 Barista & Kitchen Requirements

| ID        | User Requirement                                                                   | Priority |
| --------- | ---------------------------------------------------------------------------------- | -------- |
| UR-KIT-01 | Barista dan kitchen dapat login sesuai akun masing-masing.                         | Must     |
| UR-KIT-02 | Barista dan kitchen dapat menerima pesanan yang sudah dibayar.                     | Must     |
| UR-KIT-03 | Sistem dapat memisahkan pesanan makanan dan minuman berdasarkan kategori produksi. | Must     |
| UR-KIT-04 | Pengguna dapat melihat detail produk, jumlah, modifier, dan catatan pesanan.       | Must     |
| UR-KIT-05 | Pengguna dapat melihat urutan antrean pesanan.                                     | Must     |
| UR-KIT-06 | Pengguna dapat mengubah status pesanan menjadi sedang diproses.                    | Must     |
| UR-KIT-07 | Pengguna dapat menandai item sebagai selesai disiapkan.                            | Must     |
| UR-KIT-08 | Pengguna dapat melihat pesanan yang telah diselesaikan.                            | Should   |

## 3.3 Owner / Admin Requirements

| ID        | User Requirement                                                 | Priority |
| --------- | ---------------------------------------------------------------- | -------- |
| UR-ADM-01 | Admin dapat mengelola akun dan role pengguna.                    | Must     |
| UR-ADM-02 | Admin dapat mengelola kategori produk.                           | Must     |
| UR-ADM-03 | Admin dapat mengelola produk, harga, dan status ketersediaan.    | Must     |
| UR-ADM-04 | Admin dapat mengelola variasi dan modifier produk.               | Should   |
| UR-ADM-05 | Admin dapat mengelola daftar bahan baku.                         | Must     |
| UR-ADM-06 | Admin dapat menentukan komposisi bahan baku untuk setiap produk. | Must     |
| UR-ADM-07 | Admin dapat mencatat penambahan stok bahan baku.                 | Must     |
| UR-ADM-08 | Admin dapat melakukan penyesuaian stok.                          | Must     |
| UR-ADM-09 | Admin dapat melihat histori pergerakan stok.                     | Must     |
| UR-ADM-10 | Admin dapat menentukan batas minimum stok.                       | Should   |
| UR-ADM-11 | Admin dapat melihat laporan penjualan.                           | Must     |
| UR-ADM-12 | Admin dapat melihat laporan penggunaan bahan baku.               | Must     |
| UR-ADM-13 | Admin dapat melihat produk terlaris.                             | Should   |
| UR-ADM-14 | Admin dapat melihat histori pembatalan transaksi.                | Must     |

## 3.4 Customer Requirements

Meskipun customer tidak berinteraksi langsung dengan aplikasi POS, sistem harus mendukung kebutuhan pelayanan pelanggan.

| ID        | User Requirement                                                  | Priority |
| --------- | ----------------------------------------------------------------- | -------- |
| UR-CUS-01 | Pelanggan mendapatkan informasi harga yang akurat.                | Must     |
| UR-CUS-02 | Pelanggan mendapatkan konfirmasi pesanan sebelum pembayaran.      | Must     |
| UR-CUS-03 | Pelanggan dapat melakukan pembayaran sebelum pesanan diproses.    | Must     |
| UR-CUS-04 | Pelanggan mendapatkan bukti pembayaran.                           | Must     |
| UR-CUS-05 | Pelanggan menerima pesanan sesuai item dan modifier yang dipilih. | Must     |

# 4. Functional Requirements (FR)

Functional Requirements menjelaskan perilaku dan fungsi yang wajib disediakan aplikasi untuk memenuhi User Requirements.

Saya membaginya menjadi delapan modul utama.

## 4.1 Authentication & User Management

| ID         | Functional Requirement                                                          | Related UR           |
| ---------- | ------------------------------------------------------------------------------- | -------------------- |
| FR-AUTH-01 | Sistem harus menyediakan halaman login menggunakan username/email dan password. | UR-CAS-01, UR-KIT-01 |
| FR-AUTH-02 | Sistem harus memvalidasi kredensial pengguna.                                   | UR-CAS-01            |
| FR-AUTH-03 | Sistem harus menyediakan role Cashier, Barista, Kitchen, dan Admin.             | UR-ADM-01            |
| FR-AUTH-04 | Sistem harus membatasi akses fitur berdasarkan role pengguna.                   | UR-ADM-01            |
| FR-AUTH-05 | Admin dapat membuat, mengubah, menonaktifkan, dan mengaktifkan akun pengguna.   | UR-ADM-01            |
| FR-AUTH-06 | Sistem harus mencatat pengguna yang melakukan perubahan transaksi penting.      | UR-ADM-14            |

## 4.2 Menu Management

| ID         | Functional Requirement                                                     | Related UR |
| ---------- | -------------------------------------------------------------------------- | ---------- |
| FR-MENU-01 | Sistem harus menyediakan CRUD kategori produk.                             | UR-ADM-02  |
| FR-MENU-02 | Sistem harus menyediakan CRUD produk.                                      | UR-ADM-03  |
| FR-MENU-03 | Setiap produk memiliki nama, kategori, harga, deskripsi, dan status aktif. | UR-ADM-03  |
| FR-MENU-04 | Sistem harus dapat mengatur produk yang tersedia atau tidak tersedia.      | UR-ADM-03  |
| FR-MENU-05 | Sistem harus menyediakan pengaturan modifier dan variasi produk.           | UR-ADM-04  |
| FR-MENU-06 | Sistem harus menampilkan menu aktif kepada kasir.                          | UR-CAS-02  |

## 4.3 Order Management

| ID        | Functional Requirement                                                                                            | Related UR           |
| --------- | ----------------------------------------------------------------------------------------------------------------- | -------------------- |
| FR-ORD-01 | Sistem harus dapat membuat transaksi baru dengan nomor order unik.                                                | UR-CAS-03            |
| FR-ORD-02 | Sistem harus menyediakan jenis pesanan Dine-in dan Takeaway.                                                      | UR-CAS-04            |
| FR-ORD-03 | Sistem harus menyediakan pemilihan meja untuk pesanan Dine-in.                                                    | UR-CAS-05            |
| FR-ORD-04 | Sistem harus mendukung beberapa item dalam satu order.                                                            | UR-CAS-06            |
| FR-ORD-05 | Sistem harus menyimpan kuantitas, harga, modifier, dan catatan setiap item.                                       | UR-CAS-07            |
| FR-ORD-06 | Sistem harus menghitung subtotal secara otomatis.                                                                 | UR-CAS-09            |
| FR-ORD-07 | Sistem harus menghitung diskon dan pajak berdasarkan konfigurasi.                                                 | UR-CAS-09            |
| FR-ORD-08 | Sistem harus menghitung total pembayaran secara otomatis.                                                         | UR-CAS-09            |
| FR-ORD-09 | Sistem harus mengizinkan perubahan item sebelum pembayaran berhasil.                                              | UR-CAS-08            |
| FR-ORD-10 | Sistem harus mengunci detail order setelah pembayaran berhasil, kecuali melalui proses koreksi yang terotorisasi. | UR-CAS-15            |
| FR-ORD-11 | Sistem harus mengirimkan order yang telah dibayar ke antrean kitchen/barista.                                     | UR-CAS-10, UR-KIT-02 |
| FR-ORD-12 | Sistem harus menyediakan histori dan pencarian transaksi.                                                         | UR-CAS-14            |
| FR-ORD-13 | Sistem harus mendukung pembatalan transaksi dengan alasan dan identitas pengguna.                                 | UR-CAS-15            |
| FR-ORD-14 | Sistem harus membuat satu tiket produksi untuk setiap stasiun yang memiliki item pada order induk yang sama.       | UR-CAS-10, UR-KIT-03 |
| FR-ORD-15 | Sistem hanya boleh mengubah status order menjadi Completed setelah pickup pelanggan dikonfirmasi di counter.       | UR-CAS-16            |

## 4.4 Payment Management

| ID        | Functional Requirement                                                                                    | Related UR           |
| --------- | --------------------------------------------------------------------------------------------------------- | -------------------- |
| FR-PAY-01 | Sistem harus menyediakan metode pembayaran Cash.                                                          | UR-CAS-11            |
| FR-PAY-02 | Sistem harus menyediakan metode pembayaran QRIS.                                                          | UR-CAS-11            |
| FR-PAY-03 | Sistem harus menyediakan metode pembayaran Debit/Credit.                                                  | UR-CAS-11            |
| FR-PAY-04 | Sistem harus menyimpan nominal yang harus dibayar.                                                        | UR-CAS-09            |
| FR-PAY-05 | Untuk pembayaran tunai, sistem harus menerima nominal uang pelanggan dan menghitung kembalian.            | UR-CAS-11            |
| FR-PAY-06 | Untuk pembayaran non-tunai, sistem harus mencatat referensi transaksi dan status konfirmasi pembayaran.   | UR-CAS-12            |
| FR-PAY-07 | Sistem hanya boleh mengubah status transaksi menjadi Paid setelah pembayaran terkonfirmasi.               | UR-CAS-10, UR-CAS-12 |
| FR-PAY-08 | Sistem harus mencegah pesanan dikirim ke kitchen/barista sebelum pembayaran berhasil.                     | UR-CAS-10            |
| FR-PAY-09 | Sistem harus menghasilkan bukti pembayaran.                                                               | UR-CAS-13            |
| FR-PAY-10 | Sistem harus mencegah pembayaran yang sama tercatat lebih dari satu kali akibat pengiriman ulang request. | UR-CAS-12            |

## 4.5 Kitchen & Barista Management

| ID        | Functional Requirement                                                                    | Related UR           |
| --------- | ----------------------------------------------------------------------------------------- | -------------------- |
| FR-KIT-01 | Sistem harus menyediakan tampilan Kitchen Display System (KDS).                           | UR-KIT-02            |
| FR-KIT-02 | Sistem harus mengirimkan order yang telah dibayar ke KDS.                                 | UR-KIT-02            |
| FR-KIT-03 | Sistem harus memisahkan antrean makanan dan minuman berdasarkan konfigurasi produk.       | UR-KIT-03            |
| FR-KIT-04 | KDS harus menampilkan nomor order, waktu masuk, produk, kuantitas, modifier, dan catatan. | UR-KIT-04            |
| FR-KIT-05 | Sistem harus mengurutkan antrean berdasarkan waktu order masuk.                           | UR-KIT-05            |
| FR-KIT-06 | Pengguna dapat mengubah status tiket stasiunnya menjadi Preparing.                        | UR-KIT-06            |
| FR-KIT-07 | Pengguna dapat menandai tiket stasiunnya sebagai Ready setelah item di tiket selesai.      | UR-KIT-07            |
| FR-KIT-08 | Sistem harus memperbarui status tiket dan order secara real-time pada layar terkait.       | UR-KIT-06, UR-KIT-07 |
| FR-KIT-09 | Sistem harus menyediakan histori order yang telah selesai.                                | UR-KIT-08            |
| FR-KIT-10 | Setiap stasiun menerima tiket terpisah yang mempertahankan nomor order, item, modifier, dan catatan induk. | UR-KIT-02, UR-KIT-04 |
| FR-KIT-11 | Status order menjadi Ready for pickup hanya setelah seluruh tiket stasiun berstatus Ready. | UR-KIT-07            |
| FR-KIT-12 | Status Ready for pickup harus tetap terpisah dari Completed sampai pickup pelanggan dikonfirmasi kasir/staf. | UR-CAS-16 |

## 4.6 Inventory & Recipe Management

Modul ini merupakan salah satu bagian terpenting dalam rancangan POS karena pengelolaan stok dilakukan berdasarkan bahan baku, bukan hanya jumlah produk jadi.

[Smiling Asian woman barista preparing fresh coffee in a modern cafe,  service, hospitality, coffee and small business lifestyle.](https://images.openai.com/static-rsc-4/96s3qb7C5H8nbd_q52hHO1Z3WxJk-nkanaxAZPj4IhkRaff-pDMDcai3-UtIVNlwphGXFS30qLyLyrgXhThVDH7aP41P4rERscHcmmnuq__0eo7kpt6UgJyUwryL920yZYM54sB9anBlrpD4fhHdwQfMAth2YhfKqyutdHLCLoH-Dy_ZQkn4ZJ-HZh04zZot?purpose=inline)

| ID        | Functional Requirement                                                                   | Related UR           |
| --------- | ---------------------------------------------------------------------------------------- | -------------------- |
| FR-INV-01 | Sistem harus menyediakan CRUD data bahan baku.                                           | UR-ADM-05            |
| FR-INV-02 | Setiap bahan baku harus memiliki nama, satuan, dan jumlah stok.                          | UR-ADM-05            |
| FR-INV-03 | Sistem harus mendukung satuan seperti gram, kilogram, ml, liter, dan pcs.                | UR-ADM-05            |
| FR-INV-04 | Sistem harus menyediakan konfigurasi resep untuk setiap produk.                          | UR-ADM-06            |
| FR-INV-05 | Satu resep dapat menggunakan beberapa jenis bahan baku.                                  | UR-ADM-06            |
| FR-INV-06 | Sistem harus mencatat penambahan stok bahan baku.                                        | UR-ADM-07            |
| FR-INV-07 | Sistem harus mengurangi stok sesuai resep dan kuantitas item ketika tiket stasiun terkait mulai diproduksi. | UR-ADM-06 |
| FR-INV-08 | Sistem harus mencatat setiap pergerakan stok.                                            | UR-ADM-09            |
| FR-INV-09 | Sistem harus mendukung penyesuaian stok dengan alasan dan identitas pengguna.            | UR-ADM-08            |
| FR-INV-10 | Sistem harus menyediakan informasi stok minimum.                                         | UR-ADM-10            |
| FR-INV-11 | Sistem harus menyediakan laporan penggunaan bahan baku berdasarkan periode.              | UR-ADM-12            |
| FR-INV-12 | Sistem harus mencegah penjualan apabila kebutuhan bahan baku tidak mencukupi.            | UR-ADM-05, UR-CAS-03 |
| FR-INV-13 | Sistem harus mereservasi seluruh kebutuhan resep saat pembayaran berhasil dan mencatat Stock Out per tiket saat produksi stasiun dimulai. | UR-ADM-06, UR-ADM-09 |
| FR-INV-14 | Pembatalan harus melepaskan reservasi tiket yang belum mulai diproduksi tanpa mengembalikan bahan tiket yang sudah mulai. | UR-CAS-15, UR-ADM-09 |

Contoh mekanisme pengurangan stok:

Misalnya, pelanggan membeli 2 Cafe Latte.

| Bahan baku   | Kebutuhan per produk | Total penggunaan |
| ------------ | -------------------- | ---------------- |
| Coffee Beans | 18 gram              | 36 gram          |
| Fresh Milk   | 150 ml               | 300 ml           |
| Sugar        | 10 gram              | 20 gram          |

Jika stok awal adalah 1.000 gram coffee beans, setelah pembayaran `On Hand` tetap 1.000 gram, `Reserved` menjadi 36 gram, dan stok tersedia 964 gram. Saat tiket Barista mulai diproduksi, 36 gram dicatat sebagai `Stock Out`: `On Hand` menjadi 964 gram dan reservasi menjadi nol.

## 4.7 Reporting & Dashboard

| ID        | Functional Requirement                                            | Related UR |
| --------- | ----------------------------------------------------------------- | ---------- |
| FR-REP-01 | Sistem harus menyediakan dashboard penjualan.                     | UR-ADM-11  |
| FR-REP-02 | Sistem harus menampilkan total transaksi dan omzet.               | UR-ADM-11  |
| FR-REP-03 | Sistem harus menyediakan filter laporan berdasarkan tanggal.      | UR-ADM-11  |
| FR-REP-04 | Sistem harus menampilkan penjualan berdasarkan metode pembayaran. | UR-ADM-11  |
| FR-REP-05 | Sistem harus menampilkan produk terlaris.                         | UR-ADM-13  |
| FR-REP-06 | Sistem harus menampilkan laporan penggunaan bahan baku.           | UR-ADM-12  |
| FR-REP-07 | Sistem harus menyediakan laporan transaksi yang dibatalkan.       | UR-ADM-14  |

## 4.8 Receipt & Transaction History

| ID        | Functional Requirement                                                                   | Related UR |
| --------- | ---------------------------------------------------------------------------------------- | ---------- |
| FR-REC-01 | Sistem harus menghasilkan struk dengan nomor transaksi unik.                             | UR-CAS-13  |
| FR-REC-02 | Struk harus menampilkan tanggal, produk, kuantitas, harga, total, dan metode pembayaran. | UR-CAS-13  |
| FR-REC-03 | Sistem harus mendukung pencetakan struk melalui printer thermal.                         | UR-CAS-13  |
| FR-REC-04 | Sistem harus menyediakan akses ke detail transaksi sebelumnya.                           | UR-CAS-14  |
| FR-REC-05 | Sistem harus menyimpan histori transaksi secara permanen sesuai kebijakan retensi data.  | UR-CAS-14  |

# 5. Business Rules (BR)

Business Rules merupakan aturan operasional yang harus dipatuhi sistem. Bagian ini sangat penting karena menentukan bagaimana aplikasi berperilaku ketika menghadapi kondisi tertentu.

| ID    | Business Rule                                                                  | Keterangan                                          |
| ----- | ------------------------------------------------------------------------------ | --------------------------------------------------- |
| BR-01 | Setiap order harus memiliki nomor unik.                                        | Tidak boleh ada nomor transaksi duplikat.           |
| BR-02 | Setiap order harus memiliki jenis pesanan.                                     | Dine-in atau Takeaway.                              |
| BR-03 | Order Dine-in harus memiliki nomor meja.                                       | Meja harus tersedia.                                |
| BR-04 | Pembayaran wajib dilakukan sebelum order diproses.                             | Prepaid policy.                                     |
| BR-05 | Order hanya dapat dikirim ke KDS setelah pembayaran berhasil.                  | Mencegah pesanan belum lunas diproses.              |
| BR-06 | Harga produk harus disimpan sebagai snapshot pada saat transaksi.              | Perubahan harga menu tidak mengubah transaksi lama. |
| BR-07 | Stok bahan baku dihitung berdasarkan resep.                                    | Bukan berdasarkan jumlah produk saja.               |
| BR-08 | Stok tidak boleh menjadi negatif akibat transaksi normal.                      | Harus ada validasi stok.                            |
| BR-09 | Setiap perubahan stok harus menghasilkan inventory transaction.                | Audit stok.                                         |
| BR-10 | Pembatalan order harus memiliki alasan.                                        | Untuk kebutuhan audit.                              |
| BR-11 | Refund harus terhubung dengan transaksi pembayaran asal.                       | Memudahkan rekonsiliasi.                            |
| BR-12 | Hanya pengguna yang berwenang dapat melakukan pembatalan dan penyesuaian stok. | Pengendalian akses.                                 |
| BR-13 | Order yang sudah selesai tidak boleh diedit secara langsung.                   | Koreksi dilakukan melalui mekanisme khusus.         |
| BR-14 | Semua waktu transaksi menggunakan zona waktu outlet.                           | Konsistensi laporan.                                |
| BR-15 | Satu order induk memiliki satu pembayaran; item dapat dirutekan ke tiket Kitchen dan Barista dengan nomor order yang sama. | Menjaga transaksi dan pickup tetap terpadu. |
| BR-16 | Order berstatus Ready for pickup hanya jika semua tiket stasiun sudah Ready.    | Tidak ada serah-terima sebagian pada MVP.            |
| BR-17 | Order baru berstatus Completed setelah kasir/staf mengonfirmasi pelanggan mengambilnya di counter. | Ready for pickup bukan Completed. |

## 5.1 Order Status Lifecycle

Status pesanan perlu didefinisikan secara eksplisit agar semua bagian menggunakan referensi status yang sama.

\#chatgpt-mermaid-\_r_ss\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_ss\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_ss\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_ss\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_ss\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ss\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_ss\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_ss\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_ss\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_ss\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_ss\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_ss\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_ss\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_ss\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:16px;}#chatgpt-mermaid-\_r_ss\_ p{margin:0;}#chatgpt-mermaid-\_r_ss\_ defs [id$="-barbEnd"]{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_ss\_ g.stateGroup text{fill:rgb(31, 78, 148);stroke:none;font-size:10px;}#chatgpt-mermaid-\_r_ss\_ g.stateGroup text{fill:rgb(237, 237, 237);stroke:none;font-size:10px;}#chatgpt-mermaid-\_r_ss\_ g.stateGroup .state-title{font-weight:bolder;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ss\_ g.stateGroup rect{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_ss\_ g.stateGroup line{stroke:rgb(175, 175, 175);stroke-width:1;}#chatgpt-mermaid-\_r_ss\_ .transition{stroke:rgb(175, 175, 175);stroke-width:1;fill:none;}#chatgpt-mermaid-\_r_ss\_ .stateGroup .composit{fill:transparent;border-bottom:1px;}#chatgpt-mermaid-\_r_ss\_ .stateGroup .alt-composit{fill:#e0e0e0;border-bottom:1px;}#chatgpt-mermaid-\_r_ss\_ .state-note{stroke:rgb(58, 132, 63);fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_ss\_ .state-note text{fill:rgb(237, 237, 237);stroke:none;font-size:10px;}#chatgpt-mermaid-\_r_ss\_ .stateLabel .box{stroke:none;stroke-width:0;fill:rgb(9, 23, 44);opacity:0.5;}#chatgpt-mermaid-\_r_ss\_ .edgeLabel .label rect{fill:rgb(9, 23, 44);opacity:0.5;}#chatgpt-mermaid-\_r_ss\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_ss\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_ss\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_ss\_ .edgeLabel .label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ss\_ .label div .edgeLabel{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ss\_ .stateLabel text{fill:rgb(237, 237, 237);font-size:10px;font-weight:bold;}#chatgpt-mermaid-\_r_ss\_ .node circle.state-start{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_ss\_ .node .fork-join{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_ss\_ .node circle.state-end{fill:rgb(31, 78, 148);stroke:transparent;stroke-width:1.5;}#chatgpt-mermaid-\_r_ss\_ .end-state-inner{fill:transparent;stroke-width:1.5;}#chatgpt-mermaid-\_r_ss\_ .node rect{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_ss\_ .node polygon{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_ss\_ [id$="-barbEnd"]{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_ss\_ .statediagram-cluster rect{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_ss\_ .cluster-label,#chatgpt-mermaid-\_r_ss\_ .nodeLabel{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ss\_ .statediagram-cluster rect.outer{rx:5px;ry:5px;}#chatgpt-mermaid-\_r_ss\_ .statediagram-state .divider{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_ss\_ .statediagram-state .title-state{rx:5px;ry:5px;}#chatgpt-mermaid-\_r_ss\_ .statediagram-cluster.statediagram-cluster .inner{fill:transparent;}#chatgpt-mermaid-\_r_ss\_ .statediagram-cluster.statediagram-cluster-alt .inner{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_ss\_ .statediagram-cluster .inner{rx:0;ry:0;}#chatgpt-mermaid-\_r_ss\_ .statediagram-state rect.basic{rx:5px;ry:5px;}#chatgpt-mermaid-\_r_ss\_ .statediagram-state rect.divider{stroke-dasharray:10,10;fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_ss\_ .note-edge{stroke-dasharray:5;}#chatgpt-mermaid-\_r_ss\_ .statediagram-note rect{fill:rgb(48, 48, 48);stroke:rgb(58, 132, 63);stroke-width:1px;rx:0;ry:0;}#chatgpt-mermaid-\_r_ss\_ .statediagram-note rect{fill:rgb(48, 48, 48);stroke:rgb(58, 132, 63);stroke-width:1px;rx:0;ry:0;}#chatgpt-mermaid-\_r_ss\_ .statediagram-note text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ss\_ .statediagram-note .nodeLabel{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ss\_ .statediagram .edgeLabel{color:red;}#chatgpt-mermaid-\_r_ss\_ [id$="-dependencyStart"],#chatgpt-mermaid-\_r_ss\_ [id$="-dependencyEnd"]{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);stroke-width:1;}#chatgpt-mermaid-\_r_ss\_ .statediagramTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_ss\_ [data-look="neo"].statediagram-cluster rect{fill:rgb(9, 23, 44);stroke:url(#chatgpt-mermaid-\_r_ss\_-gradient);stroke-width:1;}#chatgpt-mermaid-\_r_ss\_ [data-look="neo"].statediagram-cluster rect.outer{rx:5px;ry:5px;filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_ss\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_ss\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_ss\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_ss\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_ss\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_ss\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_ss\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_ss\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_ss\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_ss\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_ss\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_ss\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_ss\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_ss\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_ss\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_ss\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_ss\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_ss\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;}DraftPendingPaymentPaidCancelledQueuedPreparingReadyCompletedPayment confirmedCancel / timeoutSend to KDSProduction startedPreparation completedOrder handed overCancel orderAuthorized cancellationAuthorized cancellationExceptional cancellation

Status pembayaran dan status produksi sebaiknya disimpan secara terpisah.

Contohnya:

| Payment Status | Order Status    |
| -------------- | --------------- |
| Pending        | Pending Payment |
| Paid           | Queued          |
| Paid           | Preparing       |
| Paid           | Ready for pickup |
| Paid           | Completed       |
| Refunded       | Cancelled       |

`Ready for pickup` berarti semua stasiun selesai dan pelanggan sedang menunggu di counter. `Completed` berarti pickup telah dikonfirmasi oleh kasir/staf. Dengan pemisahan tersebut, sistem dapat membedakan kondisi pembayaran, produksi, dan serah-terima.

## 5.2 Inventory Transaction Lifecycle

Untuk menghindari stok tidak akurat, saya merekomendasikan pendekatan berikut untuk MVP:

1. Ketika pembayaran berhasil, sistem melakukan validasi stok dan reservasi seluruh kebutuhan bahan baku untuk order.
2. Setiap stasiun menerima tiketnya sendiri. Ketika sebuah tiket mulai diproduksi, hanya bahan untuk item pada tiket itu yang berpindah dari reservasi menjadi penggunaan aktual (`Stock Out`).
3. Jika order dibatalkan sebelum ada tiket mulai diproduksi, seluruh reservasi dikembalikan. Jika sebagian produksi sudah dimulai, reservasi tiket yang belum dimulai dikembalikan; bahan untuk tiket yang sudah dimulai tidak dikembalikan.
4. Pembatalan setelah produksi dimulai memerlukan otorisasi, alasan, refund yang terhubung ke pembayaran asal, dan pencatatan waste/koreksi khusus.

Contoh pergerakan stok:

| Event                              | Inventory Movement   |
| ---------------------------------- | -------------------- |
| Pembelian bahan baku               | Stock In             |
| Order dibayar dan stok direservasi | Stock Reserved       |
| Tiket stasiun mulai diproduksi      | Stock Out per tiket  |
| Tiket belum dimulai dibatalkan      | Reservation Released |
| Stock opname                       | Stock Adjustment     |

Pemisahan antara reservasi dan penggunaan aktual akan menghindari penghitungan stok yang keliru ketika terdapat pesanan yang dibatalkan.

# 6. Non-Functional Requirements (NFR)

Selain fungsi utama, sistem harus memenuhi persyaratan kualitas berikut.

| ID     | Category        | Requirement                                                                                    |
| ------ | --------------- | ---------------------------------------------------------------------------------------------- |
| NFR-01 | Performance     | Halaman POS harus memberikan respons maksimal 2 detik pada 95% request normal.                 |
| NFR-02 | Real-time       | Perubahan status order harus diterima perangkat terkait maksimal 3 detik pada jaringan normal. |
| NFR-03 | Availability    | Sistem ditargetkan memiliki availability minimal 99,5% selama jam operasional.                 |
| NFR-04 | Security        | Password harus disimpan menggunakan algoritma hashing yang aman.                               |
| NFR-05 | Authorization   | Setiap role hanya dapat mengakses fungsi yang diizinkan.                                       |
| NFR-06 | Integrity       | Proses pembayaran dan pencatatan stok harus menggunakan transaksi database yang konsisten.     |
| NFR-07 | Reliability     | Request pembayaran dan pembuatan order harus memiliki mekanisme idempotency.                   |
| NFR-08 | Usability       | Antarmuka POS harus sederhana dan dapat digunakan tanpa pelatihan teknis mendalam.             |
| NFR-09 | Maintainability | Struktur aplikasi harus modular dan mudah dikembangkan.                                        |
| NFR-10 | Backup          | Database harus memiliki backup terjadwal dan prosedur restore.                                 |
| NFR-11 | Auditability    | Perubahan transaksi, stok, dan konfigurasi penting harus tercatat.                             |
| NFR-12 | Compatibility   | Aplikasi dapat digunakan melalui browser desktop dan tablet.                                   |

Angka di atas merupakan target awal yang perlu diverifikasi melalui pengujian performa dan kondisi infrastruktur aktual.

# 7. MVP Scope Definition

Untuk menjaga agar pengembangan tidak melebar, berikut batasan ruang lingkup MVP.

## 7.1 In Scope

Included in MVP

| Modul          | Fitur                                          |
| -------------- | ---------------------------------------------- |
| Authentication | Login, logout, role management                 |
| Menu           | Kategori, produk, harga, modifier dasar        |
| Order          | Dine-in, takeaway, order items                 |
| Payment        | Cash, QRIS, debit/kredit                       |
| Kitchen        | KDS per stasiun, antrean, status produksi, dan sinkronisasi Ready for pickup |
| Inventory      | Ingredients, recipes, stock in/out             |
| Reporting      | Sales report, payment report, inventory report |
| Receipt        | Thermal printer, transaction receipt           |
| Audit          | Transaction history, stock movement            |

Pickup ditangani kasir/staf yang bertugas di counter; tidak ada role Server khusus pada MVP.

## 7.2 Out of Scope

Not Included in MVP

| Fitur                            | Alasan                                   |
| -------------------------------- | ---------------------------------------- |
| Multi-branch management          | Target hanya satu outlet.                |
| Customer self-order QR           | Pemesanan hanya melalui kasir.           |
| Customer mobile application      | Tidak diperlukan untuk operasional awal. |
| Loyalty & membership             | Bukan kebutuhan utama MVP.               |
| Online food delivery integration | Memerlukan integrasi pihak ketiga.       |
| Advanced CRM                     | Dapat dikembangkan kemudian.             |
| AI sales forecasting             | Membutuhkan histori data yang memadai.   |
| Supplier procurement automation  | Fokus awal pada pencatatan stok.         |
| Advanced accounting              | Di luar ruang lingkup operasional POS.   |
| Role Server khusus dan layanan antar meja | Pelanggan mengambil pesanan di counter pada MVP. |

# 8. Acceptance Criteria

Acceptance criteria digunakan untuk menentukan kapan suatu fitur dianggap berhasil dikembangkan.

| ID    | Scenario                                          | Expected Result                                          |
| ----- | ------------------------------------------------- | -------------------------------------------------------- |
| AC-01 | Kasir membuat order baru.                         | Order berhasil dibuat dengan nomor unik.                 |
| AC-02 | Kasir memilih beberapa menu.                      | Total dihitung otomatis dengan benar.                    |
| AC-03 | Pelanggan belum membayar.                         | Order tidak muncul di antrean produksi.                  |
| AC-04 | Pembayaran berhasil.                              | Status pembayaran menjadi Paid.                          |
| AC-05 | Pembayaran berhasil.                              | Order diteruskan ke KDS.                                 |
| AC-06 | Barista memulai pekerjaan.                        | Status berubah menjadi Preparing.                        |
| AC-07 | Barista menyelesaikan minuman.                    | Item berubah menjadi Ready.                              |
| AC-08 | Order memiliki beberapa item dari bagian berbeda. | Setiap bagian menerima item yang sesuai.                 |
| AC-09 | Produk menggunakan bahan baku tertentu.           | Penggunaan stok dihitung sesuai resep.                   |
| AC-10 | Stok bahan baku tidak mencukupi.                  | Sistem menolak transaksi yang membutuhkan stok tersebut. |
| AC-11 | Order dibatalkan sebelum produksi.                | Reservasi stok dikembalikan.                             |
| AC-12 | Owner membuka laporan penjualan.                  | Total transaksi dan omzet sesuai data transaksi.         |
| AC-13 | Admin melakukan penyesuaian stok.                 | Perubahan tercatat dalam inventory history.              |
| AC-14 | Kasir mencetak struk.                             | Struk menampilkan detail pembayaran yang benar.          |
| AC-15 | Order berisi makanan dan minuman berhasil dibayar. | Kitchen dan Barista menerima tiket terpisah dengan nomor order induk yang sama. |
| AC-16 | Satu tiket stasiun siap, tetapi tiket lain belum. | Order belum masuk antrean Ready for pickup.               |
| AC-17 | Semua tiket stasiun berstatus Ready.              | Order berubah menjadi Ready for pickup, belum Completed.  |
| AC-18 | Pelanggan mengambil pesanan di counter.            | Kasir/staf mengonfirmasi pickup dan order menjadi Completed. |
| AC-19 | Satu tiket mulai diproduksi.                       | Hanya resep item tiket tersebut menjadi Stock Out; reservasi tiket lain tetap ada. |
| AC-20 | Order dibatalkan setelah sebagian tiket dimulai.  | Reservasi tiket yang belum dimulai dilepas; bahan tiket yang sudah dimulai tidak dikembalikan. |

# 9. Requirement Traceability Matrix

Traceability Matrix memastikan bahwa setiap permasalahan pengguna memiliki kebutuhan dan implementasi yang jelas.

| Problem   | User Requirement     | Functional Module    |
| --------- | -------------------- | -------------------- |
| UP-CAS-01 | UR-CAS-03            | Order Management     |
| UP-CAS-02 | UR-CAS-09            | Order Management     |
| UP-CAS-03 | UR-CAS-10, UR-CAS-12 | Payment Management   |
| UP-CAS-04 | UR-KIT-02            | Kitchen Management   |
| UP-KIT-01 | UR-KIT-02, UR-KIT-03 | Kitchen Management   |
| UP-KIT-04 | UR-KIT-06, UR-KIT-07 | Kitchen Management   |
| UP-OWN-01 | UR-ADM-11            | Reporting            |
| UP-OWN-02 | UR-ADM-06, UR-ADM-12 | Inventory Management |
| UP-OWN-03 | UR-ADM-10            | Inventory Management |
| UP-OWN-04 | UR-ADM-13            | Reporting            |
| UP-OWN-05 | UR-ADM-14            | Audit Management     |
| UP-CUS-02 | UR-CUS-05            | Order Management     |

Matriks ini dapat dikembangkan menjadi hubungan satu-ke-banyak antara Problem, User Requirement, Functional Requirement, dan Test Case.

# 10. Rekomendasi Struktur Modul Aplikasi

Berdasarkan seluruh requirement, berikut struktur modul aplikasi yang disarankan.

\#chatgpt-mermaid-\_r_t4\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_t4\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_t4\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_t4\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_t4\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_t4\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_t4\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_t4\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_t4\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_t4\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_t4\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_t4\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_t4\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_t4\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:16px;}#chatgpt-mermaid-\_r_t4\_ p{margin:0;}#chatgpt-mermaid-\_r_t4\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_t4\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_t4\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_t4\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_t4\_ .label text,#chatgpt-mermaid-\_r_t4\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_t4\_ .node rect,#chatgpt-mermaid-\_r_t4\_ .node circle,#chatgpt-mermaid-\_r_t4\_ .node ellipse,#chatgpt-mermaid-\_r_t4\_ .node polygon,#chatgpt-mermaid-\_r_t4\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_t4\_ .rough-node .label text,#chatgpt-mermaid-\_r_t4\_ .node .label text,#chatgpt-mermaid-\_r_t4\_ .image-shape .label,#chatgpt-mermaid-\_r_t4\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_t4\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_t4\_ .rough-node .label,#chatgpt-mermaid-\_r_t4\_ .node .label,#chatgpt-mermaid-\_r_t4\_ .image-shape .label,#chatgpt-mermaid-\_r_t4\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_t4\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_t4\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_t4\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_t4\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_t4\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_t4\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_t4\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_t4\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_t4\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_t4\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_t4\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_t4\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_t4\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_t4\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_t4\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_t4\_ .icon-shape,#chatgpt-mermaid-\_r_t4\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_t4\_ .icon-shape p,#chatgpt-mermaid-\_r_t4\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_t4\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_t4\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_t4\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_t4\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_t4\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_t4\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_t4\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_t4\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_t4\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_t4\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_t4\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_t4\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_t4\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_t4\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_t4\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_t4\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_t4\_ .node rect,#chatgpt-mermaid-\_r_t4\_ .node circle,#chatgpt-mermaid-\_r_t4\_ .node ellipse,#chatgpt-mermaid-\_r_t4\_ .node polygon,#chatgpt-mermaid-\_r_t4\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_t4\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_t4\_ .mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2px,2px;}#chatgpt-mermaid-\_r_t4\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_t4\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_t4\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;}Cafe POS SystemFront OfficeBack OfficeManagementOrder ManagementPayment ManagementReceipt ManagementMenu ManagementTable ManagementKitchen Display SystemInventory ManagementRecipe ManagementUser ManagementReporting & DashboardAudit LogCentral Database

## 10.1 Prioritas Implementasi

Saya menyarankan urutan development berikut:

| Phase | Modul                            | Dependency |
| ----- | -------------------------------- | ---------- |
| 1     | Authentication & User Management | -          |
| 2     | Menu Management                  | Phase 1    |
| 3     | Order Management                 | Phase 1–2  |
| 4     | Payment Management               | Phase 3    |
| 5     | Kitchen Display System           | Phase 3–4  |
| 6     | Recipe & Inventory Management    | Phase 2–4  |
| 7     | Receipt & Transaction History    | Phase 4    |
| 8     | Dashboard & Reporting            | Phase 3–7  |

# 11. Kesimpulan Analisis

Project Definition

Pengembangan aplikasi Cafe POS MVP yang berfungsi sebagai sistem terintegrasi untuk mengelola transaksi penjualan, pemrosesan pesanan, pembayaran, dan persediaan bahan baku pada satu outlet kafe.

Core Business Flow

Cashier Ordering → Payment Confirmation → Kitchen/Barista Processing → Order Completion → Inventory Tracking → Business Reporting.

Core Modules: 8 modul utama.

Primary Users: Cashier, Barista, Kitchen Staff, Owner/Admin.

## 12. Langkah Selanjutnya dalam Software Development

Setelah dokumen analisis kebutuhan ini, saya merekomendasikan melanjutkan ke tahap System Design.

Urutan dokumentasi berikutnya:

1. Use Case Diagram

   Menggambarkan interaksi setiap aktor dengan sistem dan hak aksesnya.
2. Activity Diagram

   Menggambarkan detail alur aktivitas, khususnya Order, Payment, Kitchen, dan Inventory.
3. Entity Relationship Diagram (ERD)

   Merancang struktur database, tabel, primary key, foreign key, dan relasi.
4. System Architecture

   Menentukan arsitektur frontend, backend, database, komunikasi real-time, dan integrasi pembayaran.
5. API Specification

   Mendefinisikan endpoint, request, response, validasi, dan authorization.
6. UI/UX Wireframe

   Mendesain tampilan POS Cashier, KDS, dan Admin Dashboard.
7. Development & Testing

   Implementasi berdasarkan requirement dan acceptance criteria.

Rekomendasi saya: Tahap berikutnya sebaiknya adalah Use Case Diagram dan Activity Diagram sebelum membuat ERD. Kita perlu memastikan semua proses bisnis sudah benar terlebih dahulu, khususnya hubungan antara pembayaran, antrean produksi, dan pengurangan stok bahan baku.

Dokumen ini dapat dijadikan baseline requirement versi 1.0. Perubahan berikutnya sebaiknya dicatat sebagai revisi agar kebutuhan bisnis dan implementasi tetap sinkron.