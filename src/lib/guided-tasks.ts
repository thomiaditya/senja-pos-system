import type { AppSection } from "@/lib/app-routes";
import type { UserRole } from "@/lib/types";

export type GuidedStep = {
  section: AppSection;
  target: string;
  title: string;
  description: string;
};

export type GuidedTask = {
  id: string;
  title: string;
  summary: string;
  roles: UserRole[];
  steps: GuidedStep[];
};

const staff: UserRole[] = ["admin", "cashier"];
const admin: UserRole[] = ["admin"];
const stations: UserRole[] = ["barista", "kitchen"];

export const guidedTasks: GuidedTask[] = [
  {
    id: "layani-pelanggan",
    title: "Layani pelanggan dan bayar",
    summary: "Pilih menu, cek keranjang, lalu terima pembayaran.",
    roles: staff,
    steps: [
      { section: "kasir", target: "cashier-menu", title: "Pilih menu", description: "Ketuk produk pesanan pelanggan untuk memasukkannya ke keranjang." },
      { section: "kasir", target: "cashier-cart", title: "Cek keranjang", description: "Pilih Dine-in atau Take away. Untuk Dine-in, pilih meja lebih dulu." },
      { section: "kasir", target: "cashier-checkout", title: "Terima pembayaran", description: "Isi nama pelanggan, pilih metode bayar, lalu pilih diskon bila ada." },
    ],
  },
  {
    id: "buka-tab-meja",
    title: "Buka tab meja",
    summary: "Untuk pelanggan yang membayar di akhir kunjungan.",
    roles: staff,
    steps: [
      { section: "kasir", target: "cashier-cart", title: "Pilih meja", description: "Pilih Dine-in lalu meja pelanggan. Meja harus kosong dari pesanan biasa." },
      { section: "kasir", target: "cashier-tab", title: "Buka tab", description: "Isi nama pelanggan, lalu buka tab. Tab dibayar sekali saat ditutup, dan pesanan berikutnya bisa ditambahkan ke tab ini." },
    ],
  },
  {
    id: "ajukan-pembatalan",
    title: "Ajukan pembatalan",
    summary: "Minta SPV menyetujui pembatalan pesanan.",
    roles: staff,
    steps: [
      { section: "pesanan", target: "orders-board", title: "Pilih pesanan", description: "Pada kartu pesanan yang ingin dibatalkan, pilih Ajukan pembatalan. Tulis alasannya agar SPV mudah memutuskan." },
    ],
  },
  {
    id: "setujui-pembatalan",
    title: "Setujui pembatalan",
    summary: "Putuskan pengajuan pembatalan dari kasir.",
    roles: admin,
    steps: [
      { section: "pesanan", target: "orders-board", title: "Periksa pengajuan", description: "Pengajuan dari kasir muncul di panel pengajuan. Setujui untuk membatalkan dan merefund otomatis, atau tolak dengan alasan." },
    ],
  },
  {
    id: "buka-shift",
    title: "Buka shift kas",
    summary: "Catat uang awal laci sebelum mulai melayani.",
    roles: staff,
    steps: [
      { section: "kas", target: "cash-shift", title: "Catat uang awal", description: "Masukkan jumlah uang awal yang ada di laci saat shift dimulai." },
      { section: "kas", target: "cash-drawer", title: "Buka laci", description: "Laci bisa dibuka dari sini selama printer thermal terhubung." },
    ],
  },
  {
    id: "tutup-shift",
    title: "Tutup shift kas",
    summary: "Hitung uang fisik laci dan tutup shift.",
    roles: staff,
    steps: [
      { section: "kas", target: "cash-shift", title: "Hitung laci", description: "Hitung uang fisik di laci, lalu isi jumlahnya saat menutup shift. Selisih dengan sistem akan tercatat." },
    ],
  },
  {
    id: "catat-pengeluaran",
    title: "Catat pengeluaran",
    summary: "Catat belanja harian dari laci kasir.",
    roles: staff,
    steps: [
      { section: "kas", target: "cash-expenses", title: "Catat belanja", description: "Isi PIC, bahan yang dibeli, dan harganya. Stok bahan otomatis bertambah." },
    ],
  },
  {
    id: "tagih-kasbon",
    title: "Tagih kasbon",
    summary: "Lihat piutang pelanggan dan catat pembayarannya.",
    roles: staff,
    steps: [
      { section: "kas", target: "cash-receivables", title: "Piutang kasbon", description: "Pesanan bayar nanti yang belum lunas tampil di sini. Catat cicilan atau pelunasan dari sini." },
    ],
  },
  {
    id: "kerjakan-antrean",
    title: "Kerjakan antrean",
    summary: "Ubah status pesanan sesuai progres pembuatan.",
    roles: stations,
    steps: [
      { section: "pesanan", target: "orders-board", title: "Papan pesanan", description: "Pesanan baru tampil di antrean. Geser statusnya setiap kali tahap pembuatan selesai, sampai siap diambil." },
    ],
  },
  {
    id: "atur-menu",
    title: "Atur menu dan diskon",
    summary: "Ubah harga produk dan buat diskon.",
    roles: admin,
    steps: [
      { section: "menu", target: "menu-catalog", title: "Katalog menu", description: "Ubah harga dan status produk. Perubahan langsung dipakai di kasir." },
      { section: "menu", target: "menu-discount", title: "Diskon", description: "Buat diskon persentase atau nominal. Kasir memilih diskon saat pembayaran." },
    ],
  },
  {
    id: "cek-stok",
    title: "Cek stok bahan",
    summary: "Pantau stok dan catat perubahan.",
    roles: admin,
    steps: [
      { section: "inventory", target: "inventory-stock", title: "Stok bahan", description: "Bahan di bawah batas minimum akan ditandai." },
      { section: "inventory", target: "inventory-adjust", title: "Catat perubahan", description: "Catat barang masuk atau koreksi stok opname." },
    ],
  },
  {
    id: "atur-printer",
    title: "Atur printer nota",
    summary: "Atur lebar kertas dan koneksi printer thermal.",
    roles: admin,
    steps: [
      { section: "pengaturan", target: "settings-printing", title: "Pencetakan nota", description: "Atur lebar kertas printer thermal yang dipakai untuk nota." },
      { section: "pengaturan", target: "settings-printer", title: "Printer thermal", description: "Hubungkan printer Bluetooth dari server, lalu simpan koneksinya." },
    ],
  },
];
